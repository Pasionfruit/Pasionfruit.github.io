import { useEffect, useMemo, useState } from 'react'
import { ConnectPanel } from './ConnectPanel'
import {
  getAppleCalendarStatus,
  getAppleCalendarUrl,
  getAppleEvents,
  getGoogleCalendarStatus,
  getGoogleEvents,
  readCalendarAccessToken,
} from './integrations/calendars'
import type { CalendarEvent } from './integrations/types'

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
 * The week ahead, Google and Apple overlaid. Lives on the admin home page
 * rather than a route of its own.
 */
export function CalendarWeekCard({ title }: { title: string }) {
  const googleStatus = getGoogleCalendarStatus()
  const appleStatus = getAppleCalendarStatus()
  const anyConnected = googleStatus.state === 'connected' || appleStatus.state === 'connected'

  const [weekOffset, setWeekOffset] = useState(0)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(anyConnected)

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
    if (!anyConnected) {
      return
    }

    let cancelled = false
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)

    void (async () => {
      setIsLoading(true)
      const collected: CalendarEvent[] = []
      const failures: string[] = []

      if (googleStatus.state === 'connected') {
        try {
          collected.push(...(await getGoogleEvents(readCalendarAccessToken(), weekStart, weekEnd)))
        } catch (caught) {
          failures.push(caught instanceof Error ? caught.message : 'Google Calendar failed')
        }
      }

      if (appleStatus.state === 'connected') {
        try {
          const appleEvents = await getAppleEvents(getAppleCalendarUrl())
          const startKey = dayKey(weekStart)
          const endKey = dayKey(weekEnd)
          collected.push(
            ...appleEvents.filter((event) => {
              const key = eventDayKey(event)
              return key >= startKey && key < endKey
            }),
          )
        } catch (caught) {
          failures.push(caught instanceof Error ? caught.message : 'Apple Calendar failed')
        }
      }

      if (!cancelled) {
        setEvents(collected)
        setErrors(failures)
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [anyConnected, appleStatus.state, googleStatus.state, weekStart])

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

      <div className="calendar-week">
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

      {googleStatus.state !== 'connected' ? (
        <ConnectPanel name="Google Calendar" status={googleStatus} />
      ) : null}

      {appleStatus.state !== 'connected' ? (
        <ConnectPanel name="Apple Calendar" status={appleStatus} />
      ) : null}
    </article>
  )
}
