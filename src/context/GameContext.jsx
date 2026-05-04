import { createContext, useContext, useState } from 'react'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const [nearZone,   setNearZone]   = useState(null)
  const [panelMode,  setPanelMode]  = useState(false)
  const [activeZone, setActiveZone] = useState(null)
  const [isNight, setIsNight] = useState(false)

  function enterZone(zone) {
    setActiveZone(zone)
    setPanelMode(true)
  }

  function exitZone() {
    setPanelMode(false)
    setActiveZone(null)
  }

  function toggleDayNight() {
    setIsNight(prev => !prev)
  }

  return (
    <GameContext.Provider
      value={{
        nearZone,
        setNearZone,
        panelMode,
        activeZone,
        enterZone,
        exitZone,
        isNight,
        toggleDayNight,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}