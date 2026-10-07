import { describe, expect, it } from 'vitest'
import { FEEDS, MAX_ITEMS, decodeEntities, feedUrl, parseFeed } from './feed.js'

// Trimmed from a real Google News RSS response.
const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rss version="2.0"><channel>
<title>Google News</title>
<item><title>Power restored to Downtown Tallahassee after fire - WTXL ABC 27</title><link>https://news.google.com/rss/articles/AAA?oc=5</link><pubDate>Tue, 06 Oct 2026 20:15:00 GMT</pubDate><description>&lt;a href="x"&gt;x&lt;/a&gt;</description><source url="https://www.wtxl.com">WTXL ABC 27</source></item>
<item><title>Courthouse to re-open Wednesday &amp; courts &quot;remain&quot; closed - WCTV</title><link>https://news.google.com/rss/articles/BBB?oc=5</link><pubDate>Tue, 06 Oct 2026 23:40:00 GMT</pubDate><source url="https://www.wctv.tv">WCTV</source></item>
<item><title><![CDATA[Title in CDATA - Tallahassee Democrat]]></title><link>https://news.google.com/rss/articles/CCC?oc=5</link><pubDate>not a date</pubDate><source url="https://www.tallahassee.com">Tallahassee Democrat</source></item>
<item><title>No link here - Nowhere</title><source url="https://x.example">Nowhere</source></item>
</channel></rss>`

function params(query) {
  return new URLSearchParams(query)
}

describe('feedUrl', () => {
  it('serves the two fixed feeds and nothing else by name', () => {
    expect(feedUrl(params('feed=nation'))).toBe(FEEDS.nation)
    expect(feedUrl(params('feed=world'))).toBe(FEEDS.world)
    expect(feedUrl(params('feed=toString'))).toBe('')
    expect(feedUrl(params('feed=https://evil.example'))).toBe('')
  })

  it('searches a place as a phrase, narrowed by its region, over three days', () => {
    const url = new URL(feedUrl(params('place=Leon County&region=Florida')))

    expect(url.origin + url.pathname).toBe('https://news.google.com/rss/search')
    expect(url.searchParams.get('q')).toBe('"Leon County" Florida when:3d')
    expect(url.searchParams.get('gl')).toBe('US')
  })

  it('drops quotes a caller sends, and refuses missing or oversized places', () => {
    expect(new URL(feedUrl(params('place=Tal"la"hassee'))).searchParams.get('q')).toBe('"Tal la hassee" when:3d')
    expect(feedUrl(params('region=Florida'))).toBe('')
    expect(feedUrl(params(`place=${'x'.repeat(81)}`))).toBe('')
    expect(feedUrl(params(''))).toBe('')
  })
})

describe('parseFeed', () => {
  it('returns headlines newest first, with the source split off the title', () => {
    const items = parseFeed(SAMPLE)

    expect(items.map((item) => item.title)).toEqual([
      'Courthouse to re-open Wednesday & courts "remain" closed',
      'Power restored to Downtown Tallahassee after fire',
      'Title in CDATA',
    ])
    expect(items[0]).toEqual({
      title: 'Courthouse to re-open Wednesday & courts "remain" closed',
      url: 'https://news.google.com/rss/articles/BBB?oc=5',
      source: 'WCTV',
      publishedAt: '2026-10-06T23:40:00.000Z',
    })
  })

  it('keeps an item with an unreadable date, at the end, and drops one with no link', () => {
    const items = parseFeed(SAMPLE)

    expect(items[2].publishedAt).toBe('')
    expect(items.some((item) => item.source === 'Nowhere')).toBe(false)
  })

  it(`stops at ${MAX_ITEMS} headlines`, () => {
    const many = Array.from(
      { length: MAX_ITEMS + 5 },
      (_, index) =>
        `<item><title>Story ${index}</title><link>https://news.google.com/rss/articles/${index}</link><pubDate>Tue, 06 Oct 2026 10:${String(index).padStart(2, '0')}:00 GMT</pubDate></item>`,
    ).join('')

    expect(parseFeed(`<rss>${many}</rss>`)).toHaveLength(MAX_ITEMS)
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric entities and leaves unknown ones', () => {
    expect(decodeEntities('A &amp; B &#39;C&#39; &#x2014; &bogus;')).toBe("A & B 'C' — &bogus;")
  })
})
