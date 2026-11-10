import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { Challenge } from '../data/challenges/client'
import { playShuffle, playTick, playWin, readMuted, writeMuted } from './wheelSound'

const SEGMENTS = 12
const SIZE = 200
const CENTER = SIZE / 2
const RADIUS = 96
const SPIN_MS = 4200
const COLORS = ['#a855f7', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899']

function sample<T>(list: T[], count: number): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

function point(angleDeg: number, radius: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)]
}

function shorten(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * A wheel of twelve challenges drawn from the pool: spin it and whatever stops
 * under the pointer is the pick. The twelve are fixed per mount (the parent
 * re-keys it to deal a new set), so marking one done does not redraw the wheel
 * mid-spin. Segment i spans [i·a, (i+1)·a) clockwise from the top; turning the
 * wheel by -(i+0.5)·a puts its middle under the pointer.
 */
export function ChallengeWheel({
  pool,
  onLanded,
  onReshuffle,
}: {
  pool: Challenge[]
  onLanded: (id: number) => void
  onReshuffle: () => void
}) {
  const [segments] = useState(() => {
    // Anything still to do first; once everything shown is done, the wheel is of done ones.
    const open = pool.filter((item) => item.status !== 'Done')
    return sample(open.length > 0 ? open : pool, SEGMENTS)
  })
  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const rotationRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const frameRef = useRef(0)
  const mutedRef = useRef(readMuted())
  const [muted, setMuted] = useState(mutedRef.current)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const count = segments.length
  const slice = count > 0 ? 360 / count : 360
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const duration = reduceMotion ? 300 : SPIN_MS

  function toggleMuted() {
    mutedRef.current = !mutedRef.current
    setMuted(mutedRef.current)
    writeMuted(mutedRef.current)
  }

  /** Clicks once each time a segment edge passes the pointer, following the real on-screen angle. */
  function trackTicks() {
    let last = -1
    const step = () => {
      const transform = svgRef.current ? getComputedStyle(svgRef.current).transform : 'none'
      const match = /^matrix\(([^,]+),([^,]+)/.exec(transform)
      if (match) {
        const angle = (Math.atan2(Number(match[2]), Number(match[1])) * 180) / Math.PI
        const under = Math.floor((((360 - angle) % 360) + 360) % 360 / slice)
        if (last !== -1 && under !== last && !mutedRef.current) playTick()
        last = under
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }

  function spin() {
    if (isSpinning || count === 0) return

    const winner = Math.floor(Math.random() * count)
    const current = rotationRef.current
    const base = current - (((current % 360) + 360) % 360)
    // Whole extra turns for the show, then the angle that parks the winner at the top.
    const target = base + 360 * 5 + (360 - (winner + 0.5) * slice)

    rotationRef.current = target
    setRotation(target)
    setIsSpinning(true)
    if (!reduceMotion) trackTicks()

    timerRef.current = setTimeout(() => {
      cancelAnimationFrame(frameRef.current)
      setIsSpinning(false)
      if (!mutedRef.current) playWin()
      onLanded(segments[winner].id)
    }, duration + 50)
  }

  return (
    <div className="challenge-wheel">
      <div className="challenge-wheel-stage">
        <span className="challenge-wheel-pointer" aria-hidden="true" />
        <svg
          ref={svgRef}
          className="challenge-wheel-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Challenge wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? `transform ${duration}ms cubic-bezier(0.12, 0.62, 0.1, 1)` : 'none',
          }}
        >
          {segments.map((item, index) => {
            const start = index * slice
            const end = (index + 1) * slice
            const [x1, y1] = point(start, RADIUS)
            const [x2, y2] = point(end, RADIUS)
            const middle = start + slice / 2
            const [tx, ty] = point(middle, RADIUS - 8)

            return (
              <g key={item.id}>
                <path
                  d={`M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${slice > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <text
                  x={tx}
                  y={ty}
                  transform={`rotate(${middle - 90} ${tx} ${ty})`}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="challenge-wheel-label"
                >
                  {shorten(item.challenge, 17)}
                </text>
              </g>
            )
          })}
          <circle cx={CENTER} cy={CENTER} r="9" fill="#fff" />
        </svg>
      </div>

      <div className="challenge-wheel-controls">
        <button type="button" className="challenge-btn is-primary" onClick={spin} disabled={isSpinning || count === 0}>
          {isSpinning ? 'Spinning…' : 'Spin the wheel'}
        </button>
        <button
          type="button"
          className="challenge-btn"
          onClick={() => {
            if (!mutedRef.current) playShuffle()
            onReshuffle()
          }}
          disabled={isSpinning}
        >
          New wheel
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
