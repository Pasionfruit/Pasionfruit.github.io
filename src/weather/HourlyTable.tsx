import type { HourlyPoint } from './openMeteo'

const DEGREE = '\u00b0'

function hourText(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric' })
}

function dayText(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

/**
 * The next 24 hours as a grid: hours run across the top (the x axis), and the
 * temperature and rain chance are the rows beneath (the y values). The day is
 * named only where it changes. The grid scrolls sideways inside the card.
 */
export function HourlyTable({ points }: { points: HourlyPoint[] }) {
  const columns = points.map((point, index) => {
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
        <caption className="sr-only">Hourly temperature and rain chance for the next 24 hours</caption>
        <thead>
          <tr>
            <th scope="col" className="row-label">
              <span className="sr-only">Measure</span>
            </th>
            {columns.map(({ point, date, valid, day, showDay }) => (
              <th scope="col" key={point.time} className="hour">
                {valid ? (
                  <>
                    {showDay ? <span className="hour-day">{day}</span> : null}
                    {hourText(date)}
                  </>
                ) : (
                  '—'
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="row-label">Temp</th>
            {columns.map(({ point }) => (
              <td key={point.time} className="num">{`${Math.round(point.temperature)}${DEGREE}`}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="row-label">Rain chance</th>
            {columns.map(({ point }) => (
              <td key={point.time} className="num">{`${Math.round(point.precipitationProbability)}%`}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default HourlyTable
