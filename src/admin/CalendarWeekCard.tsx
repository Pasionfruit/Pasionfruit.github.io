import { useEffect, useMemo, useState } from 'react'
import { ConnectPanel } from './ConnectPanel'
import { getCalendarEvents, type CalendarEventRecord } from '../data/sheets/repositories'
import type { ConnectionStatus } from './integrations/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function eventDayKey(event: CalendarEventRecord) {
  if (event.allDay) {
    return event.start.slice(0, 10)
  }

  const parsed = new Date(event.start)
  return Number.isNaN(parsed.getTime()) ? '' : dayKey(parsed)
}

function eventTimeLabel(event: CalendarEventRecord) {
  if (event.allDay) {
    return 'All day'
  }

  const parsed = new Date(event.start)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
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
 * A month grid built on the same markup as the Finance calendar: compact day
 * cells with a dot when something is on, and a dialog listing that day's events
 * on tap. Seven narrow columns fit a phone without horizontal scrolling, which
 * the previous week-strip layout could not do.
 */
export function CalendarWeekCard({ title, idToken }: { title: string; idToken: string }) {
  const status = getStatus(idToken)

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [events, setEvents] = useState<CalendarEventRecord[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [appleConfigured, setAppleConfigured] = useState(true)
  const [isLoading, setIsLoading] = useState(status.state === 'connected')
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

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

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEventRecord[]> = {}

    for (const event of events) {
      const key = eventDayKey(event)
      if (!key) {
        continue
      }
      map[key] = map[key] ?? []
      map[key].push(event)
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

  return (
    <article className="info-card admin-card admin-card-wide">
      <div className="admin-card-head">
        <h3>{title}</h3>
        {status.state === 'connected' && !isLoading ? (
          <span className="admin-pill">
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {errors.map((message) => (
        <p key={message} className="sheets-meta">
          {message}
        </p>
      ))}

      {status.state === 'connected' ? (
        <div className="finance-calendar-shell admin-calendar-shell">
          <div className="finance-calendar-header">
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
              }
            >
              Prev
            </button>
            <p className="finance-calendar-month">{monthLabel}</p>
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
              }
            >
              Next
            </button>
          </div>

          <div className="finance-calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="finance-calendar-grid" aria-label="Calendar view">
            {cells.map((day, index) => {
              if (!day) {
                return <span key={`blank-${index}`} className="finance-calendar-empty" />
              }

              const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsByDay[key] ?? []
              const hasEvents = dayEvents.length > 0

              return (
                <button
                  key={key}
                  type="button"
                  className={`finance-calendar-day admin-calendar-day ${hasEvents ? 'has-events' : ''} ${key === todayKey ? 'is-today' : ''}`}
                  onClick={() => {
                    if (hasEvents) {
                      setSelectedDayKey(key)
                    }
                  }}
                  aria-label={
                    hasEvents
                      ? `${key} has ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                      : `${key} has no events`
                  }
                >
                  <span>{day}</span>
                  {hasEvents ? (
                    <span className="calendar-event-dots" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((event, dotIndex) => (
                        <span
                          key={`${event.source}-${event.id}-${dotIndex}`}
                          className={`calendar-event-dot source-${event.source}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {isLoading ? <p className="sheets-meta">Loading events…</p> : null}

      {selectedDayKey && selectedEvents.length > 0 ? (
        <div
          className="finance-access-dialog-backdrop"
          role="presentation"
          onClick={() => setSelectedDayKey(null)}
        >
          <div
            className="finance-access-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-calendar-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="admin-calendar-popup-title">{formatDayHeading(selectedDayKey)}</h2>

            <ul className="admin-calendar-day-list">
              {selectedEvents.map((event) => (
                <li key={`${event.source}-${event.id}`} className={`source-${event.source}`}>
                  <span className="calendar-event-time">{eventTimeLabel(event)}</span>
                  <span className="calendar-event-title">{event.title}</span>
                  {event.location ? (
                    <span className="calendar-event-location">{event.location}</span>
                  ) : null}
                  {event.calendarName ? (
                    <span className="calendar-event-source">{event.calendarName}</span>
                  ) : null}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="finance-dialog-close"
              onClick={() => setSelectedDayKey(null)}
            >
              Close
            </button>
          </div>
        </div>
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
    </article>
  )
}
