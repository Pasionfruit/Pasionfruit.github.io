import { useEffect, useRef, useState } from 'react'
import { adminDashboardsById } from '../../siteContent'
import { Axolotl, Cat, Frog, FlowerGarland, LilyPad, Waterfall } from './critters'
import { CursorGlyph, CursorSwitch, type CursorKind } from './Cursors'
import { RelationshipClock } from './RelationshipClock'
import { Monthiversary } from './Monthiversary'
import { monthiversaryOn, TOGETHER_SINCE } from './elapsed'
import { meowOnce } from './meow'
import { StickyNote, StickyStatus } from './StickyNotes'
import { useStickyNotes } from './useStickyNotes'
import { Timeline } from './Timeline'
import './ciara.css'

type Point = { x: number; y: number }

/** The most a cat's pupils can shift, in SVG units. */
const MAX_GAZE = 1.6
/** How close the feather has to come to Midnight before her tail wiggles, in pixels. */
const TAIL_WIGGLE_RANGE = 220
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
  // Midnight's tail wiggles while the feather is close to her.
  const [tailWiggle, setTailWiggle] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  // Checked once, when the page opens. Null on any day that is not a monthiversary.
  const [monthiversary, setMonthiversary] = useState<number | null>(() => monthiversaryOn(TOGETHER_SINCE, new Date()))
  const notes = useStickyNotes(idToken)

  useEffect(() => {
    const watcher = cursor === 'feather' ? midnightRef : cursor === 'laser' ? inkyRef : pirouetteRef

    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const { clientX: x, clientY: y } = event
      setPointer({ x, y })

      const rect = watcher.current?.getBoundingClientRect()
      if (!rect) return
      setGaze(gazeToward(rect.left + rect.width / 2, rect.top + 50, x, y))

      if (cursor === 'feather') {
        const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2))
        setTailWiggle(distance < TAIL_WIGGLE_RANGE)
      }
    }
    const leave = () => {
      setPointer(null)
      setTailWiggle(false)
    }

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
    setTailWiggle(false)
    // Picking the laser is a click, so it is also the moment sound is allowed.
    if (kind === 'laser') meowOnce()
    try {
      window.localStorage.setItem(CURSOR_KEY, kind)
    } catch {
      // Not saved; the choice still lasts until the page is left.
    }
  }

  // While the laser is out, Inky opens her mouth and meows every few seconds.
  useEffect(() => {
    if (cursor !== 'laser') return

    let openTimer = 0
    let closeTimer = 0
    const schedule = () => {
      openTimer = window.setTimeout(() => {
        setMouthOpen(true)
        meowOnce()
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
      setMouthOpen(false)
    }
  }, [cursor])

  return (
    <div className="ciara-page">
      <div className="ciara-topbar">
        <StickyStatus status={notes.status} error={notes.error} />
        <CursorSwitch value={cursor} onChange={chooseCursor} />
      </div>

      <header className="ciara-hero">
        <FlowerGarland />
        <p className="ciara-kicker">our little corner</p>
        <h1 className="ciara-title">{title.replace('+', ' + ')}</h1>
        <p className="ciara-intro">A little place for all our moments.</p>
      </header>

      {/* The waterfall scene and the clock sit side by side on wide screens. */}
      <div className="ciara-top-row">
        <div className="ciara-scene-wrap">
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
        </div>

        <div className="ciara-perch ciara-perch-clock">
          <figure ref={midnightRef} className="ciara-critter ciara-cat ciara-cat-midnight">
            <Cat coat="black" eyes="yellow" gaze={cursor === 'feather' ? gaze : NO_GAZE} tailWiggle={tailWiggle} />
            <figcaption>Midnight</figcaption>
          </figure>
          <figure ref={inkyRef} className="ciara-critter ciara-cat ciara-cat-inky">
            <Cat
              coat="black"
              eyes="green"
              gaze={cursor === 'laser' ? gaze : NO_GAZE}
              mouthOpen={cursor === 'laser' && mouthOpen}
            />
            <figcaption>Inky</figcaption>
          </figure>
          <figure ref={pirouetteRef} className="ciara-critter ciara-cat ciara-cat-pirouette">
            <Cat
              coat="white"
              eyes="blue"
              chubby
              gaze={cursor === 'fish' ? gaze : NO_GAZE}
              pawsPaddling={cursor === 'fish'}
            />
            <figcaption>Pirouette</figcaption>
          </figure>
          <RelationshipClock />
        </div>
      </div>

      <main className="ciara-body">
        <div className="ciara-perch ciara-perch-timeline">
          <Timeline idToken={idToken} />
        </div>
      </main>

      <section className="ciara-notes-bottom" aria-label="Sticky notes">
        <div className="ciara-notes-heading">
          <h2>Little notes</h2>
          <p>Something sweet, something silly, something for later.</p>
        </div>
        <StickyNote color="yellow" notes={notes} className="ciara-note-yellow" />
        <StickyNote color="blue" notes={notes} className="ciara-note-blue" />
        <StickyNote color="pink" notes={notes} className="ciara-note-pink" />
      </section>

      {monthiversary !== null ? (
        <Monthiversary months={monthiversary} onClose={() => setMonthiversary(null)} />
      ) : null}

      {pointer ? <CursorGlyph kind={cursor} x={pointer.x} y={pointer.y} /> : null}
    </div>
  )
}
