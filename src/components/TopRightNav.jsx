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
  const now = Date.now()
  return {
    id: `timer-${Math.random().toString(36).slice(2, 10)}`,
    name,
    startTs: now,
    targetTs: now + days * DAY_MS,
    color,
  }
}

function endOfDayTimestamp(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 23, 59, 59, 999).getTime()
}

function createDateGoalTimer(name, targetTs, color) {
  return {
    id: `timer-${Math.random().toString(36).slice(2, 10)}`,
    name,
    startTs: Date.now(),
    targetTs,
    color,
  }
}

function formatRemainingDDHHMMSS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDateInputValue(ts) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateInputToEndOfDay(value) {
  if (typeof value !== 'string' || !value) return null
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  return endOfDayTimestamp(parts[0], parts[1] - 1, parts[2])
}

function defaultTimers() {
  const june13 = endOfDayTimestamp(2026, 5, 13)
  const july11 = endOfDayTimestamp(2026, 6, 11)
  const jan13 = endOfDayTimestamp(2027, 0, 13)

  return [
    createDateGoalTimer('First Goal', june13, TIMER_COLORS[0]),
    createDateGoalTimer('Second Goal', july11, TIMER_COLORS[1]),
    createDateGoalTimer('Third Goal', jan13, TIMER_COLORS[2]),
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
        typeof t.targetTs === 'number'
      )
      .map((t, i) => ({
        ...t,
        startTs: typeof t.startTs === 'number' ? t.startTs : Date.now(),
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
  const [editEndDate, setEditEndDate] = useState('')
  const {
    enterZone,
    isNight,
    toggleDayNight,
    raceStatus,
    raceLeaderboard,
    cancelRace,
  } = useGame()

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
    setEditEndDate(formatDateInputValue(timer.targetTs))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditEndDate('')
  }

  function saveEdit(id) {
    const nextName = editName.trim() || 'Countdown'
    const nextTargetTs = parseDateInputToEndOfDay(editEndDate)
    if (!nextTargetTs) return
    setTimers(prev => prev.map(t => (
      t.id === id
        ? {
            ...t,
            name: nextName,
            targetTs: nextTargetTs,
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
    const totalMs = Math.max(1, timer.targetTs - (timer.startTs || nowTs))
    const progress = Math.min(1, Math.max(0, remainingMs / totalMs))
    const isClosed = remainingDays <= 0
    const radius = 23
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - progress)
    const isEditing = editingId === timer.id
    const countdownLabel = formatRemainingDDHHMMSS(remainingMs)

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
                type="date"
                value={editEndDate}
                onChange={e => setEditEndDate(e.target.value)}
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
                {isClosed ? 'Closed' : countdownLabel}
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
              Stop at the checkered line and press Enter (or tap Enter Race). Countdown starts, then complete one full loop and cross again to finish. Desktop: press Escape to exit race.
            </p>
            {(raceStatus.lapActive || raceStatus.countdownActive) && (
              <div className="countdown-actions">
                <button className="countdown-btn danger" onClick={cancelRace}>Exit Race</button>
              </div>
            )}
          </div>

          <div className="race-leaderboard">
            <p className="race-board-title">Best Times</p>
            {raceLeaderboard.length === 0 && (
              <p className="race-empty">No laps yet. Start racing!</p>
            )}
            {raceLeaderboard.map((entry, i) => (
              <div key={entry.id} className="race-row">
                <span>#{i + 1} {entry.name || 'Guest'}</span>
                <strong>{formatLapTime(entry.ms)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}