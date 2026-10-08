import { decodeEntities } from './feed.js'

const MAX_BYTES = 2_000_000
const MAX_TEXT = 14_000

/** Reject local destinations, credentials and custom ports, including redirects. */
export function publicArticleUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ||
        /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)) return null
    return url
  } catch {
    return null
  }
}

async function readCapped(response) {
  if (!response.ok || !response.body) throw new Error('Article unavailable')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  let bytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_BYTES) {
      await reader.cancel()
      throw new Error('Article too large')
    }
    result += decoder.decode(value, { stream: true })
  }
  return result + decoder.decode()
}

async function fetchPage(value, signal) {
  let url = publicArticleUrl(value)
  for (let redirects = 0; url && redirects <= 5; redirects++) {
    const response = await fetch(url.href, {
      redirect: 'manual', signal, headers: { Accept: 'text/html, application/xhtml+xml' },
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location')
      await response.body?.cancel()
      url = location ? publicArticleUrl(new URL(location, url).href) : null
      continue
    }
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('Content-Type') ?? '')) {
      await response.body?.cancel()
      throw new Error('Not an HTML article')
    }
    return { url: url.href, html: await readCapped(response) }
  }
  throw new Error('Invalid article redirect')
}

function plainText(html) {
  return decodeEntities(html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function attributes(tag) {
  const result = {}
  for (const [, key, value] of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
    result[key.toLowerCase()] = decodeEntities(value)
  }
  return result
}

function structuredArticle(value) {
  if (!value || typeof value !== 'object') return null
  if (typeof value.articleBody === 'string' && value.articleBody.trim().length > 100) return value
  for (const child of Object.values(value)) {
    const article = structuredArticle(child)
    if (article) return article
  }
  return null
}

/** Prefer publisher articleBody; otherwise use article paragraphs or a labelled excerpt. */
export function extractArticle(html) {
  const meta = {}
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag)
    meta[attrs.property || attrs.name] = attrs.content
  }
  let title = meta['og:title'] || plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  for (const [, attrs, content] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/application\/ld\+json/i.test(attrs)) continue
    try {
      const article = structuredArticle(JSON.parse(content))
      if (article) {
        return { title: String(article.headline || title), text: plainText(article.articleBody).slice(0, MAX_TEXT), excerpt: false }
      }
    } catch { /* Invalid publisher metadata: try the readable HTML instead. */ }
  }
  const clean = html.replace(/<(script|style|noscript|nav|aside|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const article = clean.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
  const main = clean.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
  const paragraphs = [...(article || main || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(([, text]) => plainText(text)).filter((text) => text.length > 40)
  const text = paragraphs.join('\n\n')
  if (text.length > 200) return { title, text: text.slice(0, MAX_TEXT), excerpt: !article }
  const description = meta['og:description'] || meta.description || ''
  return { title, text: plainText(description).slice(0, MAX_TEXT), excerpt: true }
}

/** Google RSS links use a signed redirect RPC, as in newspaper4k's GoogleNewsSource. */
async function resolveGoogleArticle(page, signal) {
  const id = new URL(page.url).pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([\w-]+)$/)?.[1]
  if (!id) throw new Error('Not a Google News article')
  let signature, timestamp
  for (const [tag] of page.html.matchAll(/<[^>]+data-n-a-sg[^>]*>/g)) {
    const attrs = attributes(tag)
    if (attrs['data-n-a-id'] && attrs['data-n-a-id'] !== id) continue
    signature = attrs['data-n-a-sg']
    timestamp = Number(attrs['data-n-a-ts'])
    if (signature && Number.isFinite(timestamp)) break
  }
  if (!signature || !timestamp) throw new Error('Google News link could not be resolved')
  // Google's private RPC may change; failures are surfaced instead of guessing content.
  const settings = [['en-US', 'US', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1,
    null, null, null, null, null, 0, 1], 'en-US', 'US', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0]
  const rpc = JSON.stringify(['garturlreq', settings, id, timestamp, signature])
  const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je', rpc, null, 'generic']]]) }),
  })
  const text = await readCapped(response)
  for (const line of text.split('\n')) {
    if (!line.startsWith('[[')) continue
    try {
      for (const row of JSON.parse(line)) {
        if (row[1] !== 'Fbv4je' || typeof row[2] !== 'string') continue
        const result = JSON.parse(row[2])
        if (result[0] === 'garturlres' && publicArticleUrl(result[1])) return result[1]
      }
    } catch { /* Skip framing and unrelated RPC rows. */ }
  }
  throw new Error('Google News link could not be resolved')
}

export async function readArticle(url) {
  const signal = AbortSignal.timeout(15_000)
  let page = await fetchPage(url, signal)
  if (new URL(page.url).hostname === 'news.google.com') {
    page = await fetchPage(await resolveGoogleArticle(page, signal), signal)
  }
  const article = extractArticle(page.html)
  if (!article.text) throw new Error('No readable article text')
  return { url: page.url, ...article }
}
