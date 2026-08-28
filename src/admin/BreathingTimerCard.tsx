import { useEffect, useRef, useState } from 'react'

/**
 * Phases of one breath cycle, in seconds. Box breathing is the default because
 * the even count is easy to follow without watching the numbers; 4-7-8 is the
 * slower wind-down pattern.
 */
type Pattern = {
  id: string
  label: string
  description: string
  phases: { label: string; seconds: number }[]
}

const PATTERNS: Pattern[] = [
  {
    id: 'box',
    label: 'Box 4-4-4-4',
    description: 'Even counts. Good for settling before something.',
    phases: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 4 },
      { label: 'Exhale', seconds: 4 },
      { label: 'Hold', seconds: 4 },
    ],
  },
  {
    id: '478',
    label: 'Relaxing 4-7-8',
    description: 'Long exhale. Better for winding down at the end of a day.',
    phases: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 7 },
      { label: 'Exhale', seconds: 8 },
    ],
  },
  {
    id: 'coherent',
    label: 'Coherent 5-5',
    description: 'Five in, five out. The simplest one to keep going.',
    phases: [
      { label: 'Inhale', seconds: 5 },
      { label: 'Exhale', seconds: 5 },
    ],
  },
]

const DURATIONS = [1, 3, 5, 10]

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function BreathingTimerCard({ title }: { title: string }) {
  const [patternId, setPatternId] = useState(PATTERNS[0].id)
  const [minutes, setMinutes] = useState(3)
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseRemaining, setPhaseRemaining] = useState(PATTERNS[0].phases[0].seconds)
  const [cycles, setCycles] = useState(0)

  const pattern = PATTERNS.find((item) => item.id === patternId) ?? PATTERNS[0]
  const phase = pattern.phases[phaseIndex] ?? pattern.phases[0]
  const totalSeconds = minutes * 60
  const isDone = elapsed >= totalSeconds

  // Kept in refs so the interval callback never reads stale state.
  const phaseIndexRef = useRef(0)
  const phaseRemainingRef = useRef(pattern.phases[0].seconds)

  function reset(nextPattern = pattern) {
    setIsRunning(false)
    setElapsed(0)
    setPhaseIndex(0)
    setCycles(0)
    setPhaseRemaining(nextPattern.phases[0].seconds)
    phaseIndexRef.current = 0
    phaseRemainingRef.current = nextPattern.phases[0].seconds
  }

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const id = window.setInterval(() => {
      setElapsed((previous) => {
        const next = previous + 1
        if (next >= totalSeconds) {
          setIsRunning(false)
          return totalSeconds
        }
        return next
      })

      const remaining = phaseRemainingRef.current - 1

      if (remaining > 0) {
        phaseRemainingRef.current = remaining
        setPhaseRemaining(remaining)
        return
      }

      // Phase finished — advance, and count a cycle when we wrap to the start.
      const nextIndex = (phaseIndexRef.current + 1) % pattern.phases.length
      phaseIndexRef.current = nextIndex
      phaseRemainingRef.current = pattern.phases[nextIndex].seconds
      setPhaseIndex(nextIndex)
      setPhaseRemaining(pattern.phases[nextIndex].seconds)

      if (nextIndex === 0) {
        setCycles((previous) => previous + 1)
      }
    }, 1000)

    return () => window.clearInterval(id)
  }, [isRunning, pattern, totalSeconds])

  const isInhale = phase.label === 'Inhale'
  const isExhale = phase.label === 'Exhale'
  // The ring holds its size through a hold phase rather than snapping back.
  const scale = isInhale ? 1 : isExhale ? 0.55 : phaseIndex === 1 ? 1 : 0.55

  return (
    <article className="info-card admin-card breathing-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <span className="admin-pill">
          {isDone ? 'Done' : formatClock(Math.max(0, totalSeconds - elapsed))}
        </span>
      </div>

      <div className="breathing-stage">
        <div
          className={`breathing-ring ${isRunning ? 'running' : ''}`}
          style={{
            transform: `scale(${scale})`,
            transitionDuration: `${phase.seconds}s`,
          }}
          aria-hidden="true"
        />
        <div className="breathing-readout">
          <p className="breathing-phase">{isDone ? 'Finished' : isRunning ? phase.label : 'Ready'}</p>
          <p className="breathing-count">{isRunning ? phaseRemaining : pattern.label.split(' ')[0]}</p>
        </div>
      </div>

      {/* The visual ring is decorative; this is what a screen reader follows. */}
      <p className="sr-only" role="status" aria-live="polite">
        {isRunning ? `${phase.label} for ${phaseRemaining} seconds` : ''}
      </p>

      <div className="breathing-controls">
        <button
          type="button"
          className="primary-action"
          onClick={() => (isDone ? reset() : setIsRunning((value) => !value))}
        >
          {isDone ? 'Restart' : isRunning ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
        </button>
        <button type="button" className="secondary-action" onClick={() => reset()} disabled={elapsed === 0}>
          Reset
        </button>
        <span className="admin-pill">{cycles} cycles</span>
      </div>

      <div className="breathing-options">
        <label>
          <span>Pattern</span>
          <select
            value={patternId}
            onChange={(event) => {
              const next = PATTERNS.find((item) => item.id === event.target.value) ?? PATTERNS[0]
              setPatternId(next.id)
              reset(next)
            }}
          >
            {PATTERNS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="breathing-durations" role="group" aria-label="Session length">
          {DURATIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === minutes ? 'active' : ''}
              onClick={() => {
                setMinutes(value)
                reset()
              }}
            >
              {value}m
            </button>
          ))}
        </div>
      </div>

      <p className="sheets-meta">{pattern.description}</p>
    </article>
  )
}
