import type { CSSProperties, ReactNode } from 'react'
import type { AdminDashboardMeta } from '../siteContent'

/**
 * Page chrome for a dashboard. Deliberately lighter than the public PageFrame —
 * no hero card and no back link, because the icon bar is always on screen.
 */
export function AdminPage({ meta, children }: { meta: AdminDashboardMeta; children: ReactNode }) {
  return (
    <div className="admin-page" style={{ '--page-accent': meta.accent } as CSSProperties}>
      <header className="admin-page-head">
        <p className="eyebrow">{meta.eyebrow}</p>
        <h1>{meta.title}</h1>
      </header>

      <div className="page-grid">{children}</div>

      {meta.note ? <p className="admin-page-note">{meta.note}</p> : null}
    </div>
  )
}
