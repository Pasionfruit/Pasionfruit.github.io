/**
 * Google News RSS → plain headline objects. Pure functions, so they are tested
 * without a Worker runtime (see feed.test.js).
 */

const BASE = 'https://news.google.com/rss'
const EDITION = 'hl=en-US&gl=US&ceid=US:en'

/** The two fixed feeds. Local and city are searches, built by feedUrl. */
export const FEEDS = {
  nation: `${BASE}?${EDITION}`,
  world: `${BASE}/headlines/section/topic/WORLD?${EDITION}`,
}

/** Headlines returned per feed. Google sends ~100; nobody reads past a screen. */
export const MAX_ITEMS = 20

const MAX_QUERY_PART = 80

/**
 * The upstream URL for a request's query string, or '' if it is not one we
 * serve. Only these shapes are accepted, so the Worker cannot be pointed at an
 * arbitrary URL:
 *   ?feed=nation | ?feed=world
 *   ?place=Tallahassee&region=Florida   (region optional)
 *
 * A place is quoted so "Leon County" is matched as a phrase; the region narrows
 * it to the right state (there are a lot of Springfields). `when:3d` keeps a
 * relevance-ranked search from surfacing last year's story.
 */
export function feedUrl(params) {
  const feed = params.get('feed')
  if (feed) {
    return Object.hasOwn(FEEDS, feed) ? FEEDS[feed] : ''
  }

  const place = clean(params.get('place'))
  const region = clean(params.get('region'))
  if (!place) return ''

  const query = `"${place}"${region && region !== place ? ` ${region}` : ''} when:3d`
  return `${BASE}/search?q=${encodeURIComponent(query)}&${EDITION}`
}

function clean(value) {
  const text = String(value ?? '').replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > MAX_QUERY_PART ? '' : text
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

function tag(block, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block)
  if (!match) return ''
  const raw = match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
  return decodeEntities(raw).trim()
}

/**
 * Items out of an RSS document, newest first.
 *
 * A regex reader rather than an XML parser: Workers have no DOMParser, the
 * feed is machine-generated and regular, and every field read is a leaf.
 * Google titles end " - Source", which is dropped since the source is shown
 * on its own line.
 */
export function parseFeed(xml) {
  const items = []

  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = tag(block, 'source')
    let title = tag(block, 'title')
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3))
    }

    const url = tag(block, 'link')
    if (!title || !/^https:\/\//.test(url)) continue

    const published = new Date(tag(block, 'pubDate'))
    items.push({
      title,
      url,
      source,
      publishedAt: Number.isNaN(published.getTime()) ? '' : published.toISOString(),
    })
  }

  return items
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ITEMS)
}
