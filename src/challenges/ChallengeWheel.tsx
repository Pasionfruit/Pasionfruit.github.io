import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { Challenge } from '../data/challenges/client'
import { playTick, playWin, readMuted, writeMuted } from './wheelSound'

/** Rows visible in the window; the middle one is the pick. */
const WINDOW_ROWS = 3
/** Every spin passes at least this many challenges before it settles. */
const MIN_TRAVEL = 40
const SPIN_MS = 4200

function shuffled<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * A slot-machine reel of every challenge in the pool: spin it and the reel
 * runs fast, then slows and stops with the winner in the middle row.
 *
 * The strip is rendered from `start` (the challenge now in the middle row), so
 * only the rows a spin will pass are in the DOM. A spin scrolls the strip by
 * `travel` rows; when it ends, `start` moves on by the same amount and the
 * strip snaps back to the top, which looks identical because the rows under
 * the window are the same ones. The order is fixed per mount (the parent
 * re-keys it when the filter changes), so marking one done does not reshuffle
 * the reel mid-spin.
 */
export function ChallengeWheel({
  pool,
  onLanded,
}: {
  pool: Challenge[]
  onLanded: (id: number) => void
}) {
  const [items] = useState(() => shuffled(pool))
  const [start, setStart] = useState(0)
  // Rows the strip is scrolled by during a spin; 0 at rest.
  const [travel, setTravel] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef(0)
  const [muted, setMuted] = useState(readMuted)
  const mutedRef = useRef(muted)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const count = items.length
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const duration = reduceMotion ? 300 : SPIN_MS

  function toggleMuted() {
    mutedRef.current = !mutedRef.current
    setMuted(mutedRef.current)
    writeMuted(mutedRef.current)
  }

  /** Clicks once each time a new row passes the middle, following the real on-screen position. */
  function trackTicks() {
    let last = -1
    const step = () => {
      const strip = stripRef.current
      const rowPx = strip?.firstElementChild?.getBoundingClientRect().height ?? 0
      const transform = strip ? getComputedStyle(strip).transform : 'none'
      const match = /^matrix\(([^)]*)\)$/.exec(transform)
      if (rowPx > 0 && match) {
        const shifted = -Number(match[1].split(',')[5])
        const row = Math.floor(shifted / rowPx)
        if (last !== -1 && row !== last && !mutedRef.current) playTick()
        last = row
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }

  function spin() {
    if (isSpinning || count === 0) return

    const winner = Math.floor(Math.random() * count)
    // Rows to scroll so the winner ends in the middle: at least MIN_TRAVEL for the show.
    let rows = (winner - start + count) % count
    while (rows < MIN_TRAVEL) rows += count

    setTravel(rows)
    setIsSpinning(true)
    if (!reduceMotion) trackTicks()

    timerRef.current = setTimeout(() => {
      cancelAnimationFrame(frameRef.current)
      // The same rows are under the window after the snap, so nothing visibly jumps.
      setStart((current) => (current + rows) % count)
      setTravel(0)
      setIsSpinning(false)
      if (!mutedRef.current) playWin()
      onLanded(items[winner].id)
    }, duration + 50)
  }

  // The strip begins one row before `start`, so `start` sits in the middle row at rest.
  const strip =
    count === 0
      ? []
      : Array.from({ length: travel + WINDOW_ROWS }, (_, k) => items[(start - 1 + k + count * 2) % count])

  return (
    <div className="challenge-wheel">
      <div className="challenge-reel" role="img" aria-label="Challenge slot machine">
        <div className="challenge-reel-window">
          <div
            ref={stripRef}
            className="challenge-reel-strip"
            style={{
              transform: `translateY(calc(var(--reel-row) * ${-travel}))`,
              transition: isSpinning ? `transform ${duration}ms cubic-bezier(0.2, 0.75, 0.1, 1)` : 'none',
            }}
          >
            {strip.map((item, index) => (
              <div
                key={index}
                className={`challenge-reel-row${!isSpinning && index === 1 ? ' is-middle' : ''}`}
                aria-hidden="true"
              >
                <span className="challenge-reel-num">#{item.id}</span>
                <span className="challenge-reel-text">{item.challenge}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="challenge-reel-marker is-left" aria-hidden="true" />
        <span className="challenge-reel-marker is-right" aria-hidden="true" />
      </div>

      <div className="challenge-wheel-controls">
        <button type="button" className="challenge-btn is-primary" onClick={spin} disabled={isSpinning || count === 0}>
          {isSpinning ? 'Spinning…' : 'Spin the wheel'}
        </button>
        <button
          type="button"
          className="challenge-icon-btn"
          aria-label={muted ? 'Turn wheel sounds on' : 'Turn wheel sounds off'}
          aria-pressed={!muted}
          onClick={toggleMuted}
        >
          {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
