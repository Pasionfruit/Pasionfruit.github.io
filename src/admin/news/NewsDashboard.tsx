import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import { AdminPage } from '../AdminPage'
import { adminDashboardsById } from '../../siteContent'
import { getNews, type NewsItem } from '../../data/news/client'
import { useNewsPlaces } from './useNewsPlaces'
import { askAceAboutNews } from '../ace/newsSummary'

function timeAgo(iso: string, now: number) {
  const time = new Date(iso).getTime()
  if (!iso || Number.isNaN(time)) return ''

  const minutes = Math.max(0, Math.round((now - time) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function NewsCard({
  title,
  subtitle,
  feed,
  place,
  region,
  idToken,
  waitingMessage,
}: {
  title: string
  subtitle: string
  /** A fixed feed, or else a place to search for. */
  feed?: 'nation' | 'world'
  /** Empty while the place is still being worked out, or if it cannot be. */
  place?: string
  region?: string
  idToken: string
  waitingMessage: string
}) {
  const [items, setItems] = useState<NewsItem[]>([])
  // "2h ago" is measured from when the headlines arrived, not re-read each render.
  const [loadedAt, setLoadedAt] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [reloads, setReloads] = useState(0)
  const hasQuery = Boolean(feed || place)

  useEffect(() => {
    const query = feed ? { feed } : place ? { place, region } : null
    if (!query) return
    let cancelled = false

    void (async () => {
      setIsLoading(true)
      try {
        const rows = await getNews(idToken, query)
        if (!cancelled) {
          setItems(rows)
          setLoadedAt(Date.now())
          setError('')
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load news')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [feed, place, region, idToken, reloads])

  const refresh = useCallback(() => setReloads((value) => value + 1), [])

  return (
    <article className="info-card admin-card news-card">
      <div className="admin-card-head">
        <div className="news-card-titles">
          <h3>{title}</h3>
          {subtitle ? <p className="sheets-meta">{subtitle}</p> : null}
        </div>
        <div className="admin-card-actions">
          {hasQuery ? (
            <button type="button" className="secondary-action" onClick={refresh} disabled={isLoading}>
              {isLoading ? 'Loading…' : 'Refresh'}
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {isCollapsed ? null : !hasQuery ? (
        <p className="sheets-meta">{waitingMessage}</p>
      ) : isLoading && items.length === 0 ? (
        <p className="sheets-meta">Loading headlines…</p>
      ) : error && items.length === 0 ? (
        <p className="sheets-meta">{error}</p>
      ) : items.length === 0 ? (
        <p className="sheets-meta">No headlines in the last few days.</p>
      ) : (
        <>
          <ul className="news-list" aria-label={`${title} headlines`} tabIndex={0}>
            {items.map((item) => (
              <li key={item.url} className="news-item">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-link">
                  <span className="news-title">{item.title}</span>
                  <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
                </a>
                <div className="news-item-foot">
                  <span className="news-meta">
                    {[item.source, timeAgo(item.publishedAt, loadedAt)].filter(Boolean).join(' · ')}
                  </span>
                  <button
                    type="button"
                    className="news-summary-btn"
                    aria-label={`Ask Ace to summarize ${item.title}`}
                    onClick={() => askAceAboutNews(item)}
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    <span>Ask Ace</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {items.length > 4 ? <p className="sheets-meta news-scroll-hint">{items.length} articles · Scroll for more</p> : null}
        </>
      )}
    </article>
  )
}

/**
 * Four scopes of headlines, small to large. Local and City follow the device
 * location; Nation and International blend a few outlets' US and World feeds.
 */
export function NewsDashboard({ idToken }: { idToken: string }) {
  const meta = adminDashboardsById.news
  const { status, places, error } = useNewsPlaces()
  const waiting = status === 'error' ? error : 'Finding your location…'

  return (
    <AdminPage meta={meta}>
      <div className="news-grid">
        <NewsCard
          title="Local"
          subtitle={places?.local.label ?? ''}
          place={places?.local.place}
          region={places?.local.region}
          idToken={idToken}
          waitingMessage={waiting}
        />
        <NewsCard
          title="City"
          subtitle={places?.city.label ?? ''}
          place={places?.city.place}
          region={places?.city.region}
          idToken={idToken}
          waitingMessage={waiting}
        />
        <NewsCard
          title="Nation"
          subtitle="United States"
          feed="nation"
          idToken={idToken}
          waitingMessage=""
        />
        <NewsCard
          title="International"
          subtitle="World"
          feed="world"
          idToken={idToken}
          waitingMessage=""
        />
      </div>
    </AdminPage>
  )
}
