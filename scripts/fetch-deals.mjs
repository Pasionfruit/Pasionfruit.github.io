#!/usr/bin/env node
/**
 * Fetches current weekly-ad deal items from Flipp for Walmart, Target, Publix,
 * and Aldi. Intended to run as a daily GitHub Actions job.
 * Output: public/deals-data.json
 *
 * Flipp's flyer_items endpoint only exposes a single "price" field (no
 * separate original/sale price), so deals are shown as flat weekly-ad prices
 * rather than percent-off discounts. This is an unofficial API — field names
 * may drift over time, in which case a store's deals array stays empty.
 *
 * Environment variables:
 *   FLIPP_ZIP — US zip code used to localize flyers (default: 33136 = Miami, FL)
 *               Use a zip inside Publix's territory (SE United States) to ensure
 *               Publix flyers are returned alongside the national chains.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../public/deals-data.json')

const FLIPP_BASE = 'https://flyers-ng.flippback.com/api/flipp'
const ZIP_CODE = process.env.FLIPP_ZIP ?? '33136'
const SID = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')

const STORES = ['Walmart', 'Target', 'Publix', 'Aldi']

// Mimic a real browser so Flipp doesn't reject the request.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
}

async function flippGet(url) {
  console.log(`  GET ${url}`)
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

// Fetch every flyer Flipp has for this zip code.
async function fetchFlyers() {
  const body = await flippGet(
    `${FLIPP_BASE}/data?locale=en-US&postal_code=${ZIP_CODE}&sid=${SID}`,
  )
  return body.flyers ?? []
}

// Fetch the deal items inside one flyer.
async function fetchFlyerItems(flyerId) {
  const body = await flippGet(
    `${FLIPP_BASE}/flyers/${flyerId}/flyer_items?locale=en-US&sid=${SID}`,
  )
  return Array.isArray(body) ? body : []
}

function normalizeItem(raw, storeName) {
  const price = raw.price !== undefined && raw.price !== '' ? Number(raw.price) : null
  return {
    id: `${storeName}-${raw.id}`,
    item: String(raw.name ?? '').trim(),
    brand: raw.brand ? String(raw.brand).trim() : null,
    price: price != null && !Number.isNaN(price) ? price : null,
    validFrom: raw.valid_from ?? null,
    validTo: raw.valid_to ?? null,
  }
}

// A flyer is "current" if today falls inside its valid_from/valid_to window.
function isCurrent(flyer) {
  const now = Date.now()
  const from = flyer.valid_from ? new Date(flyer.valid_from).getTime() : -Infinity
  const to = flyer.valid_to ? new Date(flyer.valid_to).getTime() : Infinity
  return now >= from && now <= to
}

async function main() {
  const result = {
    lastUpdated: new Date().toISOString(),
    stores: {},
  }

  let flyers
  try {
    console.log('Fetching flyers from Flipp…')
    flyers = await fetchFlyers()
    console.log(`  ${flyers.length} flyers found for zip ${ZIP_CODE}`)
  } catch (err) {
    console.error('Failed to load flyers:', err.message)
    process.exit(1)
  }

  for (const name of STORES) {
    console.log(`\n── ${name} ──`)

    const matches = flyers.filter(
      (f) => String(f.merchant ?? '').toLowerCase() === name.toLowerCase(),
    )
    const current = matches.filter(isCurrent)
    const relevant = current.length ? current : matches

    if (!relevant.length) {
      console.log('  No matching flyer found for this zip code')
      result.stores[name] = {
        validFrom: null,
        validTo: null,
        deals: [],
        error: 'No flyer found — try a different FLIPP_ZIP',
      }
      continue
    }

    const validFrom = relevant.map((f) => f.valid_from).filter(Boolean).sort()[0] ?? null
    const validTo = relevant.map((f) => f.valid_to).filter(Boolean).sort().slice(-1)[0] ?? null

    // Flipp's flyer_items endpoint frequently lists the same product twice
    // (e.g. once per page placement) with different item ids but identical
    // name+price, so dedupe on content rather than id.
    const dealsByContent = new Map()
    for (const flyer of relevant) {
      console.log(
        `  Flyer ID ${flyer.id}  valid ${flyer.valid_from ?? '?'} → ${flyer.valid_to ?? '?'}`,
      )
      try {
        const rawItems = await fetchFlyerItems(flyer.id)
        console.log(`    ${rawItems.length} raw items`)
        for (const raw of rawItems) {
          const deal = normalizeItem(raw, name)
          if (deal.item && deal.price !== null && deal.price > 0) {
            const contentKey = `${deal.item}|${deal.price}`
            if (!dealsByContent.has(contentKey)) dealsByContent.set(contentKey, deal)
          }
        }
      } catch (err) {
        console.error(`    Items fetch failed: ${err.message}`)
      }
      // Small delay — be a polite API consumer.
      await new Promise((r) => setTimeout(r, 700))
    }

    const deals = [...dealsByContent.values()]
    result.stores[name] = { validFrom, validTo, deals }
    console.log(`  Saved ${deals.length} deals`)
  }

  mkdirSync(resolve(__dirname, '../public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2))
  console.log(`\nWrote ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
