/**
 * A public GitHub contribution calendar.
 *
 * GitHub's own calendar is only served to an authenticated API call, which a
 * static site has no safe way to make. github-contributions-api.jogruber.de is
 * a free, CORS-enabled service that reads the public profile and returns every
 * day with GitHub's own 0–4 level, so the tiles match what GitHub shows.
 */
const CONTRIBUTIONS_API = 'https://github-contributions-api.jogruber.de/v4'

export type ContributionDay = { date: string; count: number; level: number }

export type Contributions = {
  /** Contributions per calendar year, e.g. { 2026: 835 }. */
  totals: Record<number, number>
  /** Every day the service returned, by YYYY-MM-DD. */
  days: Map<string, ContributionDay>
}

export async function getContributions(username: string, signal?: AbortSignal): Promise<Contributions> {
  const response = await fetch(`${CONTRIBUTIONS_API}/${encodeURIComponent(username)}`, { signal })
  const data = (await response.json().catch(() => null)) as {
    total?: Record<string, number>
    contributions?: ContributionDay[]
  } | null
  if (!response.ok || !data || !Array.isArray(data.contributions)) {
    throw new Error('GitHub activity is unavailable right now.')
  }

  const totals: Record<number, number> = {}
  for (const [year, count] of Object.entries(data.total ?? {})) {
    if (/^\d{4}$/.test(year)) totals[Number(year)] = Number(count) || 0
  }

  const days = new Map<string, ContributionDay>()
  for (const day of data.contributions) {
    if (typeof day?.date === 'string') {
      days.set(day.date, { date: day.date, count: Number(day.count) || 0, level: Math.min(4, Math.max(0, Number(day.level) || 0)) })
    }
  }

  return { totals, days }
}

/** The longest run of consecutive days with at least one contribution in a year. */
export function longestStreak(days: Map<string, ContributionDay>, year: number): number {
  let best = 0
  let current = 0
  const date = new Date(year, 0, 1)
  while (date.getFullYear() === year) {
    const key = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    current = (days.get(key)?.count ?? 0) > 0 ? current + 1 : 0
    best = Math.max(best, current)
    date.setDate(date.getDate() + 1)
  }
  return best
}
