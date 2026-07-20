import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aqiCategory,
  describeWeather,
  getAirQuality,
  getForecast,
  uvCategory,
} from './openMeteo'

const COORDS = { latitude: 30.4383, longitude: -84.2807 }

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      json: async () => payload,
    })) as unknown as typeof fetch,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('aqiCategory', () => {
  it('labels US AQI bands with a severity level', () => {
    expect(aqiCategory(42)).toEqual({ label: 'Good', level: 0 })
    expect(aqiCategory(50)).toEqual({ label: 'Good', level: 0 })
    expect(aqiCategory(51)).toEqual({ label: 'Moderate', level: 1 })
    expect(aqiCategory(120).level).toBe(2)
    expect(aqiCategory(500)).toEqual({ label: 'Hazardous', level: 5 })
  })
})

describe('uvCategory', () => {
  it('labels UV bands', () => {
    expect(uvCategory(0).label).toBe('Low')
    expect(uvCategory(5).label).toBe('Moderate')
    expect(uvCategory(7).label).toBe('High')
    expect(uvCategory(9).label).toBe('Very high')
    expect(uvCategory(11).label).toBe('Extreme')
  })
})

describe('describeWeather', () => {
  it('picks the day or night glyph for a WMO code', () => {
    expect(describeWeather(0, true)).toEqual({ label: 'Clear', icon: '☀️' })
    expect(describeWeather(0, false).icon).toBe('🌙')
    expect(describeWeather(95, true).label).toBe('Thunderstorm')
  })

  it('falls back for unknown codes', () => {
    expect(describeWeather(1234, true).label).toBe('Unknown')
  })
})

describe('getForecast', () => {
  it('maps current fields and slices hourly from the current hour', async () => {
    mockFetchOnce({
      timezone: 'America/New_York',
      current: {
        time: '2026-07-20T12:15',
        temperature_2m: 75.9,
        relative_humidity_2m: 84,
        apparent_temperature: 80.1,
        precipitation: 0.11,
        weather_code: 82,
        uv_index: 7.95,
        is_day: 1,
        wind_speed_10m: 12.8,
      },
      hourly: {
        time: ['2026-07-20T10:00', '2026-07-20T11:00', '2026-07-20T12:00', '2026-07-20T13:00'],
        temperature_2m: [70, 73, 76, 78],
        precipitation: [0, 0, 0.11, 0.2],
        precipitation_probability: [5, 8, 40, 60],
      },
    })

    const result = await getForecast(COORDS)

    expect(result.current.temperature).toBe(75.9)
    expect(result.current.apparentTemperature).toBe(80.1)
    expect(result.current.humidity).toBe(84)
    expect(result.current.isDay).toBe(true)

    // The 12:15 current time should start the hourly strip at the 12:00 bucket.
    expect(result.hourly).toHaveLength(2)
    expect(result.hourly[0]).toEqual({
      time: '2026-07-20T12:00',
      temperature: 76,
      precipitation: 0.11,
      precipitationProbability: 40,
    })
  })

  it('throws when the payload is incomplete', async () => {
    mockFetchOnce({ timezone: 'X' })
    await expect(getForecast(COORDS)).rejects.toThrow(/incomplete/i)
  })

  it('throws on a non-ok response', async () => {
    mockFetchOnce({}, false, 500)
    await expect(getForecast(COORDS)).rejects.toThrow(/500/)
  })
})

describe('getAirQuality', () => {
  it('rounds the US AQI', async () => {
    mockFetchOnce({ current: { us_aqi: 42.6, pm2_5: 2.9 } })
    expect(await getAirQuality(COORDS)).toBe(43)
  })

  it('returns null when air quality fails rather than throwing', async () => {
    mockFetchOnce({}, false, 500)
    expect(await getAirQuality(COORDS)).toBeNull()
  })
})
