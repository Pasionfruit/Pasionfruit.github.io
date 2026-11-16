import { addDaysToKey } from '../data/todoist/dates'
import { acneTotal, correlations, formatPace, inRange, mean, num, runPoints, todayLocal, weeklySummaries, windows, type DateRange } from './analytics'
import type { Checkin } from './client'
import type { ProgressData } from './useProgressData'

const fmt = (n: number | null, digits = 1) => (n === null ? '—' : String(Math.round(n * 10 ** digits) / 10 ** digits))

function WindowRow({ label, rows, pick, digits }: { label: string; rows: Checkin[]; pick: (c: Checkin) => number | null; digits?: number }) {
  const w = windows(rows, pick, todayLocal())
  return (
    <tr><th scope="row">{label}</th><td>{fmt(w.d30, digits)}</td><td>{fmt(w.d60, digits)}</td><td>{fmt(w.d90, digits)}</td></tr>
  )
}

export function InsightsTab({ data, range }: { data: ProgressData; range: DateRange }) {
  const rows = data.checkins.filter((c) => inRange(c.date, range))
  const weeks = weeklySummaries(rows).slice(-8).reverse()
  const found = correlations(rows)
  const runs = runPoints(data.activities)
  /** Average pace at 140–155 bpm for runs in the window (today − to, today − from]. */
  const avgPace = (from: number, to: number) => {
    const today = todayLocal()
    const lo = addDaysToKey(today, -to)
    const hi = addDaysToKey(today, -from)
    const pts = runs.filter((p) => p.date > lo && p.date <= hi && p.avgHr >= 140 && p.avgHr <= 155)
    return mean(pts.map((p) => p.paceMinPerMile))
  }
  const paceNow = avgPace(0, 30)
  const pacePrev = avgPace(30, 60)

  return (
    <div className="pg-stack">
      <section>
        <h4>30 / 60 / 90-day averages</h4>
        <div className="pg-table-wrap">
          <table className="pg-table">
            <thead><tr><th /><th>30d</th><th>60d</th><th>90d</th></tr></thead>
            <tbody>
              <WindowRow label="Active acne" rows={data.checkins} pick={acneTotal} />
              <WindowRow label="Redness" rows={data.checkins} pick={(c) => num(c.redness)} />
              <WindowRow label="Scar texture" rows={data.checkins} pick={(c) => num(c.scar)} />
              <WindowRow label="Sleep (h)" rows={data.checkins} pick={(c) => num(c.sleep_h)} />
              <WindowRow label="Energy" rows={data.checkins} pick={(c) => num(c.energy)} />
              <WindowRow label="Sugar (g)" rows={data.checkins} pick={(c) => num(c.sugar_g)} digits={0} />
              <WindowRow label="Training (min/day)" rows={data.checkins} pick={(c) => num(c.min_training)} digits={0} />
              <WindowRow label="Content (min/day)" rows={data.checkins} pick={(c) => num(c.min_content)} digits={0} />
            </tbody>
          </table>
        </div>
        <p className="sheets-meta">
          Run pace at 140–155 bpm: {paceNow === null ? '—' : `${formatPace(paceNow)}/mi`} last 30 days vs {pacePrev === null ? '—' : `${formatPace(pacePrev)}/mi`} the 30 before.
        </p>
      </section>

      <section>
        <h4>Weekly summaries</h4>
        {weeks.length === 0 ? <p className="sheets-meta">Log a few days to see weekly summaries.</p> : (
          <div className="pg-table-wrap">
            <table className="pg-table">
              <thead><tr><th>Week of</th><th>Days</th><th>Acne</th><th>Skincare</th><th>Sleep</th><th>Energy</th><th>Sugar</th><th>Protein</th></tr></thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week}>
                    <th scope="row">{w.week.slice(5)}</th><td>{w.checkins}</td><td>{fmt(w.acne)}</td><td>{w.skincareDays}/{w.checkins}</td>
                    <td>{fmt(w.sleep)}</td><td>{fmt(w.energy)}</td><td>{fmt(w.sugar, 0)}</td><td>{fmt(w.protein, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4>Possible patterns</h4>
        <p className="sheets-meta">Patterns in your own logs. They can be coincidence or have other causes; none of these prove that one thing drives another.</p>
        <ul className="pg-list pg-notes">
          {found.map((c) => <li key={c.id}><strong>{c.label}</strong><span>{c.reading}</span></li>)}
        </ul>
      </section>
    </div>
  )
}
