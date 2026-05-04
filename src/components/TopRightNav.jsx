import { useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { ZONES } from '../experience/worldData.js'
import './TopRightNav.css'

export default function TopRightNav() {
  const [open, setOpen] = useState(false)
  const { enterZone, isNight, toggleDayNight } = useGame()

  const sections = useMemo(
    () => ZONES.map(z => ({ id: z.id, label: z.label, color: z.color })),
    []
  )

  function openSection(id) {
    const zone = ZONES.find(z => z.id === id)
    if (!zone) return
    enterZone(zone)
    setOpen(false)
  }

  return (
    <div className="top-right-nav">
      <button className="top-right-nav-btn" onClick={() => setOpen(v => !v)}>
        Website Nav
      </button>

      <button className="top-right-nav-btn" onClick={toggleDayNight}>
        {isNight ? 'Switch to Day' : 'Switch to Night'}
      </button>

      {open && (
        <div className="top-right-nav-menu">
          <p className="top-right-nav-title">Browse Sections</p>
          {sections.map(section => (
            <button
              key={section.id}
              className="top-right-nav-link"
              style={{ '--section-color': section.color }}
              onClick={() => openSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}