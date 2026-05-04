import { useGame } from '../context/GameContext.jsx'
import './PanelOverlay.css'

const ZONE_CONTENT = {
  dashboard: { title: 'Dashboard', desc: 'Your personal hub — stats, activity, quick links.', emoji: '📊' },
  training:  { title: 'Training',  desc: 'Log runs, rides, swims. Track your fitness journey.', emoji: '🏃' },
  cooking:   { title: 'Cooking',   desc: 'Recipes, meal plans, and kitchen adventures.', emoji: '👨‍🍳' },
  portfolio: { title: 'Portfolio', desc: 'Projects, skills, and things I\'ve built.', emoji: '💼' },
}

export default function PanelOverlay() {
  const { panelMode, activeZone, exitZone } = useGame()
  if (!panelMode || !activeZone) return null

  const content = ZONE_CONTENT[activeZone.id] || {}

  return (
    <div className="panel-overlay">
      <div className="panel-backdrop" onClick={exitZone} />
      <div className="panel-card" style={{ '--accent': activeZone.color }}>
        <button className="panel-close" onClick={exitZone}>
          ← Back to World
        </button>
        <div className="panel-header">
          <span className="panel-emoji">{content.emoji}</span>
          <h1 className="panel-title">{content.title}</h1>
          <p className="panel-desc">{content.desc}</p>
        </div>
        <div className="panel-divider" />
        <div className="panel-body">
          <p className="panel-placeholder">🚧 Coming soon — ride back and explore more!</p>
        </div>
      </div>
    </div>
  )
}