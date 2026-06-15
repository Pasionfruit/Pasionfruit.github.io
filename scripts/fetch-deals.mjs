#!/usr/bin/env node
/**
 * Fetches current weekly-ad deal items from Flipp for Walmart, Target, Publix,
 * and Aldi. Intended to run as a daily GitHub Actions job.
 * Output: public/deals-data.json
 *
 * Flipp API is unofficial — field names may drift over time. If a field is
 * missing the code falls back gracefully and that store's deals array stays empty.
 *
 * Environment variables:
 *   FLIPP_ZIP  — US zip code used to localise flyers (default: 33136 = Miami, FL)
 *                Use a zip inside Publix's territory (SE United States) to ensure
 *                Publix flyers are returned alongside the national chains.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname }          from 'path'
import { fileURLToPath }             from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH  = resolve(__dirname, '../public/deals-data.json')

const FLIPP_BASE = 'https://backflipp.wishabi.com/flipp'
const ZIP_CODE   = process.env.FLIPP_ZIP ?? '33136'

const STORES = [
  { name: 'Walmart', query: 'walmart' },
  { name: 'Target',  query: 'target'  },
  { name: 'Publix',  query: 'publix'  },
  { name: 'Aldi',    query: 'aldi'    },
]

// Mimic a real browser so Flipp doesn't reject the request.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin:          'https://flipp.com',
  Referer:         'https://flipp.com/',
}

async function flippGet(url) {
  console.log(`  GET ${url}`)
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

// Fetch the list of all publications available for this zip code.
async function fetchPublications() {
  const body = await flippGet(
    `${FLIPP_BASE}/publications?locale=en-US&access_code=${ZIP_CODE}`,
  )
  // Flipp has returned either `publications` or `flyers` depending on version.
  return body.publications ?? body.flyers ?? []
}

// Fetch the deal items inside one flyer.
async function fetchFlyerItems(flyerRunId) {
  const body = await flippGet(`${FLIPP_BASE}/flyers/${flyerRunId}/items`)
  return body.items ?? (Array.isArray(body) ? body : [])
}

function normalizeItem(raw, storePrefix) {
  const salePrice     = raw.price          ?? raw.current_price ?? null
  const originalPrice = raw.pre_price      ?? raw.was_price     ?? null
  const discountPct =
    originalPrice != null && salePrice != null && originalPrice > salePrice
      ? +((1 - salePrice / originalPrice) * 100).toFixed(1)
      : (raw.discount_percent ?? null)

  return {
    id:            `${storePrefix}-${raw.id}`,
    item:          String(raw.name          ?? '').trim(),
    description:   String(raw.description   ?? raw.display_name ?? '').trim(),
    originalPrice,
    salePrice,
    discountPct,
    saleName:      String(raw.sale_story    ?? raw.offer_text   ?? '').trim(),
    category:      String(
                     Array.isArray(raw.category_names)
                       ? (raw.category_names[0] ?? '')
                       : (raw.category ?? ''),
                   ).trim(),
    validFrom:     raw.valid_from ?? null,
    validTo:       raw.valid_to   ?? null,
  }
}

async function main() {
  const result = {
    lastUpdated: new Date().toISOString(),
    stores: {},
  }

  let publications
  try {
    console.log('Fetching publications from Flipp…')
    publications = await fetchPublications()
    console.log(`  ${publications.length} publications found`)
  } catch (err) {
    console.error('Failed to load publications:', err.message)
    process.exit(1)
  }

  for (const { name, query } of STORES) {
    console.log(`\n── ${name} ──`)

    const matches = publications.filter((p) => {
      const merchant = String(
        p.merchant ?? p.merchant_name ?? p.name ?? '',
      ).toLowerCase()
      return merchant.includes(query)
    })

    if (!matches.length) {
      console.log('  No matching flyer found for this zip code')
      result.stores[name] = {
        validFrom: null,
        validTo:   null,
        deals:     [],
        error:     'No flyer found — try a different FLIPP_ZIP',
      }
      continue
    }

    // Use the first matching publication (Flipp returns them newest-first).
    const flyer      = matches[0]
    const flyerRunId = flyer.flyer_run_id ?? flyer.id
    console.log(
      `  Flyer ID ${flyerRunId}  valid ${flyer.valid_from ?? '?'} → ${flyer.valid_to ?? '?'}`,
    )

    try {
      const rawItems = await fetchFlyerItems(flyerRunId)
      console.log(`  ${rawItems.length} raw items`)

      const deals = rawItems
        .filter((i) => String(i.name ?? i.description ?? '').trim())
        .map((i)    => normalizeItem(i, flyerRunId))
        .filter((i) => i.item && (i.salePrice !== null || i.saleName))

      result.stores[name] = {
        validFrom: flyer.valid_from ?? null,
        validTo:   flyer.valid_to   ?? null,
        deals,
      }
      console.log(`  Saved ${deals.length} deals`)
    } catch (err) {
      console.error(`  Items fetch failed: ${err.message}`)
      result.stores[name] = {
        validFrom: null,
        validTo:   null,
        deals:     [],
        error:     err.message,
      }
    }

    // Small delay — be a polite API consumer.
    await new Promise((r) => setTimeout(r, 700))
  }

  mkdirSync(resolve(__dirname, '../public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2))
  console.log(`\nWrote ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
