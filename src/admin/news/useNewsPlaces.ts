import { useEffect, useState } from 'react'
import {
  isStoredFresh,
  readStoredPlaces,
  reverseGeocodePlaces,
  writeStoredPlaces,
  type NewsPlaces,
} from '../../data/news/places'

export type NewsPlacesState = {
  status: 'locating' | 'ready' | 'error'
  places: NewsPlaces | null
  error: string
}

function locationMessage(error: GeolocationPositionError) {
  return error.code === error.PERMISSION_DENIED
    ? 'Location access is blocked. Allow it for this site to see local and city news.'
    : 'Could not get your location for local and city news.'
}

/**
 * Local and City places from the device location, every visit.
 *
 * The last lookup paints straight away (the same idea as the weather card's
 * stored fix), and a fresh position is still asked for. The reverse-geocoding
 * call is only repeated when the device has moved or the lookup is a week old,
 * since the answer for the same spot does not change.
 */
export function useNewsPlaces(): NewsPlacesState {
  const [state, setState] = useState<NewsPlacesState>(() => {
    const stored = readStoredPlaces()
    return stored
      ? { status: 'ready', places: { local: stored.local, city: stored.city }, error: '' }
      : { status: 'locating', places: null, error: '' }
  })

  useEffect(() => {
    let cancelled = false
    const stored = readStoredPlaces()

    // Keep whatever is already on screen; only a first visit shows an error.
    const fail = (message: string) => {
      if (!cancelled && !stored) setState({ status: 'error', places: null, error: message })
    }

    if (!('geolocation' in navigator)) {
      fail('This device does not share its location, so local and city news are unavailable.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude }
        if (stored && isStoredFresh(stored, coords)) return

        void reverseGeocodePlaces(coords)
          .then((places) => {
            if (cancelled) return
            if (!places) {
              fail('Could not tell which city this location is in.')
              return
            }
            writeStoredPlaces(places, coords)
            setState({ status: 'ready', places, error: '' })
          })
          .catch((error: unknown) => fail(error instanceof Error ? error.message : 'Location lookup failed.'))
      },
      (error) => fail(locationMessage(error)),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30 * 60_000 },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
