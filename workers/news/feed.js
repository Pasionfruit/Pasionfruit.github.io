/**
 * RSS feeds → plain headline objects. Pure functions, so they are tested
 * without a Worker runtime (see feed.test.js).
 *
 * Google News was the source until it began answering Cloudflare's egress IPs
 * with a 503 "Sorry…" page, whatever the User-Agent. Nation and World now blend
 * a few publishers' own feeds, and a place is a Bing News search; both serve
 * Workers.
 */

/**
 * The two fixed feeds, each blended from several outlets. Their RSS carries no
 * <source> element, so the outlet's name rides along with the URL.
 */
export const FEEDS = {
  nation: [
    { url: 'https://feeds.npr.org/1003/rss.xml', source: 'NPR' },
    { url: 'https://www.cbsnews.com/latest/rss/us', source: 'CBS News' },
    { url: 'https://abcnews.go.com/abcnews/usheadlines', source: 'ABC News' },
    { url: 'https://www.pbs.org/newshour/feeds/rss/headlines', source: 'PBS News' },
  ],
  world: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC News' },
    { url: 'https://feeds.npr.org/1004/rss.xml', source: 'NPR' },
    { url: 'https://www.cbsnews.com/latest/rss/world', source: 'CBS News' },
    { url: 'https://abcnews.go.com/abcnews/internationalheadlines', source: 'ABC News' },
  ],
}

const BING_NEWS = 'https://www.bing.com/news/search'

/** Headlines returned per feed. Nobody reads past a screen or two. */
export const MAX_ITEMS = 20

const MAX_QUERY_PART = 80

/**
 * The upstream feeds for a request's query string, or [] if it is not one we
 * serve. Only these shapes are accepted, so the Worker cannot be pointed at an
 * arbitrary URL:
 *   ?feed=nation | ?feed=world
 *   ?place=Tallahassee&region=Florida   (region optional)
 *
 * A place is quoted so "Leon County" is matched as a phrase; the region narrows
 * it to the right state (there are a lot of Springfields). Bing's past-week
 * filter keeps a relevance-ranked search from surfacing last year's story.
 */
export function feedSources(params) {
  const feed = params.get('feed')
  if (feed) {
    return Object.hasOwn(FEEDS, feed) ? FEEDS[feed] : []
  }

  const place = clean(params.get('place'))
  const region = clean(params.get('region'))
  if (!place) return []

  const search = new URLSearchParams({
    q: `"${place}"${region && region !== place ? ` ${region}` : ''}`,
    qft: 'interval="8"',
    format: 'rss',
    setlang: 'en-us',
    cc: 'us',
  })
  return [{ url: `${BING_NEWS}?${search}`, source: '' }]
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
 * Bing wraps every story in a click-tracking redirect on plain http; the
 * publisher's own link is its `url` parameter. Unwrapped, the headline opens
 * the story directly and Ace can read it without a hop through Bing.
 */
function storyLink(link) {
  try {
    const url = new URL(link)
    if (/(^|\.)bing\.com$/.test(url.hostname) && url.searchParams.has('url')) {
      return url.searchParams.get('url')
    }
  } catch {
    return ''
  }
  return link
}

/**
 * Items out of an RSS document, newest first.
 *
 * A regex reader rather than an XML parser: Workers have no DOMParser, the
 * feed is machine-generated and regular, and every field read is a leaf.
 * The source is the item's own <source> (or Bing's <News:Source>), else the
 * outlet the feed belongs to. A title ending " - Source" has that dropped,
 * since the source is shown on its own line.
 */
export function parseFeed(xml, feedSource = '') {
  const items = []

  for (const [, block] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const source = tag(block, 'source') || tag(block, 'News:Source') || feedSource
    let title = tag(block, 'title')
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3))
    }

    const url = storyLink(tag(block, 'link'))
    if (!title || !/^https:\/\//.test(url)) continue

    const published = new Date(tag(block, 'pubDate'))
    items.push({
      title,
      url,
      source,
      publishedAt: Number.isNaN(published.getTime()) ? '' : published.toISOString(),
    })
  }

  return newestFirst(items).slice(0, MAX_ITEMS)
}

function newestFirst(items) {
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/**
 * Several outlets' headlines as one feed, newest first. Outlets take turns
 * contributing their next-newest story, so a busy one cannot crowd the rest
 * out and a sparse or failed one leaves its slots to the others. A story two
 * outlets both carry, by link or by title, appears once.
 */
export function mergeFeeds(lists) {
  const seen = new Set()
  const items = []

  for (let rank = 0; items.length < MAX_ITEMS && lists.some((list) => rank < list.length); rank++) {
    for (const list of lists) {
      const item = list[rank]
      if (!item || items.length >= MAX_ITEMS) continue
      const title = item.title.toLowerCase()
      if (seen.has(item.url) || seen.has(title)) continue
      seen.add(item.url)
      seen.add(title)
      items.push(item)
    }
  }

  return newestFirst(items)
}
