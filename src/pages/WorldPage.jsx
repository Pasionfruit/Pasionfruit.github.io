import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext.jsx'
import WorldMap from '../components/WorldMap.jsx'
import DPad from '../components/DPad.jsx'
import { useMovement } from '../hooks/useMovement.js'
import './WorldPage.css'

export default function WorldPage() {
  const { player } = usePlayer()
  const navigate = useNavigate()
  const { dpadStart, dpadEnd } = useMovement()

  // Redirect to login if no name set (e.g. direct URL access)
  useEffect(() => {
    if (!player.name) navigate('/', { replace: true })
  }, [player.name, navigate])

  if (!player.name) return null

  return (
    <div className="world-page">
      <WorldMap />

      {/* HUD: player name */}
      <div className="hud-name">
        <span>{player.name}</span>
      </div>

      {/* State indicator */}
      <div className="hud-state">
        {player.characterState === 'run'  && '🏃 Running'}
        {player.characterState === 'bike' && '🚲 Biking'}
        {player.characterState === 'swim' && '🏊 Swimming'}
      </div>

      {/* Mobile D-pad */}
      <div className="dpad-container">
        <DPad onStart={dpadStart} onEnd={dpadEnd} />
      </div>
    </div>
  )
}
