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
 * quality for it. Reload re-requests the position so a moved device updates.
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

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'This device does not support location services.',
      }))
      return
    }

    setState((prev) => ({ ...prev, status: 'locating', error: '' }))
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void loadForCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        if (!isMountedRef.current) return
        setState((prev) => ({ ...prev, status: 'error', error: geolocationMessage(error) }))
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [loadForCoords])

  useEffect(() => {
    // Request geolocation on mount; state settles asynchronously in callbacks.
    locate()
  }, [locate])

  const refresh = useCallback(() => {
    if (state.coords) {
      void loadForCoords(state.coords)
    } else {
      locate()
    }
  }, [state.coords, loadForCoords, locate])

  return { ...state, refresh, retry: locate }
}
