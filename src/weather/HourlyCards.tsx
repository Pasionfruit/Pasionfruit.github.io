import { Droplet } from 'lucide-react'
import { describeWeather, type HourlyPoint } from './openMeteo'
import { WEATHER_ICONS } from './weatherIcons'

const DEGREE = '\u00b0'

function hourText(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric' })
}

function dayText(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

/**
 * The next 24 hours as a row of cards, one per hour: the hour, the condition's
 * icon, the temperature in Fahrenheit, and the chance of rain. The day is named
 * on a card only where it changes. The row scrolls sideways inside the card.
 */
export function HourlyCards({ points }: { points: HourlyPoint[] }) {
  return (
    <ol className="weather-hour-row" aria-label="Next 24 hours">
      {points.map((point, index) => {
        const date = new Date(point.time)
        const valid = !Number.isNaN(date.getTime())
        const previousDate = index > 0 ? new Date(points[index - 1].time) : null
        const day = valid ? dayText(date) : ''
        const previousDay = previousDate && !Number.isNaN(previousDate.getTime()) ? dayText(previousDate) : ''
        const showDay = valid && day !== previousDay

        const condition = describeWeather(point.weatherCode, point.isDay)
        const Icon = WEATHER_ICONS[condition.icon]
        const hour = valid ? `${showDay ? `${day} ` : ''}${hourText(date)}` : ''
        const temperature = Math.round(point.temperature)
        const chance = Math.round(point.precipitationProbability)

        return (
          <li
            key={point.time}
            className="weather-hour-card"
            aria-label={`${hour}, ${condition.label}, ${temperature}${DEGREE} Fahrenheit, ${chance}% chance of rain`}
          >
            <span className="weather-hour-time" aria-hidden="true">
              {showDay ? <span className="weather-hour-day">{day}</span> : null}
              {valid ? hourText(date) : '—'}
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
