import { useEffect, useRef, useState } from 'react'
import { adminDashboardsById } from '../../siteContent'
import { Axolotl, Cat, Frog, FlowerGarland, LilyPad, Waterfall } from './critters'
import { CursorGlyph, CursorSwitch, type CursorKind } from './Cursors'
import { RelationshipClock } from './RelationshipClock'
import { Monthiversary } from './Monthiversary'
import { monthiversaryOn, TOGETHER_SINCE } from './elapsed'
import { StickyNotes } from './StickyNotes'
import { Timeline } from './Timeline'
import './ciara.css'

type Point = { x: number; y: number }

/** The most a cat's pupils can shift, in SVG units. */
const MAX_GAZE = 1.6
const NO_GAZE: Point = { x: 0, y: 0 }
const CURSOR_KEY = 'ciara-cursor'

/** The pointer last picked on this device, or the feather if none is stored. */
function readStoredCursor(): CursorKind {
  try {
    const stored = window.localStorage.getItem(CURSOR_KEY)
    if (stored === 'feather' || stored === 'laser' || stored === 'fish') return stored
  } catch {
    // Storage can be blocked; the default still works.
  }
  return 'feather'
}

/** How far to shift pupils so they point from the head at (headX, headY) toward (x, y). */
function gazeToward(headX: number, headY: number, x: number, y: number): Point {
  const dx = x - headX
  const dy = y - headY
  const distance = Math.hypot(dx, dy) || 1
  const strength = Math.min(distance / 120, 1) * MAX_GAZE
  return { x: (dx / distance) * strength, y: (dy / distance) * strength }
}

export function CiaraDashboard({ idToken }: { idToken: string }) {
  const { title } = adminDashboardsById.ciara

  const midnightRef = useRef<HTMLElement>(null)
  const inkyRef = useRef<HTMLElement>(null)
  const pirouetteRef = useRef<HTMLElement>(null)
  // Null when the pointer is off the page or on a touch screen.
  const [pointer, setPointer] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<CursorKind>(readStoredCursor)
  // Only the cat tied to the current pointer looks at it.
  const [gaze, setGaze] = useState<Point>(NO_GAZE)
  const [mouthOpen, setMouthOpen] = useState(false)
  // Checked once, when the page opens. Null on any day that is not a monthiversary.
  const [monthiversary, setMonthiversary] = useState<number | null>(() => monthiversaryOn(TOGETHER_SINCE, new Date()))

  useEffect(() => {
    const watcher = cursor === 'feather' ? midnightRef : cursor === 'laser' ? inkyRef : pirouetteRef

    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const { clientX: x, clientY: y } = event
      setPointer({ x, y })

      const rect = watcher.current?.getBoundingClientRect()
      if (!rect) return
      setGaze(gazeToward(rect.left + rect.width / 2, rect.top + 50, x, y))
    }
    const leave = () => setPointer(null)

    window.addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [cursor])

  function chooseCursor(kind: CursorKind) {
    setCursor(kind)
    setGaze(NO_GAZE)
    try {
      window.localStorage.setItem(CURSOR_KEY, kind)
    } catch {
      // Not saved; the choice still lasts until the page is left.
    }
  }

  // Every few seconds Inky opens her mouth for a moment, then shuts it again.
  useEffect(() => {
    let openTimer = 0
    let closeTimer = 0
    const schedule = () => {
      openTimer = window.setTimeout(() => {
        setMouthOpen(true)
        closeTimer = window.setTimeout(() => {
          setMouthOpen(false)
          schedule()
        }, 900)
      }, 3500 + Math.random() * 5000)
    }
    schedule()
    return () => {
      window.clearTimeout(openTimer)
      window.clearTimeout(closeTimer)
    }
  }, [])

  return (
    <div className="ciara-page">
      <div className="ciara-topbar">
        <CursorSwitch value={cursor} onChange={chooseCursor} />
      </div>

      <header className="ciara-hero">
        <FlowerGarland />
        <p className="ciara-kicker">our little corner</p>
        <h1 className="ciara-title">{title}</h1>

        <div className="ciara-scene">
          <Waterfall />
          <div className="ciara-pond">
            <LilyPad className="ciara-pad ciara-pad-a" />
            <LilyPad className="ciara-pad ciara-pad-b" />
            <LilyPad className="ciara-pad ciara-pad-c" />
            <Frog className="ciara-frog ciara-frog-a" />
            <Frog className="ciara-frog ciara-frog-b" />
            <Frog className="ciara-frog ciara-frog-c" />
            <figure className="ciara-critter ciara-axo-barbie">
              <Axolotl color="pink" />
              <figcaption>Barbie</figcaption>
            </figure>
            <figure className="ciara-critter ciara-axo-ken">
              <Axolotl color="blue" flip />
              <figcaption>Ken</figcaption>
            </figure>
          </div>
        </div>
      </header>

      <main className="ciara-body">
        <div className="ciara-perch">
          <figure ref={midnightRef} className="ciara-critter ciara-cat ciara-cat-midnight">
            <Cat coat="black" eyes="yellow" gaze={cursor === 'feather' ? gaze : NO_GAZE} />
            <figcaption>Midnight</figcaption>
          </figure>
          <figure ref={inkyRef} className="ciara-critter ciara-cat ciara-cat-inky">
            <Cat coat="black" eyes="green" gaze={cursor === 'laser' ? gaze : NO_GAZE} mouthOpen={mouthOpen} />
            <figcaption>Inky</figcaption>
          </figure>
          <figure ref={pirouetteRef} className="ciara-critter ciara-cat ciara-cat-pirouette">
            <Cat coat="white" eyes="blue" chubby gaze={cursor === 'fish' ? gaze : NO_GAZE} />
            <figcaption>Pirouette</figcaption>
          </figure>
          <RelationshipClock />
        </div>

        <div className="ciara-perch ciara-perch-timeline">
          <Timeline idToken={idToken} />
        </div>

        <StickyNotes idToken={idToken} />
      </main>

      {monthiversary !== null ? (
        <Monthiversary months={monthiversary} onClose={() => setMonthiversary(null)} />
      ) : null}

      {pointer ? <CursorGlyph kind={cursor} x={pointer.x} y={pointer.y} /> : null}
    </div>
  )
}
