import { useState } from 'react'
import {
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  RotateCcw,
  Snowflake,
  Sun,
  Thermometer,
} from 'lucide-react'
import type { WeatherHook } from './useWeather'
import { aqiCategory, describeWeather, uvCategory, type WeatherIcon } from './openMeteo'
import './weather.css'

const WEATHER_ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  snowflake: Snowflake,
  storm: CloudLightning,
  thermometer: Thermometer,
}

/**
 * Conditions and the metrics. The temperature is in the top bar, and the radar
 * and hourly chart are in the month view, so both come from the same fetch.
 */
export function WeatherCard({ weather }: { weather: WeatherHook }) {
  const { status, data, aqi, place } = weather
  // Collapse only takes effect on mobile (CSS-gated); desktop always shows the
  // body, so starting collapsed only affects phones.
  const [isCollapsed, setIsCollapsed] = useState(true)

  const condition = data ? describeWeather(data.current.weatherCode, data.current.isDay) : null
  const aqiInfo = aqi != null ? aqiCategory(aqi) : null
  const uvInfo = data ? uvCategory(data.current.uvIndex) : null

  return (
    <article className={`info-card weather-card sheets-card${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="section-card-header">
        <div className="weather-heading">
          <h3>Weather</h3>
          {place ? <p className="weather-place">{place}</p> : null}
        </div>
        <div className="section-card-actions">
          <button
            type="button"
            className="section-collapse-btn weather-refresh"
            onClick={weather.refresh}
            disabled={status === 'locating' || status === 'loading'}
            aria-label="Refresh weather"
            title="Refresh weather"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="section-collapse-btn weather-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expand weather' : 'Collapse weather'}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="weather-collapsible">
        {status === 'locating' ? <p className="sheets-meta">Getting your location…</p> : null}
        {status === 'loading' ? <p className="sheets-meta">Loading local weather…</p> : null}

        {status === 'error' ? (
          <div className="weather-error">
            <p className="sheets-error">{weather.error}</p>
            <button type="button" className="secondary-action" onClick={weather.retry}>
              Try again
            </button>
          </div>
        ) : null}

        {status === 'ready' && data ? (
          <div className="weather-page weather-page--now">
            <div className="weather-now">
              <span className="weather-now-icon" aria-hidden="true">
                {condition
                  ? (() => {
                      const ConditionIcon = WEATHER_ICONS[condition.icon]
                      return <ConditionIcon strokeWidth={1.5} />
                    })()
                  : null}
              </span>
              <div className="weather-now-main">
                <span className="weather-now-desc">{condition?.label}</span>
              </div>
            </div>

            <div className="weather-metrics">
              <div className="weather-metric">
                <span className="weather-metric-label">Humidity</span>
                <span className="weather-metric-value">{Math.round(data.current.humidity)}%</span>
              </div>

              <div className="weather-metric">
                <span className="weather-metric-label">Air Quality</span>
                <span className="weather-metric-value">
                  {aqi != null ? aqi : '—'}
                  {aqiInfo ? <span className={`weather-badge weather-badge--aqi-${aqiInfo.level}`}>{aqiInfo.label}</span> : null}
                </span>
              </div>

              <div className="weather-metric">
                <span className="weather-metric-label">UV Index</span>
                <span className="weather-metric-value">
                  {Math.round(data.current.uvIndex)}
                  {uvInfo ? <span className={`weather-badge weather-badge--uv-${uvInfo.level}`}>{uvInfo.label}</span> : null}
                </span>
              </div>

              <div className="weather-metric">
                <span className="weather-metric-label">Feels Like</span>
                <span className="weather-metric-value">{Math.round(data.current.apparentTemperature)}°</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default WeatherCard
