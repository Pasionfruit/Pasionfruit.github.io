import { createContext, useContext, useState } from 'react'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [nearZone,   setNearZone]   = useState(null)
  const [panelMode,  setPanelMode]  = useState(false)
  const [activeZone, setActiveZone] = useState(null)

  function enterZone(zone) {
    setActiveZone(zone)
    setPanelMode(true)
  }

  function exitZone() {
    setPanelMode(false)
    setActiveZone(null)
  }

  return (
    <GameContext.Provider value={{ nearZone, setNearZone, panelMode, activeZone, enterZone, exitZone }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}