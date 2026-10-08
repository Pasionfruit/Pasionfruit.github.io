import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractArticle, publicArticleUrl, readArticle } from './article.js'
import worker from './worker.js'

afterEach(() => vi.unstubAllGlobals())

const body = 'The city opened a new park on Tuesday, with walking trails and a playground. Residents can visit every day from dawn until dusk. The project took two years to complete and will provide a public space for the surrounding neighborhoods.'
const html = `<html><h1>New park opens</h1><article><p>${body}</p></article></html>`
const page = (content = html) => new Response(content, { headers: { 'Content-Type': 'text/html' } })

describe('article retrieval', () => {
  it('reads publisher article text and metadata, excluding scripts and navigation', () => {
    const article = extractArticle(`<nav><p>Subscribe to our newsletter</p></nav>${html}<script>malicious()</script>`)
    expect(article).toEqual({ title: 'New park opens', text: body, excerpt: false })
    expect(article.text).not.toContain('Subscribe')
  })

  it('prefers structured article text over other page content', () => {
    const article = extractArticle(`<script type="application/ld+json">${JSON.stringify({ '@graph': [{ headline: 'Publisher headline', articleBody: body }] })}</script>${html}`)
    expect(article.title).toBe('Publisher headline')
    expect(article.text).toBe(body)
    expect(article.excerpt).toBe(false)
  })

  it('labels metadata descriptions as excerpts instead of full articles', () => {
    expect(extractArticle('<meta property="og:title" content="New park"><meta name="description" content="Park &amp; trails open.">')).toEqual({
      title: 'New park', text: 'Park & trails open.', excerpt: true,
    })
  })

  it.each(['http://publisher.com/story', 'https://127.0.0.1/', 'https://[::1]/', 'https://localhost/',
    'https://service.internal/', 'https://user:pass@publisher.com/', 'https://publisher.com:8443/', 'https://2130706433/'])('rejects non-public or unsafe article URLs: %s', (url) => {
    expect(publicArticleUrl(url)).toBeNull()
  })

  it('checks the destination again before following a redirect', async () => {
    const fetched = vi.fn(async () => new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/private' } }))
    vi.stubGlobal('fetch', fetched)
    await expect(readArticle('https://publisher.com/story')).rejects.toThrow('Invalid article redirect')
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('resolves Google News RSS links before reading the publisher article', async () => {
    const id = 'CBMiExample'
    const fetched = vi.fn()
      .mockResolvedValueOnce(page(`<div data-n-a-id="${id}" data-n-a-sg="signature" data-n-a-ts="1725891265"></div>`))
      .mockResolvedValueOnce(new Response(`)]}'\n\n42\n${JSON.stringify([['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', 'https://publisher.com/story'])]])}\n`))
      .mockResolvedValueOnce(page())
    vi.stubGlobal('fetch', fetched)
    const article = await readArticle(`https://news.google.com/rss/articles/${id}?oc=5`)
    expect(article.url).toBe('https://publisher.com/story')
    expect(article.text).toBe(body)
    expect(fetched.mock.calls[1][1].method).toBe('POST')
    expect(fetched.mock.calls[2][0]).toBe('https://publisher.com/story')
  })

  it("reads MSN stories from MSN's content API and cites the original publisher", async () => {
    const fetched = vi.fn(async () => Response.json({
      title: 'Leon County declares an emergency',
      body: `<img data-reference="image" /><p>${body}</p><p><a href="https://x.example">Second</a> paragraph.</p>`,
      sourceHref: 'https://www.tallahassee.com/story/news/emergency/',
    }))
    vi.stubGlobal('fetch', fetched)
    const article = await readArticle('https://www.msn.com/en-us/news/other/leon-county-declares/ar-AA2dQVmo')
    expect(fetched.mock.calls[0][0]).toBe('https://assets.msn.com/content/view/v2/Detail/en-us/AA2dQVmo')
    expect(article).toEqual({
      url: 'https://www.tallahassee.com/story/news/emergency/',
      title: 'Leon County declares an emergency',
      text: `${body}\n\nSecond paragraph.`,
      excerpt: false,
    })
  })

  it('rejects oversized responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => page('x'.repeat(2_000_001))))
    await expect(readArticle('https://publisher.com/story')).rejects.toThrow('Article too large')
  })

  it('requires authentication before fetching an article', async () => {
    const fetched = vi.fn()
    vi.stubGlobal('fetch', fetched)
    const response = await worker.fetch(new Request('https://news.worker/article?url=https://publisher.com/story'), {})
    expect(response.status).toBe(403)
    expect(fetched).not.toHaveBeenCalled()
  })

  it('serves article text to the authenticated admin and reports unreadable articles', async () => {
    const env = { DB_API: { fetch: vi.fn(async () => new Response('{}')) } }
    const request = new Request('https://news.worker/article?url=https://publisher.com/story', { headers: { Authorization: 'Bearer session' } })
    vi.stubGlobal('fetch', vi.fn(async () => page()))
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ url: 'https://publisher.com/story', text: body })
    vi.stubGlobal('fetch', vi.fn(async () => page('<h1>Access denied</h1>')))
    const failed = await worker.fetch(request, env)
    expect(failed.status).toBe(502)
    expect((await failed.json()).error).toContain('Paste the article text')
  })
})
