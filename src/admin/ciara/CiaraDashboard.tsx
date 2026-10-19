import { AdminPage } from '../AdminPage'
import { adminDashboardsById } from '../../siteContent'

/** Ciara's dashboard. A placeholder until her cards are decided. */
export function CiaraDashboard() {
  return (
    <AdminPage meta={adminDashboardsById.ciara}>
      <article className="info-card admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Welcome, Ciara</h2>
            <p className="sheets-meta">This page is still being set up.</p>
          </div>
        </div>
      </article>
    </AdminPage>
  )
}
