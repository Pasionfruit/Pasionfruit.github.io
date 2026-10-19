import { AdminPage } from '../AdminPage'
import { adminDashboardsById } from '../../siteContent'
import { RelationshipClock } from './RelationshipClock'
import { Timeline } from './Timeline'
import './ciara.css'

export function CiaraDashboard({ idToken }: { idToken: string }) {
  return (
    <AdminPage meta={adminDashboardsById.ciara}>
      <RelationshipClock />
      <Timeline idToken={idToken} />
    </AdminPage>
  )
}
