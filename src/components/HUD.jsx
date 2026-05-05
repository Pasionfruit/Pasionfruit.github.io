import { useGame } from '../context/GameContext.jsx'
import './HUD.css'

// true if the primary pointer is coarse (touch screen)
const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches

export default function HUD() {
  const { nearZone, panelMode, enterZone, raceStatus, requestRaceStart, cancelRace } = useGame()
  if (panelMode) return null

  const showRacePrompt = raceStatus.canStart && !raceStatus.lapActive && !raceStatus.countdownActive
  const countdownValue = Math.max(1, Math.ceil(raceStatus.countdownRemainingMs / 1000))

  const lapMs = raceStatus.currentLapMs
  const totalSeconds = Math.floor(lapMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = lapMs % 1000
  const lapClock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`

  return (
    <div className="hud">
      {(raceStatus.countdownActive || raceStatus.lapActive) && (
        <div className="race-top-clock" aria-live="polite">
          {raceStatus.countdownActive ? (
            <>
              <span className="race-clock-label">Race starts in</span>
              <strong className="race-countdown-number">{countdownValue}</strong>
              <button className="hud-race-start-btn hud-race-exit-btn" onClick={cancelRace}>
                Exit Race
              </button>
            </>
          ) : (
            <>
              <span className="race-clock-label">Race Clock</span>
              <strong className="race-clock-value">{lapClock}</strong>
              <button className="hud-race-start-btn hud-race-exit-btn" onClick={cancelRace}>
                Exit Race
              </button>
            </>
          )}
        </div>
      )}

      {showRacePrompt && (
        <div className="hud-race-prompt">
          <span className="prompt-key">Enter</span>
          <span>Ready to race</span>
          <button className="hud-race-start-btn" onClick={requestRaceStart}>
            Enter Race
          </button>
        </div>
      )}

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