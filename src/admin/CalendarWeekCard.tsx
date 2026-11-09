import { useEffect, useMemo, useState } from 'react'
import { ConnectPanel } from './ConnectPanel'
import { HourlyCards } from '../weather/HourlyCards'
import { TenDayForecast } from '../weather/TenDayForecast'
import { RadarMap } from '../weather/RadarMap'
import type { WeatherHook } from '../weather/useWeather'
import '../weather/weather.css'
import { Pager } from '../components/Pager'
import { dayKey, eventDayKeys, eventTimeLabelForDay } from './calendarDays'
import { getCalendarEvents, type CalendarEventRecord } from '../data/sheets/repositories'
import type { ConnectionStatus } from './integrations/types'
import { getActiveTasks } from '../data/todoist/repositories'
import { dueDateKey } from '../data/todoist/dates'
import type { TodoistTask } from '../data/todoist/types'
import { isFilled, useMealPlan } from './meals/mealPlan'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_STORAGE_KEY = 'admin-calendar-month'

function readStoredMonth(): Date | null {
  try {
    const raw = window.localStorage.getItem(MONTH_STORAGE_KEY)
    if (!raw) return null

    const [year, month] = raw.split('-').map(Number)
    if (!year || !month) return null

    return new Date(year, month - 1, 1)
  } catch {
    return null
  }
}

function writeStoredMonth(month: Date) {
  try {
    const year = month.getFullYear()
    const monthNumber = String(month.getMonth() + 1).padStart(2, '0')
    window.localStorage.setItem(MONTH_STORAGE_KEY, `${year}-${monthNumber}`)
  } catch {
    // Nothing to do — the view opens on today's month next visit instead.
  }
}

