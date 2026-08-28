import type { CalendarEvent, ConnectionStatus } from './types'

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const ACCESS_TOKEN_KEY = 'google-calendar-access-token'

export function readCalendarAccessToken(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function getAppleCalendarUrl(): string {
  return import.meta.env.VITE_APPLE_CALENDAR_ICS_URL?.trim() ?? ''
}

export function getGoogleCalendarStatus(): ConnectionStatus {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()) {
    return {
      state: 'not-configured',
      message: 'No Google OAuth client is configured for this build.',
      steps: ['Set VITE_GOOGLE_CLIENT_ID in .env and in the GitHub Actions build environment.'],
    }
  }

  if (!readCalendarAccessToken()) {
    return {
      state: 'needs-auth',
      message: 'Signed in, but this session has no Calendar read scope.',
      steps: [
        `Add the ${GOOGLE_CALENDAR_SCOPE} scope to the OAuth consent screen for this client.`,
        'Grant the scope through an OAuth token flow so an access token is issued.',
        'Events are read-only here; edits still happen in Google Calendar.',
      ],
    }
  }

  return { state: 'connected', message: 'Reading your primary Google calendar.', steps: [] }
}

/**
 * Apple Calendar has no public API. The workable route is a *published*
 * calendar's `.ics` URL — but iCloud serves those without CORS headers, so the
 * browser cannot fetch one directly. It has to come through a proxy that adds
 * the header (the existing Cloudflare Worker is the natural place).
 */
export function getAppleCalendarStatus(): ConnectionStatus {
  if (!getAppleCalendarUrl()) {
    return {
      state: 'not-configured',
      message: 'No published Apple calendar URL is set for this build.',
      steps: [
        'In Calendar on macOS or iOS, share a calendar publicly and copy its webcal:// link.',
        'Route that link through a CORS-friendly proxy (the Cloudflare Worker already in use works).',
        'Set VITE_APPLE_CALENDAR_ICS_URL to the proxied https:// URL.',
      ],
    }
  }

  return { state: 'connected', message: 'Reading the published Apple calendar feed.', steps: [] }
}

type GoogleEventResponse = {
  items?: {
    id: string
    summary?: string
    location?: string
    start?: { date?: string; dateTime?: string }
    end?: { date?: string; dateTime?: string }
  }[]
}

export async function getGoogleEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?${query.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  )

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Google Calendar rejected the access token. Re-grant the calendar.readonly scope.'
        : `Google Calendar request failed: ${response.status}`,
    )
  }

  const payload = (await response.json()) as GoogleEventResponse

  return (payload.items ?? []).map((item) => ({
    id: item.id,
    source: 'google' as const,
    title: item.summary ?? '(no title)',
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
    allDay: Boolean(item.start?.date),
    location: item.location,
    calendarName: 'Google',
  }))
}

/** 'YYYYMMDD' or 'YYYYMMDDTHHMMSSZ' from an ICS DTSTART/DTEND into an ISO string. */
function parseIcsDate(value: string): { iso: string; allDay: boolean } {
  const trimmed = value.trim()

  if (/^\d{8}$/.test(trimmed)) {
    return { iso: `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`, allDay: true }
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(trimmed)
  if (!match) {
    return { iso: '', allDay: false }
  }

  const [, y, mo, d, h, mi, s, zulu] = match
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${zulu ? 'Z' : ''}`
  return { iso, allDay: false }
}

/**
 * Minimal VEVENT reader — enough for a read-only week view. Recurrence rules
 * are deliberately not expanded; a repeating event shows on its first date
 * only, which is called out in the UI.
 */
export function parseIcs(text: string): CalendarEvent[] {
  // Unfold RFC 5545 continuation lines before splitting into properties.
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const events: CalendarEvent[] = []
  let current: Record<string, string> | null = null

  for (const rawLine of unfolded.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }

    if (line === 'END:VEVENT') {
      if (current) {
        const start = parseIcsDate(current.DTSTART ?? '')
        const end = parseIcsDate(current.DTEND ?? current.DTSTART ?? '')

        if (start.iso) {
          events.push({
            id: current.UID || `${start.iso}-${current.SUMMARY ?? ''}`,
            source: 'apple',
            title: current.SUMMARY || '(no title)',
            start: start.iso,
            end: end.iso || start.iso,
            allDay: start.allDay,
            location: current.LOCATION || undefined,
            calendarName: 'Apple',
          })
        }
      }
      current = null
      continue
    }

    if (!current) {
      continue
    }

    const separator = line.indexOf(':')
    if (separator < 0) {
      continue
    }

    // Strip property parameters: 'DTSTART;TZID=America/New_York' -> 'DTSTART'.
    const key = line.slice(0, separator).split(';')[0].toUpperCase()
    current[key] = line.slice(separator + 1)
  }

  return events
}

export async function getAppleEvents(icsUrl: string): Promise<CalendarEvent[]> {
  const response = await fetch(icsUrl, { headers: { Accept: 'text/calendar' } })

  if (!response.ok) {
    throw new Error(`Apple calendar feed failed: ${response.status}`)
  }

  return parseIcs(await response.text())
}
