import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePlayer } from "../context/PlayerContext.jsx"
import { GameProvider } from "../context/GameContext.jsx"
import Experience from "../experience/Experience.jsx"
import HUD from "../components/HUD.jsx"
import PanelOverlay from "../components/PanelOverlay.jsx"
import DPad from "../components/DPad.jsx"
import "./WorldPage.css"

function WorldScene() {
  return (
    <>
      <Experience />
      <HUD />
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
  }, [player.name, navigate])


  return (
    <GameProvider>
      <WorldScene />
    </GameProvider>
  )
}
