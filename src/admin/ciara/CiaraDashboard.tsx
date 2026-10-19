import { useEffect, useRef, useState } from 'react'
import { adminDashboardsById } from '../../siteContent'
import { Axolotl, Cat, Frog, FlowerGarland, LilyPad, Waterfall } from './critters'
import { RelationshipClock } from './RelationshipClock'
import { Monthiversary } from './Monthiversary'
import { monthiversaryOn, TOGETHER_SINCE } from './elapsed'
import { StickyNotes } from './StickyNotes'
import { Timeline } from './Timeline'
import './ciara.css'

type Point = { x: number; y: number }

/** The most her pupils can shift, in SVG units. */
const MAX_GAZE = 1.6

export function CiaraDashboard({ idToken }: { idToken: string }) {
  const { title } = adminDashboardsById.ciara

  const inkyRef = useRef<HTMLElement>(null)
  // The pointer is the red dot Inky chases. Null when it is off the page or on a touch screen.
  const [pointer, setPointer] = useState<Point | null>(null)
  const [gaze, setGaze] = useState<Point>({ x: 0, y: 0 })
  const [mouthOpen, setMouthOpen] = useState(false)
  // Checked once, when the page opens. Null on any day that is not a monthiversary.
  const [monthiversary, setMonthiversary] = useState<number | null>(() => monthiversaryOn(TOGETHER_SINCE, new Date()))

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const { clientX: x, clientY: y } = event
      setPointer({ x, y })

      const inky = inkyRef.current?.getBoundingClientRect()
      if (!inky) return

      // Her pupils point from roughly her head toward the dot, and never far.
      const headX = inky.left + inky.width / 2
      const headY = inky.top + 50
      const dx = x - headX
      const dy = y - headY
      const distance = Math.hypot(dx, dy) || 1
      const strength = Math.min(distance / 120, 1) * MAX_GAZE
      setGaze({ x: (dx / distance) * strength, y: (dy / distance) * strength })
    }
    const leave = () => setPointer(null)

    window.addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [])

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
          <figure className="ciara-critter ciara-cat ciara-cat-midnight">
            <Cat coat="black" eyes="yellow" />
            <figcaption>Midnight</figcaption>
          </figure>
          <figure ref={inkyRef} className="ciara-critter ciara-cat ciara-cat-inky">
            <Cat coat="black" eyes="green" gaze={gaze} mouthOpen={mouthOpen} />
            <figcaption>Inky</figcaption>
          </figure>
          <RelationshipClock />
        </div>

        <StickyNotes idToken={idToken} />

        <div className="ciara-perch">
          <figure className="ciara-critter ciara-cat ciara-cat-pirouette">
            <Cat coat="white" eyes="blue" chubby />
            <figcaption>Pirouette</figcaption>
          </figure>
          <Timeline idToken={idToken} />
        </div>
      </main>

      {monthiversary !== null ? (
        <Monthiversary months={monthiversary} onClose={() => setMonthiversary(null)} />
      ) : null}

      {pointer ? (
        <span className="ciara-cursor-dot" style={{ left: pointer.x, top: pointer.y }} aria-hidden="true" />
      ) : null}
    </div>
  )
}
