import { PORTALS } from '../data/mapData.js'
import './ZonePortal.css'

export default function ZonePortal({ portal, tileSize }) {
  return (
    <div
      className="zone-portal"
      style={{
        left:   portal.x * tileSize,
        top:    portal.y * tileSize,
        width:  tileSize,
        height: tileSize,
        '--portal-color': portal.color,
      }}
      title={portal.label}
    >
      <span className="portal-label">{portal.label}</span>
    </div>
  )
}
