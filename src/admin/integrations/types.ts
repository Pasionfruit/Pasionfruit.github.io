/**
 * Shared shapes for the read-only integrations behind the admin dashboards.
 *
 * Each integration reports a `ConnectionStatus` before it returns any data, so
 * a dashboard can render an honest "not connected yet" panel instead of an
 * empty list that looks like a quiet day.
 */

export type ConnectionState =
  /** Env is set and an access token is present — requests will be attempted. */
  | 'connected'
  /** Configured, but no usable access token in this browser session. */
  | 'needs-auth'
  /** The env vars this integration needs were never set for the build. */
  | 'not-configured'

export type ConnectionStatus = {
  state: ConnectionState
  /** One-line explanation shown to the signed-in admin. */
  message: string
  /** Concrete steps to move from the current state to `connected`. */
  steps: string[]
}

export type CalendarSource = 'google' | 'apple'

export type CalendarEvent = {
  id: string
  source: CalendarSource
  title: string
  /** ISO timestamp, or 'YYYY-MM-DD' when `allDay`. */
  start: string
  end: string
  allDay: boolean
  location?: string
  calendarName?: string
}