function formatDayHeading(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) {
    return key
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Calendars are read by the Apps Script Web App, which runs as the owner. That
 * removes both browser obstacles at once: no Calendar scope on the site's OAuth
 * client, and no CORS problem on the iCloud `.ics` feed, which is fetched
 * server-side.
 */
function getStatus(idToken: string): ConnectionStatus {
  if (!import.meta.env.VITE_SHEETS_API_BASE_URL?.trim()) {
    return {
      state: 'not-configured',
      message: 'No Apps Script endpoint is configured for this build.',
      steps: ['Set VITE_SHEETS_API_BASE_URL to your deployed Apps Script Web App URL.'],
    }
  }

  if (!idToken) {
    return {
      state: 'needs-auth',
      message: 'Sign in with the admin Google account to read your calendars.',
      steps: ['Open /login and sign in.'],
    }
  }

  return { state: 'connected', message: 'Reading your Google and Apple calendars.', steps: [] }
}

/**
 * A month grid: compact day cells with a dot when something is on, and a
 * panel below it listing that day's events, tasks and meals on tap. Seven narrow columns fit a phone
 * without horizontal scrolling, which the previous week-strip layout could not
 * do.
 *
 * The viewed month is remembered in localStorage, the same idea as the sliding
 * session token: reopening the app lands back where you left off instead of
 * snapping to today's month every time. Collapsing is remembered the same way,
 * so a card folded away on the daily dashboard stays folded. The events still
 * load while collapsed, so the count in the header stays current.
 */
export function CalendarWeekCard({
  title,
  idToken,
  weather,
}: {
  title: string
  idToken: string
  weather: WeatherHook
}) {
  const status = getStatus(idToken)

  const [month, setMonth] = useState(() => {
    const stored = readStoredMonth()
    if (stored) return stored

    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [events, setEvents] = useState<CalendarEventRecord[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [appleConfigured, setAppleConfigured] = useState(true)
  const [isLoading, setIsLoading] = useState(status.state === 'connected')
  // Todoist tasks, so a selected day shows what is due as well as what is booked.
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  // The radar and hourly forecast share the card with the month grid.
  const [page, setPage] = useState<'month' | 'radar' | 'hourly' | 'days'>('month')

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  useEffect(() => {
    writeStoredMonth(month)
  }, [month])

  useEffect(() => {
    if (status.state !== 'connected') {
      return
    }

    let cancelled = false
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1)

    void (async () => {
      setIsLoading(true)

      try {
        const result = await getCalendarEvents(idToken, start, end)
        if (!cancelled) {
          setEvents(result.events)
          setErrors(result.errors)
          setAppleConfigured(result.appleConfigured)
        }
      } catch (caught) {
        if (!cancelled) {
          setEvents([])
          setErrors([caught instanceof Error ? caught.message : 'Unable to read calendars'])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status.state, idToken, month])

  useEffect(() => {
    if (!import.meta.env.VITE_TODOIST_API_TOKEN?.trim()) {
      return
    }

    let cancelled = false
    getActiveTasks()
      .then((rows) => {
        if (!cancelled) setTasks(rows)
      })
      .catch(() => {
        // The calendar still works without tasks.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const tasksByDay = useMemo(() => {
    const map: Record<string, TodoistTask[]> = {}
    const today = dayKey(new Date())

    for (const task of tasks) {
      const key = dueDateKey(task)
      if (!key) continue
      // Overdue work is still on today's plate.
      const day = key < today ? today : key
      map[day] = map[day] ?? []
      map[day].push(task)
    }

    return map
  }, [tasks])

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEventRecord[]> = {}

    // An event lands on every day it covers, not just the one it starts on.
    for (const event of events) {
      for (const key of eventDayKeys(event)) {
        map[key] = map[key] ?? []
        map[key].push(event)
      }
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return a.start.localeCompare(b.start)
      })
    }

    return map
  }, [events])

  // Leading blanks so the 1st lands on its weekday, then one cell per day.
  const cells = useMemo(() => {
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

    return [
      ...Array.from<null>({ length: firstWeekday }).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
  }, [month])

  const todayKey = dayKey(new Date())
  const selectedEvents = selectedDayKey ? (eventsByDay[selectedDayKey] ?? []) : []
  const mealPlan = useMealPlan()
  const selectedMeals = selectedDayKey ? (mealPlan[selectedDayKey] ?? []).filter(isFilled) : []
  const selectedTasks = selectedDayKey ? (tasksByDay[selectedDayKey] ?? []) : []

  return (
    <article className="info-card admin-card admin-card-wide">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          {status.state === 'connected' && !isLoading ? (
            <span className="admin-pill">
              {events.length} event{events.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </div>

        <>
          {errors.map((message) => (
            <p key={message} className="sheets-meta">
              {message}
            </p>
          ))}

          <div className="experience-toggle month-view-pager" role="tablist" aria-label="Month view pages">
            {(['month', 'radar', 'hourly', 'days'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={page === id}
                className={`experience-toggle-btn ${page === id ? 'active' : ''}`}
                onClick={() => setPage(id)}
              >
                {id === 'month' ? 'Calendar' : id === 'radar' ? 'Radar' : id === 'hourly' ? 'Hourly' : '10 Days'}
              </button>
            ))}
          </div>

          {page === 'radar' ? (
            weather.coords ? (
              <section className="weather-section">
                <h4 className="weather-section-title">Radar</h4>
                <RadarMap coords={weather.coords} />
              </section>
            ) : (
              <p className="sheets-meta">Location unavailable — radar needs your position.</p>
            )
          ) : null}

          {page === 'days' ? (
            <TenDayForecast coords={weather.coords} place={weather.place} onLocate={weather.retry} />
          ) : null}

          {page === 'hourly' ? (
            weather.data ? (
              <section className="weather-section">
                <h4 className="weather-section-title">Next 24 hours</h4>
                <HourlyCards points={weather.data.hourly} />
              </section>
            ) : (
              <p className="sheets-meta">The hourly forecast loads with the weather.</p>
            )
          ) : null}

          {page === 'month' ? (
            <>
          {status.state === 'connected' ? (
            <div className="month-calendar-shell admin-calendar-shell">
              <div className="month-calendar-header">
                <Pager
                  variant="title"
                  label={monthLabel}
                  prevLabel="Previous month"
                  nextLabel="Next month"
                  onPrev={() =>
                    setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                  }
                  onNext={() =>
                    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                  }
                />
              </div>

              <div className="month-calendar-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="month-calendar-grid" aria-label="Calendar view">
                {cells.map((day, index) => {
                  if (!day) {
                    return <span key={`blank-${index}`} className="month-calendar-empty" />
                  }

                  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayEvents = eventsByDay[key] ?? []
                  const dayTasks = tasksByDay[key] ?? []
                  const hasEvents = dayEvents.length > 0

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`month-calendar-day admin-calendar-day ${hasEvents ? 'has-events' : ''} ${key === todayKey ? 'is-today' : ''} ${key === selectedDayKey ? 'is-selected' : ''}`}
                      aria-pressed={key === selectedDayKey}
                      onClick={() => setSelectedDayKey(key === selectedDayKey ? null : key)}
                      aria-label={
                        (hasEvents
                          ? `${key} has ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                          : `${key} has no events`) +
                        (dayTasks.length > 0 ? `, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : '')
                      }
                    >
                      <span>{day}</span>
                      {hasEvents || dayTasks.length > 0 ? (
                        <span className="calendar-event-dots" aria-hidden="true">
                          {dayEvents.slice(0, 2).map((event, dotIndex) => (
                            <span
                              key={`${event.source}-${event.id}-${dotIndex}`}
                              className={`calendar-event-dot source-${event.source}`}
                            />
                          ))}
                          {dayTasks.length > 0 ? <span className="calendar-event-dot source-todoist" /> : null}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {isLoading ? <p className="sheets-meta">Loading events…</p> : null}

          {selectedDayKey ? (
            <section className="calendar-day-panel" aria-labelledby="admin-calendar-day-title">
              <div className="calendar-day-panel-head">
                <h4 id="admin-calendar-day-title">{formatDayHeading(selectedDayKey)}</h4>
                <button type="button" className="calendar-day-panel-close" onClick={() => setSelectedDayKey(null)}>
                  Close
                </button>
              </div>

              {selectedTasks.length > 0 ? (
                <>
                  <h5 className="calendar-dialog-section">Tasks</h5>
                  <ul className="admin-calendar-day-list">
                    {selectedTasks.map((task) => (
                      <li key={task.id} className="source-todoist">
                        <span className="calendar-event-title">{task.content}</span>
                        {dueDateKey(task) < todayKey ? <span className="calendar-event-source">Overdue</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {selectedEvents.length > 0 ? (
                <>
                  <h5 className="calendar-dialog-section">Events</h5>
                  <ul className="admin-calendar-day-list">
                    {selectedEvents.map((event) => (
                      <li key={`${event.source}-${event.id}`} className={`source-${event.source}`}>
                        <span className="calendar-event-time">{eventTimeLabelForDay(event, selectedDayKey)}</span>
                        <span className="calendar-event-title">{event.title}</span>
                        {event.location ? <span className="calendar-event-location">{event.location}</span> : null}
                        {event.calendarName ? <span className="calendar-event-source">{event.calendarName}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {selectedMeals.length > 0 ? (
                <>
                  <h5 className="calendar-dialog-section">Meals</h5>
                  <ul className="admin-calendar-day-list">
                    {selectedMeals.map((meal) => (
                      <li key={meal.id} className="source-meal">
                        <span className="calendar-event-title">{meal.title || 'Meal'}</span>
                        {meal.dishes.length > 0 ? (
                          <span className="calendar-event-location">{meal.dishes.join(', ')}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {selectedEvents.length === 0 && selectedTasks.length === 0 && selectedMeals.length === 0 ? (
                <p className="sheets-meta">Nothing scheduled.</p>
              ) : null}
            </section>
          ) : null}

          {status.state !== 'connected' ? <ConnectPanel name="Calendars" status={status} /> : null}

          {status.state === 'connected' && !appleConfigured ? (
            <ConnectPanel
              name="Apple Calendar"
              status={{
                state: 'not-configured',
                message: 'Google calendars are connected. Apple is not linked yet.',
                steps: [
                  'On iPhone: Calendar → the calendar → Share Calendar → turn on Public Calendar, then copy the link.',
                  'Change the webcal:// prefix to https://',
                  'Apps Script → Project Settings → Script Properties → add APPLE_CALENDAR_ICS_URL with that link.',
                ],
              }}
            />
          ) : null}
            </>
          ) : null}
        </>
    </article>
  )
}
