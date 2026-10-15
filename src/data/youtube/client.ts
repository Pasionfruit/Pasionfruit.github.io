/**
 * Minite Thoughts' YouTube results, for the YouTube dashboard.
 *
 * The analysis is done on the desktop by `minite results` in the MiniteThoughts
 * repo, which has what the browser cannot: the YouTube sign-in, and the take's
 * caption lines, scenes and promises to pin each retention drop to. It stores
 * one JSON snapshot per video in the db Worker's admin-only `youtube_videos`
 * table, and this reads them back.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

export type YouTubeMomentKind = 'hook' | 'promise' | 'drop' | 'rewatch'

/** A point on the retention curve worth a look, with what was on screen there. */
export type YouTubeMoment = {
  kind: YouTubeMomentKind
  start: number
  end: number
  /** Change in the share of viewers, e.g. -0.06 for a drop of 6 points. */
  change: number
  /** Share of viewers still watching afterwards (can pass 1 where people rewatch). */
  watching: number | null
  line: string | null
  scene: string | null
  chapter: string | null
  note: string
}

export type YouTubeSnapshot = {
  version: number
  video: string
  video_id: string
  title: string
  url: string
  thumbnail: string
  published_at: string
  privacy: string
  /** Seconds. */
  duration: number
  fetched_at: string
  /** Last day the analytics cover (they lag the live counts by a day or two). */
  analytics_through: string | null
  live: { views: number; likes: number; comments: number }
  totals: {
    views: number
    minutes_watched: number
    average_view_seconds: number
    average_view_percent: number
    shares: number
    subscribers_gained: number
    subscribers_lost: number
  }
  ratios: {
    likes_per_100_views: number | null
    comments_per_1000_views: number | null
    subscribers_per_1000_views: number | null
  }
  daily: { date: string; views: number; minutes: number; subscribers: number; likes: number }[]
  /** One point per 1% of the video: `t` in seconds, `watching` as a share of viewers. */
  retention: { t: number; watching: number; relative: number | null }[]
  moments: YouTubeMoment[]
  chapters: { t: number; name: string; watching: number | null }[]
  traffic: { source: string; label: string; views: number; minutes: number }[]
  devices: { device: string; views: number }[]
  lines: { start: number; end: number; text: string }[]
  scenes: { start: number; end: number; name: string }[]
  comments: { author: string; text: string; likes: number; published_at: string; replies: number }[]
  notes: string[]
}

/** Every video's latest snapshot, newest video first. Rows that do not parse are skipped. */
export async function getYouTubeVideos(idToken: string): Promise<YouTubeSnapshot[]> {
  const response = await fetch(`${DB_BASE_URL}/db/youtube_videos`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!response.ok) {
    throw new Error(`Couldn't load the YouTube results (${response.status})`)
  }
  const data = (await response.json()) as { rows?: { snapshot?: string }[] }
  return parseSnapshots(data.rows ?? [])
}

export function parseSnapshots(rows: { snapshot?: string }[]): YouTubeSnapshot[] {
  const snapshots: YouTubeSnapshot[] = []
  for (const row of rows) {
    try {
      const snapshot = JSON.parse(row.snapshot ?? '') as YouTubeSnapshot
      if (snapshot && snapshot.video_id) snapshots.push(snapshot)
    } catch {
      // A half-written or older row; the next `minite results` run replaces it.
    }
  }
  return snapshots.sort((a, b) => b.published_at.localeCompare(a.published_at))
}
