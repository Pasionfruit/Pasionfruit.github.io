import { useMemo, useState } from 'react'
import { sportOf } from '../admin/training/activities'
import { TrainingPrs } from '../admin/garmin/TrainingPrs'
import { saveRow } from './client'
import { LineChart } from './LineChart'
import {
  activityKey, consistency, formatPace, inRange, minutesOf, num, paceAtHeartRate, runPoints, todayLocal, weeklyVolume,
  type DateRange,
} from './analytics'
import { daysBetween } from './analytics'
import type { ProgressData } from './useProgressData'

const SPORTS = [
  { id: 'all', label: 'All' },
  { id: 'run', label: 'Running' },
  { id: 'bike', label: 'Cycling' },
  { id: 'swim', label: 'Swimming' },
  { id: 'other', label: 'Weights & other' },
] as const

export function TrainingTab({ idToken, data, range, onChanged }: { idToken: string; data: ProgressData; range: DateRange; onChanged: () => void }) {
  const [sport, setSport] = useState<(typeof SPORTS)[number]['id']>('all')
  const [low, setLow] = useState('140')
  const [high, setHigh] = useState('155')
  const [error, setError] = useState('')

  const inView = useMemo(
    () => data.activities.filter((a) => inRange(a.date, range) && (sport === 'all' || sportOf(a.activity_type) === sport)),
    [data.activities, range, sport],
  )
  const weeks = weeklyVolume(inView)
  const kept = consistency(inView, range)
  const runs = runPoints(data.activities.filter((a) => inRange(a.date, range)))
  const band = paceAtHeartRate(runs, Number(low) || 0, Number(high) || 999)
  const rpeBy = new Map(data.rpe.map((r) => [r.workout_key, r.rpe]))
  const upcoming = data.events
    .filter((e) => e.event_date >= todayLocal())
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  async function setRpe(key: string, value: string) {
    setError('')
    try {
      await saveRow(idToken, 'progress_workout_rpe', { workout_key: key, rpe: value, updated_at: new Date().toISOString() })
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save effort.')
    }
  }

  return (
    <div className="pg-stack">
      <div className="pg-subtabs" role="group" aria-label="Sport">
        {SPORTS.map((s) => (
          <button key={s.id} type="button" className={sport === s.id ? 'is-on' : ''} aria-pressed={sport === s.id} onClick={() => setSport(s.id)}>{s.label}</button>
        ))}
      </div>

      <div className="pg-tiles">
        <div><b>{Math.round(inView.reduce((n, a) => n + minutesOf(a), 0) / 60 * 10) / 10}</b><span>hours</span></div>
        <div><b>{Math.round(inView.reduce((n, a) => n + (num(a.distance_mi) ?? 0), 0) * 10) / 10}</b><span>miles</span></div>
        <div><b>{inView.length}</b><span>sessions</span></div>
        <div><b>{kept.pct}%</b><span>days trained ({kept.activeDays}/{kept.days})</span></div>
      </div>

      <LineChart title="Weekly training hours" series={[{ label: 'Hours', color: 'var(--page-accent)', points: weeks.map((w) => ({ x: w.week, y: w.minutes / 60 })) }]} />

      <section>
        <h4>Running efficiency</h4>
        <LineChart title={`Pace at ${low}–${high} bpm (min/mi)`} format={formatPace} emptyText="No runs with heart rate in this band yet." series={[{ label: 'Pace', color: '#10b981', points: band.map((w) => ({ x: w.week, y: w.pace })) }]} />
        <details className="pg-details">
          <summary>Change heart-rate band</summary>
          <div className="pg-grid pg-two pg-band">
            <label className="pg-field"><span>From (bpm)</span><input type="number" inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value)} /></label>
            <label className="pg-field"><span>To (bpm)</span><input type="number" inputMode="numeric" value={high} onChange={(e) => setHigh(e.target.value)} /></label>
          </div>
        </details>
      </section>

      <section>
        <h4>Recent sessions · rate effort</h4>
        <ul className="pg-list">
          {[...inView].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((a) => {
            const key = activityKey(a)
            const pace = sportOf(a.activity_type) === 'run' && num(a.distance_mi) ? formatPace((num(a.duration_min) ?? 0) / (num(a.distance_mi) ?? 1)) : ''
            return (
              <li key={key}>
                <span>
                  {a.date.slice(5, 10)} · {a.title || a.activity_type} · {Math.round(minutesOf(a))} min
                  {num(a.distance_mi) ? ` · ${a.distance_mi} mi` : ''}{pace ? ` · ${pace}/mi` : ''}{a.avg_hr ? ` · ${a.avg_hr} bpm` : ''}
                </span>
                <select aria-label={`Effort for ${a.title || a.activity_type} on ${a.date.slice(0, 10)}`} value={rpeBy.get(key) ?? ''} onChange={(e) => setRpe(key, e.target.value)}>
                  <option value="">RPE</option>
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                </select>
              </li>
            )
          })}
          {inView.length === 0 && <li className="sheets-meta">No sessions in this range. Garmin and Apple workouts import automatically.</li>}
        </ul>
        {error && <p className="pg-error" role="alert">{error}</p>}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h4>Next race</h4>
          <ul className="pg-list">
            {upcoming.slice(0, 2).map((e) => (
              <li key={e.event_id}><span>{e.event_name}</span><b>{daysBetween(todayLocal(), e.event_date)} days</b></li>
            ))}
          </ul>
        </section>
      )}

      <details className="pg-details">
        <summary>Personal records</summary>
        <TrainingPrs />
      </details>
    </div>
  )
}
