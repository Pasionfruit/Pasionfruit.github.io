import { LineChart } from './LineChart'
import {
  PERIOD_DAYS, PERIOD_START, acneTotal, consistency, inRange, mean, num, periodDay, todayLocal, weeklyContent, weeklyVolume, type DateRange,
} from './analytics'
import type { ProgressData } from './useProgressData'

const avg = (n: number | null, digits = 1) => (n === null ? '—' : String(Math.round(n * 10 ** digits) / 10 ** digits))

export function OverviewTab({ data, range }: { data: ProgressData; range: DateRange }) {
  const rows = data.checkins.filter((c) => inRange(c.date, range))
  const series = (pick: (c: (typeof rows)[number]) => number | null) =>
    rows.flatMap((c) => {
      const y = pick(c)
      return y === null ? [] : [{ x: c.date, y }]
    })
  const acts = data.activities.filter((a) => inRange(a.date, range))
  const volume = weeklyVolume(acts)
  const kept = consistency(acts, range)
  const content = weeklyContent(data.content).filter((w) => w.week >= range.from.slice(0, 8) + '01' && w.week <= range.to)
  const today = todayLocal()
  const day = periodDay(today)
  const logged = data.checkins.some((c) => c.date === today)

  const timeTotals = [
    { label: 'Training', value: rows.reduce((n, c) => n + (num(c.min_training) ?? 0), 0), color: 'var(--page-accent)' },
    { label: 'Content', value: rows.reduce((n, c) => n + (num(c.min_content) ?? 0), 0), color: '#f59e0b' },
    { label: 'Leisure', value: rows.reduce((n, c) => n + (num(c.min_leisure) ?? 0), 0), color: '#8b5cf6' },
  ]
  const timeSum = timeTotals.reduce((n, t) => n + t.value, 0)

  return (
    <div className="pg-stack">
      <p className="sheets-meta">
        {day === null ? `The 90-day run starts ${PERIOD_START}.` : day <= PERIOD_DAYS ? `Day ${day} of ${PERIOD_DAYS}.` : `Day ${day}, past the first ${PERIOD_DAYS}. Tracking continues.`}{' '}
        {logged ? 'Today is logged.' : 'Today is not logged yet.'}
      </p>

      <div className="pg-tiles">
        <div><b>{avg(mean(rows.map(acneTotal)))}</b><span>avg active acne</span></div>
        <div><b>{kept.activeDays}</b><span>days trained of {kept.days}</span></div>
        <div><b>{data.content.filter((c) => c.status === 'published' && c.post_date && inRange(c.post_date, range)).length}</b><span>videos posted</span></div>
        <div><b>{avg(mean(rows.map((c) => num(c.sleep_h))))}</b><span>avg sleep (h)</span></div>
      </div>

      <h4>Skin</h4>
      <div className="pg-charts">
        <LineChart title="Active acne" series={[{ label: 'Total', color: 'var(--danger)', points: series(acneTotal) }]} />
        <LineChart title="Redness & scars (1–5)" series={[
          { label: 'Redness', color: '#f97316', points: series((c) => num(c.redness)) },
          { label: 'Scars', color: '#8b5cf6', points: series((c) => num(c.scar)) },
        ]} />
      </div>

      <h4>Fitness</h4>
      <div className="pg-charts">
        <LineChart title="Weekly training hours" series={[{ label: 'Hours', color: 'var(--page-accent)', points: volume.map((w) => ({ x: w.week, y: w.minutes / 60 })) }]} />
      </div>

      <h4>Content</h4>
      <div className="pg-charts">
        <LineChart title="Posts per week" format={(n) => String(Math.round(n))} series={[{ label: 'Posts', color: 'var(--page-accent)', points: content.map((w) => ({ x: w.week, y: w.posts })) }]} />
        <LineChart title="Production hours per week" series={[{ label: 'Hours', color: '#f59e0b', points: content.map((w) => ({ x: w.week, y: w.hours })) }]} />
      </div>

      <h4>Lifestyle</h4>
      <div className="pg-charts">
        <LineChart title="Sleep (h) & energy (1–5)" series={[
          { label: 'Sleep', color: '#3b82f6', points: series((c) => num(c.sleep_h)) },
          { label: 'Energy', color: '#10b981', points: series((c) => num(c.energy)) },
        ]} />
        <LineChart title="Nutrition (g)" format={(n) => String(Math.round(n))} series={[
          { label: 'Sugar', color: 'var(--danger)', points: series((c) => num(c.sugar_g)) },
          { label: 'Protein', color: '#10b981', points: series((c) => num(c.protein_g)) },
        ]} />
      </div>

      <h4>Where the time went</h4>
      {timeSum === 0 ? <p className="sheets-meta">Log training, content and leisure minutes in the check-in.</p> : (
        <div>
          <div className="pg-bar" role="img" aria-label={timeTotals.map((t) => `${t.label} ${Math.round(t.value / 60)} hours`).join(', ')}>
            {timeTotals.map((t) => <span key={t.label} style={{ width: `${(t.value / timeSum) * 100}%`, background: t.color }} />)}
          </div>
          <p className="pg-legend">
            {timeTotals.map((t) => <span key={t.label}><i style={{ background: t.color }} />{t.label} {Math.round((t.value / 60) * 10) / 10}h ({Math.round((t.value / timeSum) * 100)}%)</span>)}
          </p>
        </div>
      )}
    </div>
  )
}
