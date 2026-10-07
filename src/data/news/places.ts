/**
 * Where "Local" and "City" news are for, worked out from the device location.
 *
 * Uses the same BigDataCloud client endpoint as the weather card, which needs
 * no key and is meant to be called from the browser. City is the city; Local
 * is the smaller area inside it when there is one (a neighbourhood or town),
 * otherwise the county around it — for Tallahassee, that is Leon County.
 * Both carry the state so a search for "Springfield" lands in the right one.
 */

export type Coords = { latitude: number; longitude: number }

export type NewsPlace = {
  /** What the card shows, e.g. "Leon County, Florida". */
  label: string
  /** The phrase searched for, e.g. "Leon County". */
  place: string
  /** Narrows the search, e.g. "Florida". */
  region: string
}

export type NewsPlaces = { local: NewsPlace; city: NewsPlace }

export type ReverseGeocode = {
  city?: string
  locality?: string
  principalSubdivision?: string
  localityInfo?: { administrative?: { name?: string; adminLevel?: number }[] }
}

/** In the US, BigDataCloud's administrative level 6 is the county. */
const COUNTY_ADMIN_LEVEL = 6

function toPlace(place: string, region: string): NewsPlace {
  return { label: region && region !== place ? `${place}, ${region}` : place, place, region }
}

export function placesFromGeocode(data: ReverseGeocode): NewsPlaces | null {
  const region = data.principalSubdivision?.trim() ?? ''
  const locality = data.locality?.trim() ?? ''
  const city = data.city?.trim() || locality
  const county =
    data.localityInfo?.administrative?.find((entry) => entry.adminLevel === COUNTY_ADMIN_LEVEL)?.name?.trim() ?? ''

  const local = locality && locality !== city ? locality : county || city
  const cityName = city || local
  if (!cityName) return null

  return { local: toPlace(local, region), city: toPlace(cityName, region) }
}

export async function reverseGeocodePlaces(coords: Coords): Promise<NewsPlaces | null> {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
  )
  if (!response.ok) {
    throw new Error(`Location lookup failed: ${response.status}`)
  }
  return placesFromGeocode((await response.json()) as ReverseGeocode)
}

// ── Remembering the last lookup ──────────────────────────────────────────────

const STORAGE_KEY = 'news-places'

/** Re-look-up after moving roughly this far (degrees; ~5 km) or after a week. */
const MOVED_DEGREES = 0.05
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type StoredPlaces = NewsPlaces & Coords & { storedAt: number }

export function readStoredPlaces(): StoredPlaces | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredPlaces>
    if (!parsed.local?.place || !parsed.city?.place || typeof parsed.storedAt !== 'number') return null
    return parsed as StoredPlaces
  } catch {
    return null
  }
}

export function writeStoredPlaces(places: NewsPlaces, coords: Coords) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...places, ...coords, storedAt: Date.now() }))
  } catch {
    // Nothing to do — the next visit just looks the places up again.
  }
}

/** Whether a stored lookup still describes where the device is now. */
export function isStoredFresh(stored: StoredPlaces, coords: Coords, now = Date.now()) {
  return (
    now - stored.storedAt < MAX_AGE_MS &&
    Math.abs(stored.latitude - coords.latitude) < MOVED_DEGREES &&
    Math.abs(stored.longitude - coords.longitude) < MOVED_DEGREES
  )
}
