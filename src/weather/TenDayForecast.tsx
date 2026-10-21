import { useEffect, useState, type FormEvent } from 'react'
import { Droplet } from 'lucide-react'
import { describeWeather, geocodeCity, getDailyForecast, type Coords, type DailyPoint } from './openMeteo'
import { WEATHER_ICONS } from './weatherIcons'

const DEGREE = '\u00b0'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** A date-only key parsed as a local calendar day, so it never shifts to the day before. */
function localDay(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayLabel(point: DailyPoint, todayKey: string) {
  if (point.date === todayKey) return 'Today'
  return localDay(point.date).toLocaleDateString(undefined, { weekday: 'short' })
}

/**
 * Ten days of highs, lows, conditions and rain chance, for the device's current
 * location or for a city the user types in. Shown in the same card row as the
 * hourly forecast.
 */
export function TenDayForecast({
  coords,
  place,
  onLocate,
}: {
  coords: Coords | null
  place: string
  onLocate: () => void
}) {
  const [mode, setMode] = useState<'current' | 'city'>('current')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState<DailyPoint[]>([])
  const [error, setError] = useState('')

  async function show(target: Coords, name: string) {
    setStatus('loading')
    setError('')
    try {
      const forecast = await getDailyForecast(target)
      setDays(forecast)
      setLabel(name)
      setStatus('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the forecast.')
      setStatus('error')
    }
  }

  const latitude = coords?.latitude
  const longitude = coords?.longitude

  useEffect(() => {
    if (mode !== 'current' || latitude === undefined || longitude === undefined) return
    // Follows the device's location: loads as soon as it is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void show({ latitude, longitude }, place || 'Your location')
    // `show` is rebuilt each render; the coordinates are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, latitude, longitude])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = query.trim()
    if (!name) return

    setMode('city')
    setStatus('loading')
    setError('')
    try {
      const found = await geocodeCity(name)
      if (!found) {
        setError(`No city found for “${name}”.`)
        setStatus('error')
        return
      }
      await show(found.coords, found.label)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to search for that city.')
      setStatus('error')
    }
  }

  function useCurrentLocation() {
    setMode('current')
    setError('')
    if (latitude === undefined || longitude === undefined) {
      onLocate()
    }
  }

  const todayKey = dayKeyOf(new Date())

  return (
    <section className="weather-section">
      <h4 className="weather-section-title">{status === 'ready' && label ? label : 'Next 10 days'}</h4>

      <form className="weather-city-form" onSubmit={(event) => void handleSearch(event)}>
        <input
          className="task-input"
          value={query}
          placeholder="City"
          aria-label="City"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="task-btn" disabled={!query.trim()}>
          Search
        </button>
        <button type="button" className="task-btn" onClick={useCurrentLocation}>
          Use my location
        </button>
      </form>

      {status === 'loading' ? <p className="sheets-meta">Loading the forecast…</p> : null}
      {error ? <p className="sheets-error">{error}</p> : null}
      {mode === 'current' && latitude === undefined && status !== 'error' ? (
        <p className="sheets-meta">Waiting for your location — allow it, or search for a city.</p>
      ) : null}

      {status === 'ready' ? (
        <ol className="weather-hour-row" aria-label="Next 10 days">
          {days.map((point) => {
            const condition = describeWeather(point.weatherCode, true)
            const Icon = WEATHER_ICONS[condition.icon]
            const high = Math.round(point.high)
            const low = Math.round(point.low)
            const chance = Math.round(point.precipitationProbability)
            const day = dayLabel(point, todayKey)

            return (
              <li
                key={point.date}
                className="weather-hour-card"
                aria-label={`${day}, ${condition.label}, high ${high}${DEGREE}, low ${low}${DEGREE}, ${chance}% chance of rain`}
              >
                <span className="weather-hour-time" aria-hidden="true">
                  {day}
                </span>
                <Icon className="weather-hour-icon" size={24} strokeWidth={1.5} aria-hidden="true" />
                <span className="weather-hour-temp" aria-hidden="true">
                  {`${high}${DEGREE} / ${low}${DEGREE}`}
                </span>
                <span className="weather-hour-rain" aria-hidden="true">
                  <Droplet size={11} aria-hidden="true" />
                  {`${chance}%`}
                </span>
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}

export default TenDayForecast
