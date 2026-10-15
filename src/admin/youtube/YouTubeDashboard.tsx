import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, MessageCircle, ThumbsUp } from 'lucide-react'
import { AdminPage } from '../AdminPage'
import { adminDashboardsById } from '../../siteContent'
import { getYouTubeVideos, type YouTubeMoment, type YouTubeSnapshot } from '../../data/youtube/client'
import { StepChart } from './StepChart'
import './youtube.css'

/** Chart palette, kept apart from the UI accent: these are data series. */
const SERIES = '#6366f1'
const DROP = '#dc2626'
const REWATCH = '#16a34a'
const COMMENT_PREVIEW = 4

const MOMENT_LABELS: Record<YouTubeMoment['kind'], string> = {
  hook: 'Hook',
  promise: 'Promise',
  drop: 'Drop',
  rewatch: 'Rewatched',
}

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function percent(share: number | null | undefined) {
  return share === null || share === undefined ? '–' : `${Math.round(share * 100)}%`
}

function count(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined
    ? '–'
    : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

function timeAgo(iso: string) {
  const time = new Date(iso).getTime()
  if (!iso || Number.isNaN(time)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function shortDate(iso: string) {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * How Minite Thoughts videos are doing. The numbers and the analysis come from
 * `minite results` on the desktop (see src/data/youtube/client.ts); this page
 * only shows them. Metrics say where to look, not what to change.
 */
export function YouTubeDashboard({ idToken }: { idToken: string }) {
  const [videos, setVideos] = useState<YouTubeSnapshot[]>([])
  const [selected, setSelected] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await getYouTubeVideos(idToken)
        if (!cancelled) {
          setVideos(rows)
          setError('')
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Couldn't load the YouTube results")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idToken])

  const video = videos.find((v) => v.video_id === selected) ?? videos[0]

  return (
    <AdminPage meta={adminDashboardsById.youtube}>
      {isLoading ? (
        <article className="info-card admin-card">
          <p className="sheets-meta">Loading the channel's results…</p>
        </article>
      ) : error ? (
        <article className="info-card admin-card">
          <p className="sheets-meta">{error}</p>
        </article>
      ) : !video ? (
        <article className="info-card admin-card">
          <h3>No videos yet</h3>
          <p className="sheets-meta">
            Run <code>minite results</code> in the MiniteThoughts repo after a video is uploaded; it sends each
            video's numbers here.
          </p>
        </article>
      ) : (
        <>
          {videos.length > 1 ? (
            <div className="yt-video-tabs" role="tablist" aria-label="Videos">
              {videos.map((v) => (
                <button
                  key={v.video_id}
                  type="button"
                  role="tab"
                  aria-selected={v.video_id === video.video_id}
                  className="yt-video-tab"
                  onClick={() => setSelected(v.video_id)}
                >
                  {v.title}
                </button>
              ))}
            </div>
          ) : null}
          <OverviewCard video={video} />
          <RetentionCard video={video} />
          <DailyCard video={video} />
          <TrafficCard video={video} />
          <CommentsCard video={video} />
          {videos.length > 1 ? (
            <CompareCard videos={videos} selected={video.video_id} onSelect={setSelected} />
          ) : null}
        </>
      )}
    </AdminPage>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="yt-stat">
      <span className="yt-stat-label">{label}</span>
      <span className="yt-stat-value">{value}</span>
      {note ? <span className="yt-stat-note">{note}</span> : null}
    </div>
  )
}

function OverviewCard({ video }: { video: YouTubeSnapshot }) {
  const { live, totals, ratios } = video
  const hasAnalytics = Boolean(video.analytics_through)
  const net = totals.subscribers_gained - totals.subscribers_lost

  return (
    <article className="info-card admin-card yt-overview">
      <div className="admin-card-head">
        <h3>Overview</h3>
        <span className="admin-pill" title={video.fetched_at}>
          Updated {timeAgo(video.fetched_at)}
        </span>
      </div>

      <div className="yt-video-head">
        <a className="yt-video-title" href={video.url} target="_blank" rel="noreferrer">
          {video.title}
          <ExternalLink size={14} strokeWidth={1.7} aria-hidden="true" />
        </a>
        <span className="sheets-meta">
          {video.published_at ? `Published ${shortDate(video.published_at)}` : 'Not published'} ·{' '}
          {clock(video.duration)} · {video.privacy}
        </span>
      </div>

      <div className="yt-stats">
        <Stat label="Views" value={count(live.views)} note="live" />
        <Stat
          label="Average watched"
          value={hasAnalytics ? `${Math.round(totals.average_view_percent)}%` : '–'}
          note={hasAnalytics ? clock(totals.average_view_seconds) : undefined}
        />
        <Stat
          label="Watch time"
          value={hasAnalytics ? `${count(totals.minutes_watched / 60, 1)} h` : '–'}
          note={hasAnalytics ? `${count(totals.minutes_watched)} min` : undefined}
        />
        <Stat label="Likes per 100 views" value={count(ratios.likes_per_100_views, 1)} note={`${count(live.likes)} likes`} />
        <Stat
          label="Comments per 1,000 views"
          value={count(ratios.comments_per_1000_views, 1)}
          note={`${count(live.comments)} comments`}
        />
        <Stat
          label="Subscribers"
          value={hasAnalytics ? `${net >= 0 ? '+' : ''}${net}` : '–'}
          note={
            ratios.subscribers_per_1000_views === null ? undefined : `${count(ratios.subscribers_per_1000_views, 1)} per 1,000 views`
          }
        />
      </div>

      <p className="sheets-meta">
        {hasAnalytics
          ? `Views, likes and comments are live; the rest runs to ${shortDate(video.analytics_through ?? '')}, a day or two behind.`
          : 'Views, likes and comments are live. Watch time, retention and traffic arrive a day or two after publishing.'}
      </p>
    </article>
  )
}

function RetentionCard({ video }: { video: YouTubeSnapshot }) {
  const { retention, moments, chapters, lines } = video

  const lineAt = useCallback(
    (t: number) => lines.find((line) => line.start <= t && t < line.end + 0.5)?.text ?? '',
    [lines],
  )

  const series = useMemo(() => {
    const marks = moments
      .filter((m) => m.kind === 'drop' || m.kind === 'rewatch')
      .map((m) => ({
        index: retention.findIndex((p) => p.t >= m.start),
        color: m.kind === 'drop' ? DROP : REWATCH,
      }))
      .filter((m) => m.index >= 0)
    return [
      {
        label: 'Still watching',
        points: retention.map((p) => ({ x: p.t, y: Math.round(p.watching * 1000) / 10 })),
        color: SERIES,
        fill: true,
        marks,
      },
    ]
  }, [retention, moments])
  const guides = useMemo(() => chapters.map((c) => c.t).filter((t) => t > 0), [chapters])
  const yMax = useMemo(() => Math.max(100, ...retention.map((p) => Math.ceil(p.watching * 10) * 10)), [retention])
  const tooltipTitle = useCallback((i: number) => clock(retention[i]?.t ?? 0), [retention])
  const tooltipExtra = useCallback((i: number) => {
    const text = lineAt(retention[i]?.t ?? 0)
    return text ? [`"${text}"`] : []
  }, [lineAt, retention])
  const xFormat = useCallback((value: number | string) => clock(Number(value)), [])
  const yFormat = useCallback((value: number) => `${Math.round(value)}%`, [])

  const hook = moments.find((m) => m.kind === 'hook')
  const listed = moments.filter((m) => m.kind !== 'hook')

  return (
    <article className="info-card admin-card yt-retention">
      <div className="admin-card-head">
        <h3>Retention</h3>
        {hook ? <span className="admin-pill">{percent(hook.watching)} past the hook</span> : null}
      </div>

      {retention.length === 0 ? (
        <p className="sheets-meta">
          No retention curve yet. YouTube draws it a day or two after publishing, once enough people have watched.
        </p>
      ) : (
        <>
          <div className="yt-key" aria-hidden="true">
            <span className="yt-key-item">
              <span className="yt-key-swatch" style={{ background: SERIES }} />
              Still watching
            </span>
            <span className="yt-key-item">
              <span className="yt-key-dot" style={{ background: DROP }} />
              Drop
            </span>
            <span className="yt-key-item">
              <span className="yt-key-dot" style={{ background: REWATCH }} />
              Rewatched
            </span>
            <span className="yt-key-item">
              <span className="yt-key-guide" />
              Chapter
            </span>
          </div>

          <StepChart
            series={series}
            xType="linear"
            xFormat={xFormat}
            yFormat={yFormat}
            yMax={yMax}
            guides={guides}
            tooltipTitle={tooltipTitle}
            tooltipExtra={tooltipExtra}
            label={`Share of viewers still watching across ${clock(video.duration)} of video`}
          />

          <table className="sr-only">
            <caption>Share of viewers still watching, by time in the video</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Watching</th>
              </tr>
            </thead>
            <tbody>
              {retention.map((p) => (
                <tr key={p.t}>
                  <td>{clock(p.t)}</td>
                  <td>{percent(p.watching)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {listed.length > 0 ? (
        <ol className="yt-moments" aria-label="Moments worth a look">
          {listed.map((m) => (
            <li key={`${m.kind}-${m.start}`} className="yt-moment">
              <span className="yt-moment-time">{clock(m.start)}</span>
              <div className="yt-moment-body">
                <span className={`yt-moment-kind yt-moment-kind--${m.kind}`}>{MOMENT_LABELS[m.kind]}</span>
                <p className="yt-moment-note">{m.note}</p>
                {m.line ? <q className="yt-moment-line">{m.line}</q> : null}
                {m.scene || m.chapter ? (
                  <span className="sheets-meta">{[m.scene && `Scene: ${m.scene}`, m.chapter].filter(Boolean).join(' · ')}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {chapters.length > 0 && retention.length > 0 ? (
        <table className="yt-table">
          <thead>
            <tr>
              <th scope="col">Chapter</th>
              <th scope="col">Starts</th>
              <th scope="col">Watching</th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => (
              <tr key={c.t}>
                <td>{c.name}</td>
                <td className="yt-num">{clock(c.t)}</td>
                <td className="yt-num">{percent(c.watching)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  )
}

function DailyCard({ video }: { video: YouTubeSnapshot }) {
  const { daily } = video
  const series = useMemo(
    () => [
      {
        label: 'Views',
        points: daily.map((d) => ({ x: d.date, y: d.views })),
        color: SERIES,
        fill: true,
      },
    ],
    [daily],
  )
  const xFormat = useCallback((value: number | string) => shortDate(String(value)), [])
  const tooltipTitle = useCallback((i: number) => shortDate(daily[i]?.date ?? ''), [daily])
  const tooltipExtra = useCallback(
    (i: number) => {
      const day = daily[i]
      return day ? [`${count(day.minutes)} min watched`, `${day.subscribers} new subscribers`] : []
    },
    [daily],
  )

  return (
    <article className="info-card admin-card yt-daily">
      <div className="admin-card-head">
        <h3>Views by day</h3>
        {daily.length > 0 ? <span className="admin-pill">{daily.length} days</span> : null}
      </div>
      {daily.length === 0 ? (
        <p className="sheets-meta">No daily numbers yet; they start a day or two after publishing.</p>
      ) : (
        <>
          <StepChart
            series={series}
            xFormat={xFormat}
            tooltipTitle={tooltipTitle}
            tooltipExtra={tooltipExtra}
            label="Views per day since publishing"
            height={180}
          />
          <table className="sr-only">
            <caption>Views per day</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Views</th>
                <th scope="col">Minutes watched</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.views}</td>
                  <td>{d.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  )
}

function TrafficCard({ video }: { video: YouTubeSnapshot }) {
  const total = video.traffic.reduce((sum, row) => sum + row.views, 0)
  const devices = video.devices.reduce((sum, row) => sum + row.views, 0)

  return (
    <article className="info-card admin-card yt-traffic">
      <div className="admin-card-head">
        <h3>Where viewers came from</h3>
      </div>
      {video.traffic.length === 0 ? (
        <p className="sheets-meta">No traffic sources yet.</p>
      ) : (
        <ul className="yt-bars">
          {video.traffic.map((row) => (
            <li key={row.source} className="yt-bar">
              <span className="yt-bar-label">{row.label}</span>
              <span className="yt-bar-track" aria-hidden="true">
                <span className="yt-bar-fill" style={{ width: `${(row.views / Math.max(total, 1)) * 100}%`, background: SERIES }} />
              </span>
              <span className="yt-num">{count(row.views)}</span>
              <span className="yt-num yt-muted">{percent(row.views / Math.max(total, 1))}</span>
            </li>
          ))}
        </ul>
      )}
      {video.devices.length > 0 ? (
        <div className="yt-chips" aria-label="Devices">
          {video.devices.map((row) => (
            <span key={row.device} className="admin-pill">
              {row.device} <span className="yt-num">{percent(row.views / Math.max(devices, 1))}</span>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function CommentsCard({ video }: { video: YouTubeSnapshot }) {
  const [showAll, setShowAll] = useState(false)
  const { comments } = video
  const shown = showAll ? comments : comments.slice(0, COMMENT_PREVIEW)

  return (
    <article className="info-card admin-card yt-comments">
      <div className="admin-card-head">
        <h3>Comments</h3>
        <span className="admin-pill">
          <span className="yt-num">{count(video.live.comments)}</span>
        </span>
      </div>
      {comments.length === 0 ? (
        <p className="sheets-meta">
          No comments yet. Early on, what viewers say, and how much of it is positive, is the strongest sign of
          whether the video satisfied them.
        </p>
      ) : (
        <>
          <ul className="yt-comment-list">
            {shown.map((c, i) => (
              <li key={`${c.published_at}-${i}`} className="yt-comment">
                <div className="yt-comment-head">
                  <span className="yt-comment-author">{c.author}</span>
                  <span className="sheets-meta">{timeAgo(c.published_at)}</span>
                </div>
                <p className="yt-comment-text">{c.text}</p>
                <span className="yt-comment-meta">
                  <ThumbsUp size={13} strokeWidth={1.7} aria-hidden="true" />
                  <span className="yt-num">{c.likes}</span>
                  <MessageCircle size={13} strokeWidth={1.7} aria-hidden="true" />
                  <span className="yt-num">{c.replies}</span>
                  <span className="sr-only">
                    {c.likes} likes, {c.replies} replies
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {comments.length > COMMENT_PREVIEW ? (
            <button type="button" className="secondary-action yt-show-all" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${comments.length}`}
            </button>
          ) : null}
        </>
      )}
    </article>
  )
}

function CompareCard({
  videos,
  selected,
  onSelect,
}: {
  videos: YouTubeSnapshot[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <article className="info-card admin-card yt-compare">
      <div className="admin-card-head">
        <h3>All videos</h3>
        <span className="admin-pill">
          <span className="yt-num">{videos.length}</span>
        </span>
      </div>
      <div className="yt-table-scroll">
        <table className="yt-table">
          <thead>
            <tr>
              <th scope="col">Video</th>
              <th scope="col">Views</th>
              <th scope="col">Watched</th>
              <th scope="col">Past hook</th>
              <th scope="col">Likes/100</th>
              <th scope="col">Comments/1k</th>
              <th scope="col">Subs/1k</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.video_id} aria-current={v.video_id === selected ? 'true' : undefined}>
                <td>
                  <button type="button" className="yt-link-button" onClick={() => onSelect(v.video_id)}>
                    {v.title}
                  </button>
                </td>
                <td className="yt-num">{count(v.live.views)}</td>
                <td className="yt-num">{v.analytics_through ? `${Math.round(v.totals.average_view_percent)}%` : '–'}</td>
                <td className="yt-num">{percent(v.moments.find((m) => m.kind === 'hook')?.watching)}</td>
                <td className="yt-num">{count(v.ratios.likes_per_100_views, 1)}</td>
                <td className="yt-num">{count(v.ratios.comments_per_1000_views, 1)}</td>
                <td className="yt-num">{count(v.ratios.subscribers_per_1000_views, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
