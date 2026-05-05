import { createContext, useContext, useEffect, useState } from 'react'

const GameContext = createContext(null)

function loadRaceLeaderboard() {
  try {
    const raw = window.localStorage.getItem('pf.race.leaderboard')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(entry => entry && typeof entry.ms === 'number' && typeof entry.at === 'number')
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 8)
  } catch {
    return []
  }
}

function loadCatsEnabled() {
  try {
    const raw = window.localStorage.getItem('pf.cats.enabled')
    if (raw == null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

export function GameProvider({ children }) {
  const [nearZone,   setNearZone]   = useState(null)
  const [panelMode,  setPanelMode]  = useState(false)
  const [activeZone, setActiveZone] = useState(null)
  const [isNight, setIsNight] = useState(false)
  const [raceStatus, setRaceStatus] = useState({
    lapActive: false,
    lapStartTs: null,
    currentLapMs: 0,
    checkpointMask: 0,
    lastLapMs: null,
    completedLaps: 0,
  })
  const [raceLeaderboard, setRaceLeaderboard] = useState(loadRaceLeaderboard)
  const [catsEnabled, setCatsEnabled] = useState(loadCatsEnabled)

  useEffect(() => {
    window.localStorage.setItem('pf.race.leaderboard', JSON.stringify(raceLeaderboard))
  }, [raceLeaderboard])

  useEffect(() => {
    window.localStorage.setItem('pf.cats.enabled', String(catsEnabled))
  }, [catsEnabled])

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

  function toggleCatsEnabled() {
    setCatsEnabled(prev => !prev)
  }

  function startRaceLap(startTs) {
    setRaceStatus(prev => ({
      ...prev,
      lapActive: true,
      lapStartTs: startTs,
      currentLapMs: 0,
      checkpointMask: 0,
    }))
  }

  function updateRaceLap(currentLapMs, checkpointMask) {
    setRaceStatus(prev => {
      if (!prev.lapActive) return prev
      return {
        ...prev,
        currentLapMs,
        checkpointMask,
      }
    })
  }

  function completeRaceLap(lapMs, finishedAtTs) {
    setRaceStatus(prev => ({
      ...prev,
      lapActive: false,
      lapStartTs: null,
      currentLapMs: 0,
      checkpointMask: 0,
      lastLapMs: lapMs,
      completedLaps: prev.completedLaps + 1,
    }))

    setRaceLeaderboard(prev => {
      const next = [
        ...prev,
        {
          id: `lap-${finishedAtTs}-${Math.random().toString(36).slice(2, 8)}`,
          ms: lapMs,
          at: finishedAtTs,
        },
      ]
      next.sort((a, b) => a.ms - b.ms)
      return next.slice(0, 8)
    })
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
        raceStatus,
        raceLeaderboard,
        catsEnabled,
        toggleCatsEnabled,
        startRaceLap,
        updateRaceLap,
        completeRaceLap,
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
