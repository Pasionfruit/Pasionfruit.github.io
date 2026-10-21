import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, RefreshCw } from 'lucide-react'
import { getGarminHealth, getTrainingRecords } from '../data/sheets/repositories'
import type { GarminHealthRecord, TrainingRecord } from '../data/sheets/types'
import { WorkoutText } from './WorkoutText'
import { describeGarminActivity, pairPlanWithGarmin, toDateOnlyKey } from './workoutsOfDay'

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

  /** A failed read keeps what is already on screen rather than blanking it. */
  async function loadDailyData() {
    const [training, garmin] = await Promise.allSettled([getTrainingRecords(), getGarminHealth()])
    if (training.status === 'fulfilled') setTrainingRows(training.value)
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

  const hasWorkouts = todaysWorkouts.planned.length > 0 || todaysWorkouts.unplanned.length > 0

  return (
    <article className={`info-card home-todoist-card sheets-card${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
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
        <p className="sheets-meta">Workout(s) of the Day</p>

        {isLoading ? <p className="sheets-meta">Loading training...</p> : null}

        {!isLoading && hasWorkouts ? (
          <div className="study-today-shell">
            <table className="study-today-table">
              <thead>
                <tr>
                  <th>Workout</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {todaysWorkouts.planned.map(({ workout, isPlanned, activity }, index) => (
                  <tr key={index === 0 ? 'morning' : 'evening'}>
                    <td>
                      <WorkoutText value={workout} empty={index === 0 ? 'Morning —' : 'Evening —'} />
                    </td>
                    <td className="study-complete-cell">
                      {activity ? (
                        <span>
                          <Check size={12} aria-hidden="true" /> {describeGarminActivity(activity)}
                        </span>
                      ) : (
                        <span>{isPlanned ? 'Not yet' : '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {todaysWorkouts.unplanned.map((activity, index) => (
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

        {!isLoading && !hasWorkouts ? <p className="sheets-meta">No workout scheduled for today.</p> : null}

        {!isLoading ? <p className="sheets-meta">Completed is read from Garmin, which syncs at 9 AM and 9 PM.</p> : null}

        {garminError ? <p className="sheets-error">{garminError}</p> : null}
      </div>
    </article>
  )
}

export default TrainingOfDayCard
