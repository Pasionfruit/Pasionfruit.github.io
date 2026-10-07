/**
 * Headlines from the news Worker (workers/news), which reads Google News RSS
 * server-side and returns JSON. Admin-only: the Worker checks the bearer with
 * the db Worker, the same session the rest of the dashboards use.
 */

const NEWS_BASE_URL =
  (import.meta.env.VITE_NEWS_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://news.abepasion.workers.dev'

export type NewsItem = {
  title: string
  url: string
  source: string
  /** ISO timestamp, or '' when the feed's date could not be read. */
  publishedAt: string
}

export type NewsQuery = { feed: 'nation' | 'world' } | { place: string; region?: string }

export async function getNews(idToken: string, query: NewsQuery): Promise<NewsItem[]> {
  const params = new URLSearchParams()
  if ('feed' in query) {
    params.set('feed', query.feed)
  } else {
    params.set('place', query.place)
    if (query.region) params.set('region', query.region)
  }

  const response = await fetch(`${NEWS_BASE_URL}/news?${params}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })

  const data = (await response.json().catch(() => null)) as { items?: NewsItem[]; error?: string } | null
  if (!response.ok) {
    throw new Error(data?.error || `News request failed: ${response.status}`)
  }
  return data?.items ?? []
}
