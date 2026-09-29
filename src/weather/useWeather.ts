import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAirQuality,
  getForecast,
  reverseGeocode,
  type Coords,
  type WeatherData,
} from './openMeteo'

export type WeatherStatus = 'locating' | 'loading' | 'ready' | 'error'

export type WeatherState = {
  status: WeatherStatus
  coords: Coords | null
  place: string
  data: WeatherData | null
  aqi: number | null
  error: string
}

const LOCATION_STORAGE_KEY = 'weather-last-coords'

/** Older than this, a cached fix is more likely wrong (moved) than useful. */
const STORED_COORDS_MAX_AGE_MS = 24 * 60 * 60 * 1000

function readStoredCoords(): Coords | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<Coords> & { storedAt?: number }
    if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number') return null
    if (typeof parsed.storedAt !== 'number' || Date.now() - parsed.storedAt > STORED_COORDS_MAX_AGE_MS) {
      return null
    }

    return { latitude: parsed.latitude, longitude: parsed.longitude }
  } catch {
    return null
  }
}

function writeStoredCoords(coords: Coords) {
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ ...coords, storedAt: Date.now() }))
  } catch {
    // Nothing to do — location is re-requested from scratch next visit instead.
  }
}

function geolocationMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access is blocked. Enable it in your browser to see local weather.'
    case error.POSITION_UNAVAILABLE:
      return 'Your location is unavailable right now. Try again in a moment.'
    case error.TIMEOUT:
      return 'Getting your location timed out. Try again.'
    default:
      return 'Could not determine your location.'
  }
}

/**
 * Resolves the device location, then loads current + hourly weather and air
 * quality for it. A last-known fix from localStorage (if under a day old)
 * paints immediately, the same way a stored session token skips the sign-in
 * screen; a fresh position is still requested quietly in the background and
 * silently ignored on failure so it never blanks out weather that already
 * loaded.
 */
export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    status: 'locating',
    coords: null,
    place: '',
    data: null,
    aqi: null,
    error: '',
  })
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadForCoords = useCallback(async (coords: Coords) => {
    if (!isMountedRef.current) return
    setState((prev) => ({ ...prev, status: 'loading', coords, error: '' }))

    try {
      const [data, aqi, place] = await Promise.all([
        getForecast(coords),
        getAirQuality(coords),
        reverseGeocode(coords),
      ])
      if (!isMountedRef.current) return
      setState({ status: 'ready', coords, place, data, aqi, error: '' })
    } catch (error) {
      if (!isMountedRef.current) return
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load weather.',
      }))
    }
  }, [])

  const locate = useCallback(
    (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false

      if (!('geolocation' in navigator)) {
        if (!silent) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'This device does not support location services.',
          }))
        }
        return
      }

      if (!silent) {
        setState((prev) => ({ ...prev, status: 'locating', error: '' }))
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          writeStoredCoords(coords)
          void loadForCoords(coords)
        },
        (error) => {
          if (!isMountedRef.current || silent) return
          setState((prev) => ({ ...prev, status: 'error', error: geolocationMessage(error) }))
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      )
    },
    [loadForCoords],
  )

  useEffect(() => {
    // A stored fix paints instantly; either way a fresh position is still
    // requested, quietly if we already have something on screen.
    const stored = readStoredCoords()
    if (stored) {
      void loadForCoords(stored)
      locate({ silent: true })
    } else {
      locate()
    }
  }, [locate, loadForCoords])

  const refresh = useCallback(() => {
    if (state.coords) {
      void loadForCoords(state.coords)
    } else {
      locate()
    }
  }, [state.coords, loadForCoords, locate])

  const retry = useCallback(() => locate(), [locate])

  return { ...state, refresh, retry }
}
