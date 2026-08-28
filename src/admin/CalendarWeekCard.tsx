import { useEffect, useMemo, useState } from 'react'
import { ConnectPanel } from './ConnectPanel'
import { getCalendarEvents, type CalendarEventRecord } from '../data/sheets/repositories'
import type { ConnectionStatus } from './integrations/types'

type CalendarEvent = CalendarEventRecord

const DAY_MS = 86_400_000

function startOfWeek(reference: Date) {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
  // Weeks run Monday-first, matching how the training and work views read.
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return date
}

function dayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function eventDayKey(event: CalendarEvent) {
  if (event.allDay) {
    return event.start.slice(0, 10)
  }

  const parsed = new Date(event.start)
  return Number.isNaN(parsed.getTime()) ? '' : dayKey(parsed)
}

function eventTimeLabel(event: CalendarEvent) {
  if (event.allDay) {
    return 'All day'
  }

  const parsed = new Date(event.start)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
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

export function CalendarWeekCard({ title, idToken }: { title: string; idToken: string }) {
  const status = getStatus(idToken)

  const [weekOffset, setWeekOffset] = useState(0)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [appleConfigured, setAppleConfigured] = useState(true)
  const [isLoading, setIsLoading] = useState(status.state === 'connected')

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date())
    base.setDate(base.getDate() + weekOffset * 7)
    return base
  }, [weekOffset])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => new Date(weekStart.getTime() + index * DAY_MS)),
    [weekStart],
  )

  useEffect(() => {
    if (status.state !== 'connected') {
      return
    }

    let cancelled = false
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)

    void (async () => {
      setIsLoading(true)

      try {
        const result = await getCalendarEvents(idToken, weekStart, weekEnd)
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
  }, [status.state, idToken, weekStart])

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}

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

  const todayKeyValue = dayKey(new Date())
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <article className="info-card admin-card admin-card-wide">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="week-nav">
          <span className="admin-pill">{rangeLabel}</span>
          <button type="button" onClick={() => setWeekOffset((value) => value - 1)}>
            ‹
          </button>
          <button type="button" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
            Today
          </button>
          <button type="button" onClick={() => setWeekOffset((value) => value + 1)}>
            ›
          </button>
        </div>
      </div>

      {errors.map((message) => (
        <p key={message} className="sheets-meta">
          {message}
        </p>
      ))}

      {isLoading ? <p className="sheets-meta">Loading events…</p> : null}

      <div className="calendar-week" hidden={status.state !== 'connected'}>
        {days.map((day) => {
          const key = dayKey(day)
          const dayEvents = eventsByDay[key] ?? []

          return (
            <div key={key} className={`calendar-day ${key === todayKeyValue ? 'today' : ''}`}>
              <div className="calendar-day-head">
                <span className="calendar-weekday">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className="calendar-date">{day.getDate()}</span>
              </div>

              {dayEvents.length === 0 ? (
                <p className="calendar-empty">—</p>
              ) : (
                <ul className="calendar-events">
                  {dayEvents.map((event) => (
                    <li key={`${event.source}-${event.id}`} className={`calendar-event source-${event.source}`}>
                      <span className="calendar-event-time">{eventTimeLabel(event)}</span>
                      <span className="calendar-event-title">{event.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

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
