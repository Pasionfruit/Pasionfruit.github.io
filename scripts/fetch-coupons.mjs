#!/usr/bin/env node
/**
 * Fetches current coupons from existing sites. Intended to run as a daily
 * GitHub Actions job alongside fetch-deals.mjs.
 * Output: public/coupons-data.json
 *
 * Sources:
 *  - Grocery: manufacturer coupons from Flipp's unofficial API (the same
 *    endpoint the deals script uses). These are brand coupons (save-to-card
 *    or print) redeemable at participating grocery stores.
 *  - Fast food: recent deal/coupon posts from Slickdeals' public RSS search,
 *    one query per chain, filtered to posts that actually mention the chain.
 *
 * Both are unofficial/free feeds — if one breaks, its section is written with
 * an empty coupons array and an error message rather than failing the run.
 *
 * Environment variables:
 *   FLIPP_ZIP — US zip code used to localize coupons (default: 33136 = Miami, FL)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../public/coupons-data.json')

const FLIPP_BASE = 'https://flyers-ng.flippback.com/api/flipp'
const ZIP_CODE = process.env.FLIPP_ZIP ?? '33136'
const SID = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')

const FAST_FOOD_CHAINS = [
  "McDonald's",
  'Burger King',
  "Wendy's",
  'Taco Bell',
  'Chick-fil-A',
  'Chipotle',
  'Subway',
  "Domino's",
  'Pizza Hut',
  'KFC',
  'Popeyes',
  "Dunkin'",
]

const MAX_POSTS_PER_CHAIN = 6
// Slickdeals search results can include years-old threads; keep recent ones.
const MAX_POST_AGE_DAYS = 45

// Merchandise that merely name-drops a chain ("LEGO … Subway Train Scene")
// is not a food offer — drop posts whose titles contain these tokens.
const MERCH_TOKENS = [
  'lego', 'toy', 'plush', 'costume', 'shirt', 'hoodie', 'mug',
  'poster', 'book', 'funko', 'building set',
]

// Mimic a real browser so the feeds don't reject the request.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
}

async function httpGet(url, accept) {
  console.log(`  GET ${url}`)
  const res = await fetch(url, { headers: { ...HEADERS, ...(accept ? { Accept: accept } : {}) } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res
}

// ── Grocery: Flipp manufacturer coupons ────────────────────────────────────

function primaryCategory(categories) {
  if (!Array.isArray(categories)) return 'Other'
  return categories.find((c) => c && c !== 'All Deals') ?? 'Other'
}

function normalizeFlippCoupon(raw) {
  const story = String(raw.sale_story ?? '').trim()
  const promo = String(raw.promotion_text ?? '').trim()
  const shortAmount = raw.dollars_off
    ? `$${raw.dollars_off} off`
    : raw.percent_off
      ? `${raw.percent_off}% off`
      : null

  // A short sale story ("SAVE $1.00") works as the badge with the promotion
  // text as the description. A long story ("Buy Any 1 … Get 1 … Free") IS the
  // offer, so promote it to the description and fall back to a short badge.
  const storyIsShort = story && story.length <= 28
  const discount = storyIsShort ? story : (shortAmount ?? 'Coupon')
  const description = storyIsShort || !story ? promo : story

  return {
    id: `flipp-${raw.coupon_id}`,
    brand: raw.brand ? String(raw.brand).trim() : null,
    discount,
    description,
    category: primaryCategory(raw.categories),
    validTo: raw.valid_to ?? null,
    redemption: raw.redemption_method ?? null,
  }
}

async function fetchGroceryCoupons() {
  const res = await httpGet(
    `${FLIPP_BASE}/data?locale=en-US&postal_code=${ZIP_CODE}&sid=${SID}`,
  )
  const body = await res.json()
  const raw = Array.isArray(body.coupons) ? body.coupons : []
  console.log(`  ${raw.length} raw coupons`)

  const now = Date.now()
  const byId = new Map()
  for (const c of raw) {
    const coupon = normalizeFlippCoupon(c)
    if (!coupon.description) continue
    // Skip already-expired coupons; keep ones with no expiry.
    if (coupon.validTo && new Date(coupon.validTo).getTime() < now) continue
    if (!byId.has(coupon.id)) byId.set(coupon.id, coupon)
  }
  return [...byId.values()].sort((a, b) =>
    (a.brand ?? '').localeCompare(b.brand ?? ''),
  )
}

// ── Fast food: Slickdeals RSS search per chain ─────────────────────────────

function decodeXmlEntities(text) {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return m ? decodeXmlEntities(m[1]) : ''
}

function parseRssItems(xml) {
  const items = []
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  for (const block of blocks) {
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      pubDate: extractTag(block, 'pubDate'),
    })
  }
  return items
}

// "McDonald's" → "mcdonalds": used both for the search query and for the
// contains-check on post titles.
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function slickdealsThreadId(link) {
  const m = link.match(/\/f\/(\d+)/)
  return m ? m[1] : null
}

async function fetchChainPosts(chain) {
  const query = encodeURIComponent(chain.replace(/['’]/g, '').toLowerCase())
  const url = `https://slickdeals.net/newsearch.php?src=SearchBarV2&q=${query}&searcharea=deals&searchin=first&rss=1`
  const res = await httpGet(url, 'application/rss+xml, application/xml, text/xml')
  const xml = await res.text()

  const chainToken = normalizeName(chain)
  const cutoff = Date.now() - MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000

  return parseRssItems(xml)
    .filter((item) => item.title && item.link)
    .filter((item) => normalizeName(item.title).includes(chainToken))
    .filter((item) => {
      const lower = item.title.toLowerCase()
      return !MERCH_TOKENS.some((token) => lower.includes(token))
    })
    .filter((item) => {
      if (!item.pubDate) return true
      const t = new Date(item.pubDate).getTime()
      return Number.isNaN(t) || t >= cutoff
    })
    .slice(0, MAX_POSTS_PER_CHAIN)
    .map((item) => ({
      id: `sd-${slickdealsThreadId(item.link) ?? normalizeName(item.title).slice(0, 40)}`,
      place: chain,
      title: item.title,
      url: item.link,
      postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    }))
}

async function fetchFastFoodCoupons() {
  const byId = new Map()
  for (const chain of FAST_FOOD_CHAINS) {
    console.log(`\n── ${chain} ──`)
    try {
      const posts = await fetchChainPosts(chain)
      console.log(`  ${posts.length} posts kept`)
      for (const post of posts) {
        if (!byId.has(post.id)) byId.set(post.id, post)
      }
    } catch (err) {
      console.error(`  Fetch failed: ${err.message}`)
    }
    // Small delay — be a polite feed consumer.
    await new Promise((r) => setTimeout(r, 500))
  }
  return [...byId.values()].sort((a, b) =>
    (b.postedAt ?? '').localeCompare(a.postedAt ?? ''),
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const result = {
    lastUpdated: new Date().toISOString(),
    grocery: { source: 'Flipp', error: null, coupons: [] },
    fastfood: { source: 'Slickdeals', error: null, coupons: [] },
  }

  console.log('Fetching grocery coupons from Flipp…')
  try {
    result.grocery.coupons = await fetchGroceryCoupons()
    console.log(`  Saved ${result.grocery.coupons.length} grocery coupons`)
  } catch (err) {
    console.error('Grocery coupons failed:', err.message)
    result.grocery.error = String(err.message ?? err)
  }

  console.log('\nFetching fast food posts from Slickdeals…')
  try {
    result.fastfood.coupons = await fetchFastFoodCoupons()
    console.log(`\nSaved ${result.fastfood.coupons.length} fast food posts`)
  } catch (err) {
    console.error('Fast food coupons failed:', err.message)
    result.fastfood.error = String(err.message ?? err)
  }

  mkdirSync(resolve(__dirname, '../public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2))
  console.log(`\nWrote ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
