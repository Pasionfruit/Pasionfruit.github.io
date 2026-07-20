// Weather data via Open-Meteo (no API key, CORS-enabled). Units are US-style
// (Fahrenheit / mph / inch) to match the rest of this site.

export type Coords = { latitude: number; longitude: number }

export type WeatherCurrent = {
  time: string
  temperature: number
  apparentTemperature: number
  humidity: number
  precipitation: number
  uvIndex: number
  weatherCode: number
  isDay: boolean
  windSpeed: number
}

export type HourlyPoint = {
  time: string
  temperature: number
  precipitation: number
  precipitationProbability: number
}

export type WeatherData = {
  current: WeatherCurrent
  hourly: HourlyPoint[]
  timezone: string
}

type ForecastResponse = {
  timezone?: string
  current?: {
    time: string
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    precipitation: number
    weather_code: number
    uv_index: number
    is_day: number
    wind_speed_10m: number
  }
  hourly?: {
    time: string[]
    temperature_2m: number[]
    precipitation: number[]
    precipitation_probability: number[]
  }
}

type AirQualityResponse = {
  current?: {
    us_aqi?: number
    pm2_5?: number
  }
}

type ReverseGeocodeResponse = {
  city?: string
  locality?: string
  principalSubdivision?: string
  principalSubdivisionCode?: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

/** Current-hour conditions plus the next 24 hourly points from the current hour. */
export async function getForecast(coords: Coords): Promise<WeatherData> {
  const query = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,uv_index,is_day,wind_speed_10m',
    hourly: 'temperature_2m,precipitation,precipitation_probability',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '2',
  })

  const data = await fetchJson<ForecastResponse>(`https://api.open-meteo.com/v1/forecast?${query.toString()}`)
  if (!data.current || !data.hourly) {
    throw new Error('Weather response was incomplete.')
  }

  const current: WeatherCurrent = {
    time: data.current.time,
    temperature: data.current.temperature_2m,
    apparentTemperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    precipitation: data.current.precipitation,
    uvIndex: data.current.uv_index,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    windSpeed: data.current.wind_speed_10m,
  }

  // Start the hourly strip at the current hour rather than midnight.
  const currentHourKey = data.current.time.slice(0, 13)
  let startIndex = data.hourly.time.findIndex((t) => t.slice(0, 13) === currentHourKey)
  if (startIndex < 0) startIndex = 0

  const hourly: HourlyPoint[] = data.hourly.time
    .slice(startIndex, startIndex + 24)
    .map((time, index) => {
      const source = startIndex + index
      return {
        time,
        temperature: data.hourly!.temperature_2m[source],
        precipitation: data.hourly!.precipitation[source],
        precipitationProbability: data.hourly!.precipitation_probability[source] ?? 0,
      }
    })

  return { current, hourly, timezone: data.timezone ?? 'auto' }
}

/** US AQI for the location, or null when the air-quality feed has no reading. */
export async function getAirQuality(coords: Coords): Promise<number | null> {
  const query = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: 'us_aqi,pm2_5',
    timezone: 'auto',
  })

  try {
    const data = await fetchJson<AirQualityResponse>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${query.toString()}`,
    )
    const aqi = data.current?.us_aqi
    return typeof aqi === 'number' ? Math.round(aqi) : null
  } catch {
    // Air quality is a nice-to-have; a failure here shouldn't sink the card.
    return null
  }
}

/** Best-effort place label ("Tallahassee, FL"); empty string when unavailable. */
export async function reverseGeocode(coords: Coords): Promise<string> {
  try {
    const data = await fetchJson<ReverseGeocodeResponse>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
    )
    const place = data.city || data.locality || data.principalSubdivision
    const region = data.principalSubdivisionCode?.split('-')[1] || data.principalSubdivision
    if (place && region && place !== region) {
      return `${place}, ${region}`
    }
    return place || ''
  } catch {
    return ''
  }
}

// ── WMO weather code → label + emoji ────────────────────────────────────────

const WEATHER_CODES: Record<number, { label: string; day: string; night: string }> = {
  0: { label: 'Clear', day: '☀️', night: '🌙' },
  1: { label: 'Mainly clear', day: '🌤️', night: '🌙' },
  2: { label: 'Partly cloudy', day: '⛅', night: '☁️' },
  3: { label: 'Overcast', day: '☁️', night: '☁️' },
  45: { label: 'Fog', day: '🌫️', night: '🌫️' },
  48: { label: 'Rime fog', day: '🌫️', night: '🌫️' },
  51: { label: 'Light drizzle', day: '🌦️', night: '🌧️' },
  53: { label: 'Drizzle', day: '🌦️', night: '🌧️' },
  55: { label: 'Heavy drizzle', day: '🌧️', night: '🌧️' },
  56: { label: 'Freezing drizzle', day: '🌧️', night: '🌧️' },
  57: { label: 'Freezing drizzle', day: '🌧️', night: '🌧️' },
  61: { label: 'Light rain', day: '🌦️', night: '🌧️' },
  63: { label: 'Rain', day: '🌧️', night: '🌧️' },
  65: { label: 'Heavy rain', day: '🌧️', night: '🌧️' },
  66: { label: 'Freezing rain', day: '🌧️', night: '🌧️' },
  67: { label: 'Freezing rain', day: '🌧️', night: '🌧️' },
  71: { label: 'Light snow', day: '🌨️', night: '🌨️' },
  73: { label: 'Snow', day: '🌨️', night: '🌨️' },
  75: { label: 'Heavy snow', day: '❄️', night: '❄️' },
  77: { label: 'Snow grains', day: '🌨️', night: '🌨️' },
  80: { label: 'Rain showers', day: '🌦️', night: '🌧️' },
  81: { label: 'Rain showers', day: '🌦️', night: '🌧️' },
  82: { label: 'Violent showers', day: '⛈️', night: '⛈️' },
  85: { label: 'Snow showers', day: '🌨️', night: '🌨️' },
  86: { label: 'Snow showers', day: '❄️', night: '❄️' },
  95: { label: 'Thunderstorm', day: '⛈️', night: '⛈️' },
  96: { label: 'Thunderstorm', day: '⛈️', night: '⛈️' },
  99: { label: 'Hailstorm', day: '⛈️', night: '⛈️' },
}

export function describeWeather(code: number, isDay: boolean): { label: string; icon: string } {
  const entry = WEATHER_CODES[code] ?? { label: 'Unknown', day: '🌡️', night: '🌡️' }
  return { label: entry.label, icon: isDay ? entry.day : entry.night }
}

// ── AQI / UV categories (with a severity level 0-5 for coloring) ─────────────

export function aqiCategory(aqi: number): { label: string; level: number } {
  if (aqi <= 50) return { label: 'Good', level: 0 }
  if (aqi <= 100) return { label: 'Moderate', level: 1 }
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', level: 2 }
  if (aqi <= 200) return { label: 'Unhealthy', level: 3 }
  if (aqi <= 300) return { label: 'Very unhealthy', level: 4 }
  return { label: 'Hazardous', level: 5 }
}

export function uvCategory(uv: number): { label: string; level: number } {
  if (uv < 3) return { label: 'Low', level: 0 }
  if (uv < 6) return { label: 'Moderate', level: 1 }
  if (uv < 8) return { label: 'High', level: 2 }
  if (uv < 11) return { label: 'Very high', level: 3 }
  return { label: 'Extreme', level: 4 }
}
