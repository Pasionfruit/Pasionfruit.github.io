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
  { id: 'overview', label: 'Overview' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'skin', label: 'Skin' },
  { id: 'training', label: 'Training' },
  { id: 'content', label: 'Content' },
  { id: 'insights', label: 'Insights' },
] as const
type TabId = (typeof TABS)[number]['id']

type Preset = '30' | '60' | '90' | 'period' | 'all' | 'custom'

/**
 * The 90-day Progress tracker (skin, endurance, content), shown on the Projects
 * page under Daily wellness. One daily check-in feeds every chart; Garmin and Apple
 * workouts and watch sleep are imported, not retyped.
 */
export function ProgressCard({ title, idToken }: { title: string; idToken: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<TabId>('overview')
  const [preset, setPreset] = useState<Preset>('90')
  const [custom, setCustom] = useState<DateRange>({ from: PERIOD_START, to: PERIOD_END })
  const { data, status, error, reload } = useProgressData(idToken)

  const range = useMemo<DateRange>(() => {
    const today = todayLocal()
    if (preset === 'custom') return custom
    if (preset === 'period') return { from: PERIOD_START, to: PERIOD_END }
    if (preset === 'all') return { from: '2000-01-01', to: '2999-12-31' }
    return lastDays(Number(preset), today)
  }, [preset, custom])

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
          <p className="sheets-meta">Progress · skin, endurance and content, 90 days from {PERIOD_START}</p>
          <div className="pg-tabs" role="tablist" aria-label="Progress sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab !== 'checkin' && (
            <div className="pg-range">
              {(['30', '60', '90', 'period', 'all', 'custom'] as Preset[]).map((p) => (
                <button key={p} type="button" className={preset === p ? 'is-on' : ''} aria-pressed={preset === p} onClick={() => setPreset(p)}>
                  {p === 'period' ? '90-day run' : p === 'all' ? 'All' : p === 'custom' ? 'Custom' : `${p}d`}
                </button>
              ))}
              {preset === 'custom' && (
                <>
                  <input type="date" aria-label="From" value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
                  <input type="date" aria-label="To" value={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
                </>
              )}
            </div>
          )}

          {status === 'loading' && <p className="sheets-meta">Loading…</p>}
          {status === 'error' && (
            <p className="pg-error" role="alert">
              {error} If this is the first run, apply workers/db/progress.sql and redeploy the db Worker.
            </p>
          )}
          {status === 'ready' && (
            <div className="pg-body">
              {tab === 'overview' && <OverviewTab data={data} range={range} />}
              {tab === 'checkin' && <CheckinTab idToken={idToken} data={data} onSaved={reload} />}
              {tab === 'skin' && <SkinTab idToken={idToken} data={data} range={range} onChanged={reload} />}
              {tab === 'training' && <TrainingTab idToken={idToken} data={data} range={range} onChanged={reload} />}
              {tab === 'content' && <ContentTab idToken={idToken} data={data} range={range} onChanged={reload} />}
              {tab === 'insights' && <InsightsTab data={data} range={range} />}
            </div>
          )}
        </>
      )}
    </article>
  )
}
