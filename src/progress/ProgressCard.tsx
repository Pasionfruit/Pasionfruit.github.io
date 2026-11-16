import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CheckinTab } from './CheckinTab'
import { ContentTab } from './ContentTab'
import { InsightsTab } from './InsightsTab'
import { OverviewTab } from './OverviewTab'
import { SkinTab } from './SkinTab'
import { TrainingTab } from './TrainingTab'
import { PERIOD_END, PERIOD_START, lastDays, todayLocal, type DateRange } from './analytics'
import { useProgressData } from './useProgressData'
import './progress.css'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'skin', label: 'Skin' },
  { id: 'training', label: 'Training' },
  { id: 'content', label: 'Content' },
  { id: 'trends', label: 'Trends' },
] as const
type TabId = (typeof TABS)[number]['id']

type Preset = '30' | '90' | 'period' | 'all'

/**
 * The 90-day Progress tracker (skin, endurance, content), shown on the Projects
 * page under Daily wellness. One daily check-in feeds every chart; Garmin and Apple
 * workouts and watch sleep are imported, not retyped.
 */
export function ProgressCard({ title, idToken }: { title: string; idToken: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<TabId>('today')
  const [preset, setPreset] = useState<Preset>('30')
  const { data, status, error, reload } = useProgressData(idToken)

  const range = useMemo<DateRange>(() => {
    const today = todayLocal()
    if (preset === 'period') return { from: PERIOD_START, to: PERIOD_END }
    if (preset === 'all') return { from: '2000-01-01', to: '2999-12-31' }
    return lastDays(Number(preset), today)
  }, [preset])

  return (
    <article className="info-card admin-card pg-card admin-card-wide">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          <button type="button" className="secondary-action" aria-expanded={!collapsed} aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} onClick={() => setCollapsed((v) => !v)}>
            <ChevronDown size={16} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="pg-tabs" role="tablist" aria-label="Progress sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab !== 'today' && (
            <label className="pg-range">
              <span className="sheets-meta">Show</span>
              <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="period">The 90-day run</option>
                <option value="all">Everything</option>
              </select>
            </label>
          )}

          {status === 'loading' && <p className="sheets-meta">Loading…</p>}
          {status === 'error' && (
            <p className="pg-error" role="alert">
              {error} If this is the first run, apply workers/db/progress.sql and redeploy the db Worker.
            </p>
          )}
          {status === 'ready' && (
            <div className="pg-body">
              {tab === 'today' && <CheckinTab idToken={idToken} data={data} onSaved={reload} />}
              {tab === 'skin' && <SkinTab idToken={idToken} data={data} range={range} onChanged={reload} />}
              {tab === 'training' && <TrainingTab idToken={idToken} data={data} range={range} onChanged={reload} />}
              {tab === 'content' && <ContentTab idToken={idToken} data={data} range={range} onChanged={reload} />}
              {tab === 'trends' && (
                <div className="pg-stack">
                  <OverviewTab data={data} range={range} />
                  <details className="pg-details">
                    <summary>Averages, weekly summaries and patterns</summary>
                    <InsightsTab data={data} range={range} />
                  </details>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  )
}
