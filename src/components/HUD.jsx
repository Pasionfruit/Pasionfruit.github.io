import { useGame } from '../context/GameContext.jsx'
import './HUD.css'

// true if the primary pointer is coarse (touch screen)
const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches

export default function HUD() {
  const { nearZone, panelMode, enterZone } = useGame()
  if (panelMode) return null

  return (
    <div className="hud">
      {nearZone && (
        <div className="hud-zone-prompt" style={{ '--zone-color': nearZone.color }}>
          <span className="prompt-key">{isTouchPrimary ? 'TAP' : 'E'}</span>
          <span>Enter {nearZone.label}</span>
          {isTouchPrimary && (
            <button className="hud-zone-open-btn" onClick={() => enterZone(nearZone)}>
              Open
            </button>
          )}
        </div>
      )}
      <p className="hud-hint">
        {isTouchPrimary
          ? 'Joystick · ride to a zone · tap Open to enter'
          : 'WASD · ride to a zone · press E to enter'}
      </p>
    </div>
  )
}