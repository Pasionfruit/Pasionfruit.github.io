import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePlayer } from "../context/PlayerContext.jsx"
import { GameProvider } from "../context/GameContext.jsx"
import Experience from "../experience/Experience.jsx"
import HUD from "../components/HUD.jsx"
import PanelOverlay from "../components/PanelOverlay.jsx"
import DPad from "../components/DPad.jsx"
import TopRightNav from "../components/TopRightNav.jsx"
import SettingsPanel from "../components/SettingsPanel.jsx"
import "./WorldPage.css"

function WorldScene() {
  return (
    <>
      <Experience />
      <SettingsPanel />
      <HUD />
      <TopRightNav />
      <PanelOverlay />
      <div className="dpad-container">
        <DPad />
      </div>
    </>
  )
}

export default function WorldPage() {
  const { player } = usePlayer()
  const navigate   = useNavigate()

  useEffect(() => {
    if (!player.name) navigate('/', { replace: true })
  }, [player.name, navigate])

  if (!player.name) return null

  return (
    <GameProvider>
      <WorldScene />
    </GameProvider>
  )
}
