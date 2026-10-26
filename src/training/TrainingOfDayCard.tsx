import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, RefreshCw, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getGarminHealth, getTrainingRecords } from '../data/sheets/repositories'
import type { GarminHealthRecord, TrainingRecord } from '../data/sheets/types'
import { tomorrowKey } from '../data/todoist/dates'
import { WorkoutText } from './WorkoutText'
import { describeGarminActivity, pairPlanWithGarmin, toDateOnlyKey } from './workoutsOfDay'
import { mergeTrainingLog } from './trainingPlan'

/**
 * Today's planned training beside what Garmin recorded. Completion is whatever
 * Garmin logged today, not a box ticked here; refreshing re-reads the sheet but
 * cannot make a new watch activity appear before the desktop sync runs.
 */
export function TrainingOfDayCard({ title }: { title: string }) {
  const [trainingRows, setTrainingRows] = useState<TrainingRecord[]>([])
  const [garminRows, setGarminRows] = useState<GarminHealthRecord[]>([])
  const [garminError, setGarminError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [day, setDay] = useState<'today' | 'tomorrow'>('today')

  const todayKey = toDateOnlyKey(new Date().toISOString())

  const todaysTrainingRecord = useMemo(
    () => trainingRows.find((row) => toDateOnlyKey(row.date) === todayKey),
    [trainingRows, todayKey],
  )

  const todaysWorkouts = useMemo(
    () =>
      pairPlanWithGarmin(
        todaysTrainingRecord,
        garminRows.filter((row) => String(row.date ?? '').slice(0, 10) === todayKey),
      ),
    [todaysTrainingRecord, garminRows, todayKey],
  )

  // Tomorrow is the plan alone: nothing has been recorded for it yet.
  const tomorrowsWorkouts = useMemo(
    () =>
      pairPlanWithGarmin(
        trainingRows.find((row) => toDateOnlyKey(row.date) === tomorrowKey()),
        [],
      ),
    [trainingRows],
  )

  /** A failed read keeps what is already on screen rather than blanking it. */
  async function loadDailyData() {
    const [training, garmin] = await Promise.allSettled([getTrainingRecords(), getGarminHealth()])
    if (training.status === 'fulfilled') setTrainingRows(mergeTrainingLog(training.value))
    if (garmin.status === 'fulfilled') setGarminRows(garmin.value)
    setGarminError(garmin.status === 'rejected' ? 'Could not load Garmin activities.' : '')
    setIsLoading(false)
  }

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    await loadDailyData()
    setIsRefreshing(false)
  }

  useEffect(() => {
    // Fetch-on-mount: state only updates after the awaited fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDailyData()
  }, [])

  const isTomorrow = day === 'tomorrow'
  const shownWorkouts = isTomorrow ? tomorrowsWorkouts : todaysWorkouts
  const hasWorkouts = shownWorkouts.planned.length > 0 || shownWorkouts.unplanned.length > 0

  return (
    <article className={`info-card home-todoist-card sheets-card${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          <Link to="/weekly-reset" className="admin-quick-link" aria-label="Weekly reset" title="Weekly reset">
            <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="section-collapse-btn"
            onClick={() => void handleRefresh()}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh from Garmin"
            title="Refresh from Garmin"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="section-collapse-btn home-todoist-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="home-todoist-collapsible">
        <div className="experience-toggle todoist-day-toggle" role="tablist" aria-label="Workouts by day">
          {(['today', 'tomorrow'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={day === id}
              className={`experience-toggle-btn ${day === id ? 'active' : ''}`}
              onClick={() => setDay(id)}
            >
              {id === 'today' ? 'Today' : 'Tomorrow'}
            </button>
          ))}
        </div>

        <p className="sheets-meta">{isTomorrow ? 'Workout(s) planned for tomorrow' : 'Workout(s) of the Day'}</p>

        {isLoading ? <p className="sheets-meta">Loading training...</p> : null}

        {!isLoading && hasWorkouts ? (
          <div className="study-today-shell">
            <table className="study-today-table">
              <thead>
                <tr>
                  <th>Workout</th>
                  {isTomorrow ? null : <th>Completed</th>}
                </tr>
              </thead>
              <tbody>
                {shownWorkouts.planned.map(({ workout, isPlanned, activity }, index) => (
                  <tr key={index === 0 ? 'morning' : 'evening'}>
                    <td>
                      <WorkoutText value={workout} empty={index === 0 ? 'Morning —' : 'Evening —'} />
                    </td>
                    {isTomorrow ? null : (
                    <td className="study-complete-cell">
                      {activity ? (
                        <span>
                          <Check size={12} aria-hidden="true" /> {describeGarminActivity(activity)}
                        </span>
                      ) : (
                        <span>{isPlanned ? 'Not yet' : '—'}</span>
                      )}
                    </td>
                    )}
                  </tr>
                ))}
                {shownWorkouts.unplanned.map((activity, index) => (
                  <tr key={activity.activity_id || `unplanned-${index}`}>
                    <td className="sheets-meta">Unplanned</td>
                    <td className="study-complete-cell">
                      <span>
                        <Check size={12} aria-hidden="true" /> {describeGarminActivity(activity)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && !hasWorkouts ? <p className="sheets-meta">No workout scheduled for {isTomorrow ? 'tomorrow' : 'today'}.</p> : null}

        {!isLoading && !isTomorrow ? <p className="sheets-meta">Completed is read from Garmin, which syncs at 9 AM and 9 PM.</p> : null}

        {garminError ? <p className="sheets-error">{garminError}</p> : null}
      </div>
    </article>
  )
}

export default TrainingOfDayCard
