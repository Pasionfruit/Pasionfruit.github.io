/**
 * Headlines from the news Worker (workers/news), which reads publisher RSS and
 * Bing News searches server-side and returns JSON. Admin-only: the Worker checks the bearer with
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

export type NewsQuery = { feed: 'nation' | 'world' | 'tech' } | { place: string; region?: string }

export type NewsArticle = { url: string; title: string; text: string; excerpt: boolean }

export async function getNewsArticle(idToken: string, url: string, signal?: AbortSignal): Promise<NewsArticle> {
  const response = await fetch(`${NEWS_BASE_URL}/article?${new URLSearchParams({ url })}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal,
  })
  const data = await response.json().catch(() => null) as (NewsArticle & { error?: string }) | null
  if (!response.ok || !data?.text) {
    throw new Error(data?.error || 'The article text is unavailable. Paste the article into Ace to summarize it.')
  }
  return data
}

export async function getNews(idToken: string, query: NewsQuery, signal?: AbortSignal): Promise<NewsItem[]> {
  const params = new URLSearchParams()
  if ('feed' in query) {
    params.set('feed', query.feed)
  } else {
    params.set('place', query.place)
    if (query.region) params.set('region', query.region)
  }

  const response = await fetch(`${NEWS_BASE_URL}/news?${params}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal,
  })

  const data = (await response.json().catch(() => null)) as { items?: NewsItem[]; error?: string } | null
  if (!response.ok) {
    // Older deployed news Workers predate the dedicated technology feed.
    // Their place search still supplies technology headlines until redeployed.
    if (response.status === 400 && 'feed' in query && query.feed === 'tech' && /Ask for.*\?feed=/i.test(data?.error ?? '')) {
      return getNews(idToken, { place: 'technology' }, signal)
    }
    throw new Error(data?.error || `News request failed: ${response.status}`)
  }
  return data?.items ?? []
}
