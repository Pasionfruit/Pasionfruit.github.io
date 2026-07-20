import { useState } from 'react'
import { HourlyChart } from './HourlyChart'
import { RadarMap } from './RadarMap'
import { useWeather } from './useWeather'
import { aqiCategory, describeWeather, uvCategory } from './openMeteo'
import './weather.css'

export function WeatherCard() {
  const weather = useWeather()
  const { status, data, aqi, place } = weather
  // Collapse only takes effect on mobile (CSS-gated); desktop always shows the
  // body, so starting collapsed only affects phones.
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [page, setPage] = useState<0 | 1 | 2>(0)

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
            ↺
          </button>
          <button
            type="button"
            className="section-collapse-btn weather-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expand weather' : 'Collapse weather'}
          >
            {isCollapsed ? '▸' : '▾'}
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
        <>
          <div className="experience-toggle weather-pager" role="tablist" aria-label="Weather pages">
            <button
              type="button"
              role="tab"
              aria-selected={page === 0}
              className={`experience-toggle-btn ${page === 0 ? 'active' : ''}`}
              onClick={() => setPage(0)}
            >
              Now
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={page === 1}
              className={`experience-toggle-btn ${page === 1 ? 'active' : ''}`}
              onClick={() => setPage(1)}
            >
              Radar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={page === 2}
              className={`experience-toggle-btn ${page === 2 ? 'active' : ''}`}
              onClick={() => setPage(2)}
            >
              Hourly
            </button>
          </div>

          {page === 0 ? (
            <div className="weather-page weather-page--now">
              <div className="weather-now">
                <span className="weather-now-icon" aria-hidden="true">
                  {condition?.icon}
                </span>
                <div className="weather-now-main">
                  <span className="weather-now-temp">{Math.round(data.current.temperature)}°</span>
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

          {page === 1 ? (
            weather.coords ? (
              <section className="weather-section weather-page weather-page--radar">
                <h4 className="weather-section-title">Radar</h4>
                <RadarMap coords={weather.coords} />
              </section>
            ) : (
              <p className="sheets-meta">Location unavailable — radar needs your position.</p>
            )
          ) : null}

          {page === 2 ? (
            <section className="weather-section weather-page weather-page--hourly">
              <h4 className="weather-section-title">Hourly · temp &amp; precipitation</h4>
              <HourlyChart points={data.hourly} />
            </section>
          ) : null}
        </>
      ) : null}
      </div>
    </article>
  )
}

export default WeatherCard
