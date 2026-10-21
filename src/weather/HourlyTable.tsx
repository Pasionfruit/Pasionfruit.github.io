import type { HourlyPoint } from './openMeteo'

const DEGREE = '\u00b0'

function hourText(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric' })
}

function dayText(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

/**
 * The next 24 hours as a plain table. The day is named only where it changes,
 * so the hour column stays short; the table scrolls inside the card on a phone.
 */
export function HourlyTable({ points }: { points: HourlyPoint[] }) {
  // The day name is shown where it differs from the row above.
  const rows = points.map((point, index) => {
    const date = new Date(point.time)
    const valid = !Number.isNaN(date.getTime())
    const day = valid ? dayText(date) : ''
    const previousDate = index > 0 ? new Date(points[index - 1].time) : null
    const previousDay = previousDate && !Number.isNaN(previousDate.getTime()) ? dayText(previousDate) : ''
    return { point, date, valid, day, showDay: valid && day !== previousDay }
  })

  return (
    <div className="weather-hourly-scroll">
      <table className="weather-hourly-table">
        <caption className="sr-only">Hourly forecast for the next 24 hours</caption>
        <thead>
          <tr>
            <th scope="col">Hour</th>
            <th scope="col" className="num">Temp</th>
            <th scope="col" className="num">Rain chance</th>
            <th scope="col" className="num">Precip</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ point, date, valid, day, showDay }) => (
            <tr key={point.time}>
              <th scope="row" className="hour">
                {valid ? (
                  <>
                    {showDay ? <span className="hour-day">{day} </span> : null}
                    {hourText(date)}
                  </>
                ) : (
                  '—'
                )}
              </th>
              <td className="num">{`${Math.round(point.temperature)}${DEGREE}`}</td>
              <td className="num">{`${Math.round(point.precipitationProbability)}%`}</td>
              <td className="num">{`${point.precipitation.toFixed(2)} in`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default HourlyTable
