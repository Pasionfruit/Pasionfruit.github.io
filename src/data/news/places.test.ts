import { describe, expect, it } from 'vitest'
import { isStoredFresh, placesFromGeocode } from './places'

// What BigDataCloud returns for downtown Tallahassee, trimmed.
const TALLAHASSEE = {
  city: 'Tallahassee',
  locality: 'Tallahassee',
  principalSubdivision: 'Florida',
  localityInfo: {
    administrative: [
      { name: 'United States of America', adminLevel: 2 },
      { name: 'Florida', adminLevel: 4 },
      { name: 'Leon County', adminLevel: 6 },
      { name: 'Tallahassee', adminLevel: 8 },
    ],
  },
}

describe('placesFromGeocode', () => {
  it('uses the county for Local when the town is the city itself', () => {
    expect(placesFromGeocode(TALLAHASSEE)).toEqual({
      local: { label: 'Leon County, Florida', place: 'Leon County', region: 'Florida' },
      city: { label: 'Tallahassee, Florida', place: 'Tallahassee', region: 'Florida' },
    })
  })

  it('uses the neighbourhood for Local when it is smaller than the city', () => {
    const places = placesFromGeocode({
      city: 'New York',
      locality: 'Brooklyn',
      principalSubdivision: 'New York',
      localityInfo: { administrative: [{ name: 'Kings County', adminLevel: 6 }] },
    })

    expect(places?.local).toEqual({ label: 'Brooklyn, New York', place: 'Brooklyn', region: 'New York' })
    // A place named like its state is not labelled "New York, New York".
    expect(places?.city.label).toBe('New York')
  })

  it('falls back to the city when there is no county, and gives up with nothing', () => {
    expect(placesFromGeocode({ city: 'Monaco', locality: 'Monaco' })?.local.place).toBe('Monaco')
    expect(placesFromGeocode({ principalSubdivision: 'Florida' })).toBeNull()
  })
})

describe('isStoredFresh', () => {
  const stored = {
    local: { label: 'L', place: 'L', region: '' },
    city: { label: 'C', place: 'C', region: '' },
    latitude: 30.44,
    longitude: -84.28,
    storedAt: 1_000_000,
  }

  it('reuses a lookup for the same spot within a week', () => {
    expect(isStoredFresh(stored, { latitude: 30.45, longitude: -84.29 }, 1_000_000 + 60_000)).toBe(true)
  })

  it('looks up again after moving or after a week', () => {
    expect(isStoredFresh(stored, { latitude: 30.6, longitude: -84.28 }, 1_000_000)).toBe(false)
    expect(isStoredFresh(stored, { latitude: 30.44, longitude: -84.28 }, 1_000_000 + 8 * 86_400_000)).toBe(false)
  })
})
