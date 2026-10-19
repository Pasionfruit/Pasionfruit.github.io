import { useEffect, useState } from 'react'
import { elapsedSince, TOGETHER_SINCE, type ElapsedParts } from './elapsed'

const UNITS: { key: keyof ElapsedParts; singular: string; plural: string }[] = [
  { key: 'years', singular: 'Year', plural: 'Years' },
  { key: 'months', singular: 'Month', plural: 'Months' },
  { key: 'days', singular: 'Day', plural: 'Days' },
  { key: 'hours', singular: 'Hour', plural: 'Hours' },
  { key: 'minutes', singular: 'Minute', plural: 'Minutes' },
  { key: 'seconds', singular: 'Second', plural: 'Seconds' },
]

export function RelationshipClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const elapsed = elapsedSince(TOGETHER_SINCE, now)

  return (
    <article className="ciara-card ciara-clock">
      <p className="ciara-since">Together since 11:00 PM, November 19, 2022</p>
      <dl className="ciara-clock-grid" aria-label="Time together">
        {UNITS.map((unit) => (
          <div className="ciara-clock-unit" key={unit.key}>
            <dt>{elapsed[unit.key] === 1 ? unit.singular : unit.plural}</dt>
            <dd>{String(elapsed[unit.key]).padStart(2, '0')}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
