import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { adminDashboards, adminHomeContent } from '../siteContent'

export function AdminHome() {
  return (
    <PageFrame
      eyebrow={adminHomeContent.eyebrow}
      title={adminHomeContent.title}
      summary={adminHomeContent.summary}
      accent={adminHomeContent.accent}
      backLink="/"
      backLabel="Back to the public site"
      note={adminHomeContent.note}
      gridClassName="admin-grid"
    >
      {adminDashboards.map((dashboard) => (
        <Link
          key={dashboard.id}
          to={dashboard.path}
          className="section-tile admin-tile"
          style={{ '--tile-accent': dashboard.accent } as CSSProperties}
        >
          <span className="tile-eyebrow">{dashboard.eyebrow}</span>
          <span className="tile-title">{dashboard.title}</span>
          <span className="tile-summary">{dashboard.summary}</span>
          <span className="tile-open" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </PageFrame>
  )
}
