import { describe, expect, it } from 'vitest'
import { FEEDS, MAX_ITEMS, decodeEntities, feedSources, mergeFeeds, parseFeed } from './feed.js'

// Trimmed from a real Google News RSS response.
const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rss version="2.0"><channel>
<title>Google News</title>
<item><title>Power restored to Downtown Tallahassee after fire - WTXL ABC 27</title><link>https://news.google.com/rss/articles/AAA?oc=5</link><pubDate>Tue, 06 Oct 2026 20:15:00 GMT</pubDate><description>&lt;a href="x"&gt;x&lt;/a&gt;</description><source url="https://www.wtxl.com">WTXL ABC 27</source></item>
<item><title>Courthouse to re-open Wednesday &amp; courts &quot;remain&quot; closed - WCTV</title><link>https://news.google.com/rss/articles/BBB?oc=5</link><pubDate>Tue, 06 Oct 2026 23:40:00 GMT</pubDate><source url="https://www.wctv.tv">WCTV</source></item>
<item><title><![CDATA[Title in CDATA - Tallahassee Democrat]]></title><link>https://news.google.com/rss/articles/CCC?oc=5</link><pubDate>not a date</pubDate><source url="https://www.tallahassee.com">Tallahassee Democrat</source></item>
<item><title>No link here - Nowhere</title><source url="https://x.example">Nowhere</source></item>
</channel></rss>`

// Trimmed from a real Bing News search RSS response.
const BING_SAMPLE = `<?xml version="1.0" encoding="utf-8" ?><rss version="2.0" xmlns:News="https://www.bing.com/news/search?q=x&amp;format=rss"><channel>
<item><title>Tallahassee on tropical storm warning</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=abc&amp;url=https%3a%2f%2fwww.tallahassee.com%2fstory%2fnews%2f2026%2f10%2f08%2fstorm%2f&amp;c=1&amp;mkt=en-us</link><description>Storm.</description><pubDate>Thu, 08 Oct 2026 13:08:24 GMT</pubDate><News:Source>Tallahassee Democrat on MSN</News:Source></item>
</channel></rss>`

function params(query) {
  return new URLSearchParams(query)
}

describe('feedSources', () => {
  it('serves the two fixed feeds and nothing else by name', () => {
    expect(feedSources(params('feed=nation'))).toBe(FEEDS.nation)
    expect(feedSources(params('feed=world'))).toBe(FEEDS.world)
    expect(feedSources(params('feed=toString'))).toEqual([])
    expect(feedSources(params('feed=https://evil.example'))).toEqual([])
  })

  it('names the outlet of every fixed feed, over HTTPS', () => {
    for (const source of [...FEEDS.nation, ...FEEDS.world]) {
      expect(source.url).toMatch(/^https:\/\//)
      expect(source.source).not.toBe('')
    }
  })

  it('searches a place as a phrase, narrowed by its region, over the past week', () => {
    const [source] = feedSources(params('place=Leon County&region=Florida'))
    const url = new URL(source.url)

    expect(url.origin + url.pathname).toBe('https://www.bing.com/news/search')
    expect(url.searchParams.get('q')).toBe('"Leon County" Florida')
    expect(url.searchParams.get('qft')).toBe('interval="8"')
    expect(url.searchParams.get('format')).toBe('rss')
  })

  it('drops quotes a caller sends, and refuses missing or oversized places', () => {
    const [source] = feedSources(params('place=Tal"la"hassee'))
    expect(new URL(source.url).searchParams.get('q')).toBe('"Tal la hassee"')
    expect(feedSources(params('region=Florida'))).toEqual([])
    expect(feedSources(params(`place=${'x'.repeat(81)}`))).toEqual([])
    expect(feedSources(params(''))).toEqual([])
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

  it("unwraps Bing's click-tracking link and reads its News:Source", () => {
    const [item] = parseFeed(BING_SAMPLE)

    expect(item).toEqual({
      title: 'Tallahassee on tropical storm warning',
      url: 'https://www.tallahassee.com/story/news/2026/10/08/storm/',
      source: 'Tallahassee Democrat on MSN',
      publishedAt: '2026-10-08T13:08:24.000Z',
    })
  })

  it("falls back to the feed's outlet when an item names none", () => {
    const [item] = parseFeed(
      '<rss><item><title>Story</title><link>https://www.npr.org/a</link></item></rss>',
      'NPR',
    )

    expect(item.source).toBe('NPR')
  })
})

describe('mergeFeeds', () => {
  const story = (source, index, minute) => ({
    title: `${source} story ${index}`,
    url: `https://${source}.example/${index}`,
    source,
    publishedAt: `2026-10-08T12:${String(minute).padStart(2, '0')}:00.000Z`,
  })

  it('blends outlets newest first without letting a busy one crowd the rest out', () => {
    const busy = Array.from({ length: MAX_ITEMS }, (_, index) => story('busy', index, 59 - index))
    const quiet = [story('quiet', 0, 0), story('quiet', 1, 1)]

    const items = mergeFeeds([busy, quiet])

    expect(items).toHaveLength(MAX_ITEMS)
    expect(items.filter((item) => item.source === 'quiet')).toHaveLength(2)
    expect(items[0].title).toBe('busy story 0')
    expect(items.at(-1).title).toBe('quiet story 0')
  })

  it('keeps a single feed whole', () => {
    const only = Array.from({ length: MAX_ITEMS }, (_, index) => story('only', index, 59 - index))

    expect(mergeFeeds([only])).toHaveLength(MAX_ITEMS)
  })

  it('shows a story two outlets carry once', () => {
    const first = story('a', 0, 10)
    const sameLink = { ...story('b', 0, 11), url: first.url }
    const sameTitle = { ...story('c', 0, 12), title: first.title.toUpperCase() }

    expect(mergeFeeds([[first], [sameLink], [sameTitle]])).toHaveLength(1)
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric entities and leaves unknown ones', () => {
    expect(decodeEntities('A &amp; B &#39;C&#39; &#x2014; &bogus;')).toBe("A & B 'C' — &bogus;")
  })
})
