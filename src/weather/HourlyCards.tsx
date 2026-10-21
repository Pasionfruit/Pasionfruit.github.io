import { Droplet } from 'lucide-react'
import { describeWeather, type HourlyPoint } from './openMeteo'
import { WEATHER_ICONS } from './weatherIcons'

const DEGREE = '\u00b0'

function hourText(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric' })
}

/**
 * The next 24 hours as a row of cards, one per hour: the hour, the condition's
 * icon, the temperature in Fahrenheit, and the chance of rain. The row scrolls
 * sideways inside the card.
 */
export function HourlyCards({ points }: { points: HourlyPoint[] }) {
  return (
    <ol className="weather-hour-row" aria-label="Next 24 hours">
      {points.map((point) => {
        const date = new Date(point.time)
        const valid = !Number.isNaN(date.getTime())
        const condition = describeWeather(point.weatherCode, point.isDay)
        const Icon = WEATHER_ICONS[condition.icon]
        const hour = valid ? hourText(date) : ''
        const temperature = Math.round(point.temperature)
        const chance = Math.round(point.precipitationProbability)

        return (
          <li
            key={point.time}
            className="weather-hour-card"
            aria-label={`${hour}, ${condition.label}, ${temperature}${DEGREE} Fahrenheit, ${chance}% chance of rain`}
          >
            <span className="weather-hour-time" aria-hidden="true">
              {valid ? hour : '—'}
            </span>
            <Icon className="weather-hour-icon" size={24} strokeWidth={1.5} aria-hidden="true" />
            <span className="weather-hour-temp" aria-hidden="true">{`${temperature}${DEGREE}F`}</span>
            <span className="weather-hour-rain" aria-hidden="true">
              <Droplet size={11} aria-hidden="true" />
              {`${chance}%`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default HourlyCards
