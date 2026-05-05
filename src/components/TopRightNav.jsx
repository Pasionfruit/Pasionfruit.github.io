import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import { ZONES } from '../experience/worldData.js'
import './TopRightNav.css'

const DAY_MS = 24 * 60 * 60 * 1000
const TIMER_COLORS = ['#7ec8ff', '#8fff91', '#ffb36b', '#ff7ea6', '#d9a4ff']

function formatLapTime(ms) {
  if (typeof ms !== 'number' || ms <= 0) return '--:--.---'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

function createTimer(days, name, color) {
  return {
    id: `timer-${Math.random().toString(36).slice(2, 10)}`,
    name,
    totalDays: days,
    targetTs: Date.now() + days * DAY_MS,
    color,
  }
}

function defaultTimers() {
  return [
    createTimer(39, '39-Day Goal', TIMER_COLORS[0]),
    createTimer(67, '67-Day Goal', TIMER_COLORS[1]),
    createTimer(253, '253-Day Goal', TIMER_COLORS[2]),
  ]
}

function loadTimers() {
  try {
    const raw = window.localStorage.getItem('pf.countdowns')
    if (!raw) return defaultTimers()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultTimers()
    const valid = parsed
      .filter(t =>
        t &&
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        typeof t.totalDays === 'number' &&
        typeof t.targetTs === 'number'
      )
      .map((t, i) => ({
        ...t,
        color: typeof t.color === 'string' ? t.color : TIMER_COLORS[i % TIMER_COLORS.length],
      }))
    return valid.length > 0 ? valid : defaultTimers()
  } catch {
    return defaultTimers()
  }
}

export default function TopRightNav() {
  const [open, setOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false)
  const [raceOpen, setRaceOpen] = useState(false)
  const [timers, setTimers] = useState(loadTimers)
  const [nowTs, setNowTs] = useState(Date.now())
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDays, setEditDays] = useState('')
  const {
    enterZone,
    isNight,
    toggleDayNight,
    raceStatus,
    raceLeaderboard,
    catsEnabled,
    toggleCatsEnabled,
  } = useGame()
  const catsVisible = catsEnabled && !raceStatus.lapActive

  const sections = useMemo(
    () => ZONES.map(z => ({ id: z.id, label: z.label, color: z.color })),
    []
  )

  function openSection(id) {
    const zone = ZONES.find(z => z.id === id)
    if (!zone) return
    enterZone(zone)
    setOpen(false)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('pf.countdowns', JSON.stringify(timers))
  }, [timers])

  function startEdit(timer) {
    setEditingId(timer.id)
    setEditName(timer.name)
    setEditDays(String(timer.totalDays))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditDays('')
  }

  function saveEdit(id) {
    const nextName = editName.trim() || 'Countdown'
    const nextDays = Math.max(1, Math.min(5000, Number(editDays) || 1))
    setTimers(prev => prev.map(t => (
      t.id === id
        ? {
            ...t,
            name: nextName,
            totalDays: nextDays,
            targetTs: Date.now() + nextDays * DAY_MS,
          }
        : t
    )))
    cancelEdit()
  }

  function removeTimer(id) {
    setTimers(prev => {
      const next = prev.filter(t => t.id !== id)
      return next.length > 0 ? next : defaultTimers()
    })
  }

  function renderTimer(timer) {
    const remainingMs = Math.max(0, timer.targetTs - nowTs)
    const remainingDays = Math.ceil(remainingMs / DAY_MS)
    const totalMs = Math.max(1, timer.totalDays * DAY_MS)
    const progress = Math.min(1, Math.max(0, remainingMs / totalMs))
    const completedDays = Math.max(0, Math.min(timer.totalDays, timer.totalDays - remainingDays))
    const isClosed = remainingDays <= 0
    const radius = 23
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - progress)
    const isEditing = editingId === timer.id

    return (
      <div key={timer.id} className="countdown-card">
        <div className="countdown-progress-wrap" aria-hidden="true">
          <svg className="countdown-progress" viewBox="0 0 56 56" style={{ '--timer-color': timer.color }}>
            <circle className="countdown-bg" cx="28" cy="28" r={radius} />
            <circle
              className="countdown-fg"
              cx="28"
              cy="28"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="countdown-days">{remainingDays}</div>
        </div>

        <div className="countdown-meta">
          {isEditing ? (
            <>
              <input
                className="countdown-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Timer name"
              />
              <input
                className="countdown-input"
                type="number"
                min="1"
                max="5000"
                value={editDays}
                onChange={e => setEditDays(e.target.value)}
                placeholder="Days"
              />
              <div className="countdown-actions">
                <button className="countdown-btn" onClick={() => saveEdit(timer.id)}>Save</button>
                <button className="countdown-btn ghost" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="countdown-name">{timer.name}</p>
              <p className="countdown-sub">
                Completed: {completedDays} day{completedDays === 1 ? '' : 's'} · {isClosed ? 'Closed' : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`}
              </p>
              <div className="countdown-actions">
                <button className="countdown-btn" onClick={() => startEdit(timer)}>Edit</button>
                <button className="countdown-btn danger" onClick={() => removeTimer(timer.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="top-right-nav">
      <button className="top-right-nav-btn" onClick={() => setOpen(v => !v)}>
        Website Nav
      </button>

      <button className="top-right-nav-btn" onClick={() => setCountdownOpen(v => !v)}>
        Countdown Timers
      </button>

      <button className="top-right-nav-btn" onClick={() => setRaceOpen(v => !v)}>
        Race Leaderboard
      </button>

      <button className="top-right-nav-btn" onClick={toggleCatsEnabled}>
        {raceStatus.lapActive ? 'Cats: Auto Off (Racing)' : `Cats: ${catsVisible ? 'On' : 'Off'}`}
      </button>

      <button className="top-right-nav-btn" onClick={toggleDayNight}>
        {isNight ? 'Switch to Day' : 'Switch to Night'}
      </button>

      {open && (
        <div className="top-right-nav-menu">
          <p className="top-right-nav-title">Browse Sections</p>
          {sections.map(section => (
            <button
              key={section.id}
              className="top-right-nav-link"
              style={{ '--section-color': section.color }}
              onClick={() => openSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      )}

      {countdownOpen && (
        <div className="top-right-nav-menu countdown-menu">
          <p className="top-right-nav-title">Countdowns</p>
          {timers.map(renderTimer)}
        </div>
      )}

      {raceOpen && (
        <div className="top-right-nav-menu race-menu">
          <p className="top-right-nav-title">Perimeter Race</p>

          <div className="race-status">
            <p className="race-line">
              <span>Current Lap</span>
              <strong>{raceStatus.lapActive ? formatLapTime(raceStatus.currentLapMs) : 'Waiting at Start'}</strong>
            </p>
            <p className="race-line">
              <span>Last Lap</span>
              <strong>{raceStatus.lastLapMs ? formatLapTime(raceStatus.lastLapMs) : '--:--.---'}</strong>
            </p>
            <p className="race-line">
              <span>Completed Laps</span>
              <strong>{raceStatus.completedLaps}</strong>
            </p>
            <p className="race-hint">
              Stop at the checkered line and press Enter (or tap Enter Race). Countdown starts, then complete one full loop and cross again to finish.
            </p>
          </div>

          <div className="race-leaderboard">
            <p className="race-board-title">Best Times</p>
            {raceLeaderboard.length === 0 && (
              <p className="race-empty">No laps yet. Start racing!</p>
            )}
            {raceLeaderboard.map((entry, i) => (
              <div key={entry.id} className="race-row">
                <span>#{i + 1}</span>
                <strong>{formatLapTime(entry.ms)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}