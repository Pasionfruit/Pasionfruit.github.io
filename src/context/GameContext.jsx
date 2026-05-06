import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePlayer } from './PlayerContext.jsx'
import { fetchRemoteLeaderboard, isSheetsSyncEnabled, sendLapRecord, sendLogEvent } from '../services/sheetsSync.js'

const GameContext = createContext(null)

const DEFAULT_CONTROL_BINDINGS = {
  forward: 'w',
  backward: 's',
  left: 'a',
  right: 'd',
  brake: 'Space',
  boost: 'ShiftLeft',
}

function loadRaceLeaderboard() {
  try {
    const raw = window.localStorage.getItem('pf.race.leaderboard')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(entry => entry && typeof entry.ms === 'number' && typeof entry.at === 'number')
      .map(entry => ({
        ...entry,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Guest',
      }))
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 8)
  } catch {
    return []
  }
}

function normalizeLeaderboardEntries(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .filter(entry => entry && typeof entry.ms === 'number' && typeof entry.at === 'number')
    .map((entry, idx) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `lap-${entry.at}-${idx}`,
      ms: entry.ms,
      at: entry.at,
      name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Guest',
    }))
}

function mergeLeaderboards(localEntries, remoteEntries) {
  const merged = [...normalizeLeaderboardEntries(localEntries), ...normalizeLeaderboardEntries(remoteEntries)]
  const deduped = []
  const seen = new Set()
  for (const entry of merged) {
    const key = `${entry.name}|${entry.ms}|${entry.at}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }
  deduped.sort((a, b) => a.ms - b.ms)
  return deduped.slice(0, 8)
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

function loadControlBindings() {
  try {
    const raw = window.localStorage.getItem('pf.controls.bindings')
    if (!raw) return DEFAULT_CONTROL_BINDINGS
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CONTROL_BINDINGS
    const next = {
      ...DEFAULT_CONTROL_BINDINGS,
      ...Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === 'string' && value.trim())
      ),
    }

    // Backward compatibility: migrate old "drift" binding to "boost".
    if ((!next.boost || !next.boost.trim()) && typeof parsed.drift === 'string' && parsed.drift.trim()) {
      next.boost = parsed.drift.trim()
    }

    return next
  } catch {
    return DEFAULT_CONTROL_BINDINGS
  }
}

function logIfEnabled(eventName, payload) {
  if (!isSheetsSyncEnabled()) return
  sendLogEvent(eventName, payload)
}

export function GameProvider({ children }) {
  const { player } = usePlayer()
  const playerName = useMemo(
    () => (typeof player?.name === 'string' && player.name.trim() ? player.name.trim() : 'Guest'),
    [player?.name]
  )
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
    canStart: false,
    countdownActive: false,
    countdownRemainingMs: 0,
  })
  const [raceLeaderboard, setRaceLeaderboard] = useState(loadRaceLeaderboard)
  const [catsEnabled, setCatsEnabled] = useState(loadCatsEnabled)
  const [controlBindings, setControlBindings] = useState(loadControlBindings)

  useEffect(() => {
    window.localStorage.setItem('pf.race.leaderboard', JSON.stringify(raceLeaderboard))
  }, [raceLeaderboard])

  useEffect(() => {
    window.localStorage.setItem('pf.cats.enabled', String(catsEnabled))
  }, [catsEnabled])

  useEffect(() => {
    window.localStorage.setItem('pf.controls.bindings', JSON.stringify(controlBindings))
  }, [controlBindings])

  useEffect(() => {
    logIfEnabled('session_started', { playerName })
  }, [playerName])

  useEffect(() => {
    let cancelled = false

    async function syncRemoteLeaderboard() {
      if (!isSheetsSyncEnabled()) return
      const remote = await fetchRemoteLeaderboard()
      if (cancelled || remote.length === 0) return
      setRaceLeaderboard(prev => mergeLeaderboards(prev, remote))
    }

    syncRemoteLeaderboard()
    return () => {
      cancelled = true
    }
  }, [])

  function enterZone(zone) {
    logIfEnabled('zone_entered', {
      playerName,
      zoneId: zone?.id || null,
      zoneLabel: zone?.label || null,
    })
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

  function setControlBinding(action, key) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTROL_BINDINGS, action)) return
    if (typeof key !== 'string' || !key.trim()) return
    setControlBindings(prev => ({
      ...prev,
      [action]: key,
    }))
  }

  function resetControlBindings() {
    setControlBindings(DEFAULT_CONTROL_BINDINGS)
  }

  function setRaceStartReady(canStart) {
    setRaceStatus(prev => {
      if (prev.canStart === canStart) return prev
      return {
        ...prev,
        canStart,
      }
    })
  }

  function requestRaceStart() {
    logIfEnabled('race_start_requested', {
      playerName,
      canStart: raceStatus.canStart,
      lapActive: raceStatus.lapActive,
      countdownActive: raceStatus.countdownActive,
    })

    setRaceStatus(prev => {
      if (!prev.canStart || prev.lapActive || prev.countdownActive) return prev
      return {
        ...prev,
        countdownActive: true,
        countdownRemainingMs: 3000,
      }
    })
  }

  function cancelRace() {
    logIfEnabled('race_canceled', {
      playerName,
      lapActive: raceStatus.lapActive,
      countdownActive: raceStatus.countdownActive,
      currentLapMs: raceStatus.currentLapMs,
    })

    setRaceStatus(prev => ({
      ...prev,
      lapActive: false,
      lapStartTs: null,
      currentLapMs: 0,
      checkpointMask: 0,
      canStart: false,
      countdownActive: false,
      countdownRemainingMs: 0,
    }))
  }

  function startRaceLap(startTs) {
    logIfEnabled('race_started', {
      playerName,
      startTs,
    })

    setRaceStatus(prev => ({
      ...prev,
      lapActive: true,
      lapStartTs: startTs,
      currentLapMs: 0,
      checkpointMask: 0,
      canStart: false,
      countdownActive: false,
      countdownRemainingMs: 0,
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
    const record = {
      id: `lap-${finishedAtTs}-${Math.random().toString(36).slice(2, 8)}`,
      ms: lapMs,
      at: finishedAtTs,
      name: playerName,
    }

    setRaceStatus(prev => ({
      ...prev,
      lapActive: false,
      lapStartTs: null,
      currentLapMs: 0,
      checkpointMask: 0,
      lastLapMs: lapMs,
      completedLaps: prev.completedLaps + 1,
      canStart: false,
      countdownActive: false,
      countdownRemainingMs: 0,
    }))

    if (player?.isGuest) {
      logIfEnabled('lap_completed_guest_unsaved', {
        playerName,
        lapMs,
        finishedAtTs,
      })
      return
    }

    setRaceLeaderboard(prev => {
      const next = [
        ...prev,
        record,
      ]
      next.sort((a, b) => a.ms - b.ms)
      return next.slice(0, 8)
    })

    if (isSheetsSyncEnabled()) {
      sendLapRecord(record)
      logIfEnabled('lap_completed', {
        playerName,
        lapMs,
        finishedAtTs,
      })
    }
  }

  useEffect(() => {
    if (!raceStatus.countdownActive) return
    const countdownEndTs = Date.now() + raceStatus.countdownRemainingMs
    const timer = window.setInterval(() => {
      const remainingMs = Math.max(0, countdownEndTs - Date.now())
      if (remainingMs <= 0) {
        window.clearInterval(timer)
        startRaceLap(Date.now())
        return
      }
      setRaceStatus(prev => {
        if (!prev.countdownActive) return prev
        return {
          ...prev,
          countdownRemainingMs: remainingMs,
        }
      })
    }, 60)

    return () => window.clearInterval(timer)
  }, [raceStatus.countdownActive])

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
        controlBindings,
        toggleCatsEnabled,
        setControlBinding,
        resetControlBindings,
        setRaceStartReady,
        requestRaceStart,
        cancelRace,
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
