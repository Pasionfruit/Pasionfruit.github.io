/* The little characters on the WW+TG page. All decorative: drawn inline so nothing
   extra loads, and hidden from screen readers (the page's text says what matters).
   Each one is inked like a sketch: a dark outline, a shadow tone and a highlight. */

import type { CSSProperties } from 'react'
import { AXOLOTL_PALETTES, AXOLOTL_SPRITE, FROG_PALETTE, FROG_SPRITE } from './pixelSprites'

const INK = '#3b2a3f'
const BLUSH = '#ffa8c6'

export function Flower({ petal = '#ffb3d1', center = '#ffd966', size = 28, className = '' }: {
  petal?: string
  center?: string
  size?: number
  className?: string
}) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="20"
          cy="11"
          rx="7"
          ry="10"
          fill={petal}
          stroke="#c9557c"
          strokeWidth="1"
          transform={`rotate(${angle} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="5.5" fill={center} stroke="#c9557c" strokeWidth="1" />
      <circle cx="18.5" cy="18.5" r="1.4" fill="#fff" opacity="0.7" />
    </svg>
  )
}

/** A garland of flowers and leaves along the top of the page. */
export function FlowerGarland() {
  const blooms = [
    { petal: '#ffb3d1', center: '#ffd966', size: 30 },
    { petal: '#c9b8ff', center: '#fff1a8', size: 22 },
    { petal: '#ffd1e3', center: '#ff8fb8', size: 26 },
    { petal: '#bde7ff', center: '#ffe27a', size: 30 },
    { petal: '#ffb3d1', center: '#ffd966', size: 24 },
    { petal: '#c9b8ff', center: '#fff1a8', size: 28 },
    { petal: '#ffd1e3', center: '#ff8fb8', size: 26 },
    { petal: '#bde7ff', center: '#ffe27a', size: 22 },
  ]
  return (
    <div className="ciara-garland" aria-hidden="true">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="ciara-garland-vine">
        <path d="M0 36 C 20 10, 40 60, 60 34 S 90 12, 100 34" fill="none" stroke="#9fd8b4" strokeWidth="1.4" />
      </svg>
      {blooms.map((bloom, index) => (
        <Flower key={index} petal={bloom.petal} center={bloom.center} size={bloom.size} className="ciara-garland-bloom" />
      ))}
    </div>
  )
}

/** Draws a pixel sprite as one rectangle per run of same-coloured pixels, so it stays crisp at any size. */
function PixelSprite({
  rows,
  palette,
  scale,
  className = '',
  style,
}: {
  rows: readonly string[]
  palette: Record<string, string>
  scale: number
  className?: string
  style?: CSSProperties
}) {
  const width = rows[0].length
  const height = rows.length
  const runs: { x: number; y: number; length: number; fill: string }[] = []

  rows.forEach((row, y) => {
    let x = 0
    while (x < width) {
      const ch = row[x]
      let end = x + 1
      while (end < width && row[end] === ch) end += 1
      const fill = palette[ch]
      if (ch !== '.' && fill) runs.push({ x, y, length: end - x, fill })
      x = end
    }
  })

  return (
    <svg
      className={className}
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={style}
    >
      {runs.map((run) => (
        <rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.length} height={1} fill={run.fill} />
      ))}
    </svg>
  )
}

/** A Minecraft frog: blocky, with big square eyes and a wide mouth. */
export function Frog({ className = '' }: { className?: string }) {
  return <PixelSprite rows={FROG_SPRITE} palette={FROG_PALETTE} scale={4} className={className} />
}

/** A Minecraft axolotl facing right, in pink or blue. `flip` mirrors it to face left. */
export function Axolotl({ color, flip = false, className = '' }: { color: 'pink' | 'blue'; flip?: boolean; className?: string }) {
  return (
    <PixelSprite
      rows={AXOLOTL_SPRITE}
      palette={AXOLOTL_PALETTES[color]}
      scale={5}
      className={className}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    />
  )
}

const CAT_EYES = { yellow: '#ffd23f', green: '#9be37a', blue: '#8fd8ff' }

/**
 * A sitting cat, facing the viewer, in ink outline. A black cat is all shadow
 * with a faint rim of light; Pirouette is the reverse: a white cat with black
 * markings on her bib, muzzle, ear tips, tail and paws.
 */
export function Cat({
  coat = 'black',
  eyes = 'yellow',
  className = '',
  closedEyes = false,
  gaze = { x: 0, y: 0 },
  mouthOpen = false,
  chubby = false,
}: {
  coat?: 'black' | 'white'
  eyes?: keyof typeof CAT_EYES
  className?: string
  closedEyes?: boolean
  /** How far the pupils sit toward whatever she is looking at, in SVG units. */
  gaze?: { x: number; y: number }
  mouthOpen?: boolean
  /** Widens the body and head, for a round, well-fed look. The tail stays as it is. */
  chubby?: boolean
}) {
  const reversed = coat === 'white'
  const fur = reversed ? '#fffaf5' : '#2b2330'
  const rim = reversed ? '#f0e4ee' : '#4a3d55'
  const mark = '#2b2330'
  const eyeColor = CAT_EYES[eyes]
  return (
    <svg className={className} width="84" height="104" viewBox="0 0 84 104" aria-hidden="true">
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* tail: an ink outline drawn under the fur */}
        <path d="M58 96 C 78 98 82 82 76 70" fill="none" stroke={INK} strokeWidth="11" />
        <path d="M58 96 C 78 98 82 82 76 70" fill="none" stroke={fur} strokeWidth="7" />
        {reversed && <path d="M80 84 C 82 80 80 74 76 70" fill="none" stroke={mark} strokeWidth="7" />}

        {/* the body, head and paws, widened for a chubby cat */}
        <g transform={chubby ? 'translate(42 66) scale(1.16 1.04) translate(-42 -66)' : undefined}>
        {/* body: a pear shape sitting on its haunches */}
        <path d="M26 52 C 16 66 18 96 42 97 C 66 96 68 66 58 52 Z" fill={fur} stroke={INK} strokeWidth="2.2" />
        <path d="M25 70 C 23 82 26 90 33 94" fill="none" stroke={rim} strokeWidth="2" />
        {reversed && <path d="M32 62 Q42 76 52 62 Q48 86 42 86 Q36 86 32 62 Z" fill={mark} />}

        {/* front paws */}
        {reversed ? (
          <>
            <ellipse cx="34" cy="95" rx="7" ry="4.5" fill={mark} stroke={INK} strokeWidth="1.6" />
            <ellipse cx="50" cy="95" rx="7" ry="4.5" fill={mark} stroke={INK} strokeWidth="1.6" />
          </>
        ) : (
          <>
            <ellipse cx="34" cy="95" rx="7" ry="4.5" fill={fur} stroke={INK} strokeWidth="1.6" />
            <ellipse cx="50" cy="95" rx="7" ry="4.5" fill={fur} stroke={INK} strokeWidth="1.6" />
          </>
        )}

        {/* ears: outer shape, then the pink inside */}
        <path d="M23 30 L 21 7 L 40 19 Z" fill={reversed ? mark : fur} stroke={INK} strokeWidth="2.2" />
        <path d="M61 30 L 63 7 L 44 19 Z" fill={reversed ? mark : fur} stroke={INK} strokeWidth="2.2" />
        <path d="M26 26 L 25 14 L 34 21 Z" fill="#ffb3c9" />
        <path d="M58 26 L 59 14 L 50 21 Z" fill="#ffb3c9" />

        {/* head */}
        <path
          d="M21 40 C 20 26 29 19 42 19 C 55 19 64 26 63 40 C 63 53 54 60 42 60 C 30 60 21 53 21 40 Z"
          fill={fur}
          stroke={INK}
          strokeWidth="2.2"
        />
        <path d="M27 31 Q30 24 37 22" fill="none" stroke={rim} strokeWidth="2" />
        {reversed && <path d="M34 50 Q42 46 50 50 Q45 58 42 58 Q39 58 34 50 Z" fill={mark} />}

        {/* eyes: almond shapes with an iris, or closed and sleepy */}
        {closedEyes ? (
          <>
            <path d="M27 40 Q33 45 39 40" fill="none" stroke={INK} strokeWidth="2.2" />
            <path d="M45 40 Q51 45 57 40" fill="none" stroke={INK} strokeWidth="2.2" />
          </>
        ) : (
          <>
            <path d="M27 38 Q33 31 39 38 Q33 44 27 38 Z" fill="#fff" stroke={INK} strokeWidth="1.4" />
            <path d="M45 38 Q51 31 57 38 Q51 44 45 38 Z" fill="#fff" stroke={INK} strokeWidth="1.4" />
            <g transform={`translate(${gaze.x} ${gaze.y})`}>
              <circle cx="33" cy="38" r="3.6" fill={eyeColor} />
              <circle cx="51" cy="38" r="3.6" fill={eyeColor} />
              <ellipse cx="33" cy="38" rx="1" ry="2.8" fill={INK} />
              <ellipse cx="51" cy="38" rx="1" ry="2.8" fill={INK} />
              <circle cx="34.2" cy="36.6" r="0.9" fill="#fff" />
              <circle cx="52.2" cy="36.6" r="0.9" fill="#fff" />
            </g>
          </>
        )}

        </g>

        {/* nose, mouth and whiskers */}
        <path d="M40 44 L44 44 L42 47 Z" fill={BLUSH} stroke={INK} strokeWidth="1.2" />
        {mouthOpen ? (
          <>
            <path d="M37 48 Q42 58 47 48 Z" fill="#7a2e4f" stroke={INK} strokeWidth="1.2" />
            <path d="M39 53 Q42 50 45 53 Q42 56 39 53 Z" fill="#ff8fb8" />
          </>
        ) : (
          <path d="M42 47 Q40 50 37 49 M42 47 Q44 50 47 49" fill="none" stroke={INK} strokeWidth="1.2" />
        )}
        <path d="M22 46 L8 44 M22 50 L8 52 M62 46 L76 44 M62 50 L76 52" stroke="#8a7f99" strokeWidth="1" />
      </g>
    </svg>
  )
}

/** A lily pad on the pond, with its little notch. */
export function LilyPad({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="72" height="30" viewBox="0 0 72 30" aria-hidden="true">
      <ellipse cx="36" cy="16" rx="34" ry="12" fill="#86d99a" stroke="#3f9e6a" strokeWidth="1.6" />
      <path d="M36 16 L 66 9 L 66 23 Z" fill="#9ddcf7" />
      <path d="M36 16 L 14 11 M36 16 L 14 21 M36 16 L 22 7" fill="none" stroke="#5fbf78" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}

/** Water falling off a rock, with the stream animated in CSS. */
export function Waterfall() {
  return (
    <div className="ciara-waterfall" aria-hidden="true">
      <div className="ciara-rock" />
      <div className="ciara-stream ciara-stream-a" />
      <div className="ciara-stream ciara-stream-b" />
      <div className="ciara-stream ciara-stream-c" />
      <div className="ciara-splash" />
    </div>
  )
}
