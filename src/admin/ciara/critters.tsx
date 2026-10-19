/* The little characters on the WW+TG page. All decorative: drawn inline so nothing
   extra loads, and hidden from screen readers (the page's text says what matters).
   Each one is inked like a sketch: a dark outline, a shadow tone and a highlight. */

const INK = '#3b2a3f'
const BLUSH = '#ffa8c6'

type Colors = Record<string, string>

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

/** A frog sitting up, front view, with its eyes peeking over the top of its head. */
export function Frog({ className = '' }: { className?: string }) {
  const body = '#86d99a'
  return (
    <svg className={className} width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* folded back legs and feet */}
        <ellipse cx="14" cy="44" rx="9" ry="7" fill={body} stroke={INK} strokeWidth="2" />
        <ellipse cx="50" cy="44" rx="9" ry="7" fill={body} stroke={INK} strokeWidth="2" />
        <ellipse cx="9" cy="50" rx="5.5" ry="2.6" fill={body} stroke={INK} strokeWidth="1.6" />
        <ellipse cx="55" cy="50" rx="5.5" ry="2.6" fill={body} stroke={INK} strokeWidth="1.6" />
        {/* body */}
        <path
          d="M10 40 C 10 28 20 26 32 26 C 44 26 54 28 54 40 C 54 50 44 52 32 52 C 20 52 10 50 10 40 Z"
          fill={body}
          stroke={INK}
          strokeWidth="2"
        />
        <path d="M18 34 C 22 30 26 30 28 32" fill="none" stroke="#b5ecc2" strokeWidth="2" />
        <ellipse cx="32" cy="43" rx="11" ry="6" fill="#d4f5dd" />
        <circle cx="25" cy="34" r="1.6" fill="#5fbf78" />
        <circle cx="39" cy="36" r="1.3" fill="#5fbf78" />
        {/* eyes */}
        <circle cx="21" cy="22" r="8" fill={body} stroke={INK} strokeWidth="2" />
        <circle cx="43" cy="22" r="8" fill={body} stroke={INK} strokeWidth="2" />
        <circle cx="21" cy="21" r="5" fill="#fff" stroke={INK} strokeWidth="1.2" />
        <circle cx="43" cy="21" r="5" fill="#fff" stroke={INK} strokeWidth="1.2" />
        <circle cx="22" cy="21.5" r="2.6" fill={INK} />
        <circle cx="44" cy="21.5" r="2.6" fill={INK} />
        <circle cx="22.9" cy="20.5" r="0.9" fill="#fff" />
        <circle cx="44.9" cy="20.5" r="0.9" fill="#fff" />
        {/* cheeks and smile */}
        <ellipse cx="16" cy="36" rx="3.2" ry="2" fill={BLUSH} opacity="0.8" />
        <ellipse cx="48" cy="36" rx="3.2" ry="2" fill={BLUSH} opacity="0.8" />
        <path d="M24 38 Q32 44 40 38" fill="none" stroke={INK} strokeWidth="1.6" />
      </g>
    </svg>
  )
}

const AXOLOTL_COLORS: Record<'pink' | 'blue', Colors> = {
  pink: { body: '#ffc2de', gill: '#ff7fbb', belly: '#ffe6f1', cheek: '#ff9ec7' },
  blue: { body: '#b8e3ff', gill: '#5fb4f0', belly: '#e6f5ff', cheek: '#8fd0ff' },
}

/** An axolotl facing right: frilly gills, a short tail, and a big smile. `flip` mirrors it. */
export function Axolotl({ color, flip = false, className = '' }: { color: 'pink' | 'blue'; flip?: boolean; className?: string }) {
  const c = AXOLOTL_COLORS[color]
  return (
    <svg
      className={className}
      width="110"
      height="62"
      viewBox="0 0 110 62"
      aria-hidden="true"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* tail fin */}
        <path d="M22 34 C 12 24 4 30 6 40 C 8 50 16 48 24 40 Z" fill={c.body} stroke={INK} strokeWidth="1.8" />
        {/* back and front legs with toes */}
        <ellipse cx="44" cy="49" rx="6" ry="3.4" fill={c.body} stroke={INK} strokeWidth="1.6" />
        <ellipse cx="72" cy="49" rx="6" ry="3.4" fill={c.body} stroke={INK} strokeWidth="1.6" />
        {/* body */}
        <path
          d="M22 36 C 26 26 50 24 70 28 C 80 30 86 34 84 40 C 82 48 62 50 48 48 C 34 48 22 46 22 36 Z"
          fill={c.body}
          stroke={INK}
          strokeWidth="2"
        />
        {/* gills: three feathery tufts fanning back from behind the head */}
        {[
          'M72 27 Q66 16 57 13',
          'M73 31 Q66 24 58 22',
          'M73 36 Q68 32 61 33',
        ].map((path) => (
          <g key={path}>
            <path d={path} fill="none" stroke={INK} strokeWidth="4.2" />
            <path d={path} fill="none" stroke={c.gill} strokeWidth="2.2" />
          </g>
        ))}
        {/* head */}
        <path
          d="M68 28 C 74 20 92 20 100 30 C 106 38 100 48 90 48 C 78 48 66 42 68 28 Z"
          fill={c.body}
          stroke={INK}
          strokeWidth="2"
        />
        {/* belly, shaded underneath */}
        <path d="M30 42 C 44 50 64 49 80 44 C 66 52 40 52 30 42 Z" fill={c.belly} />
        <path d="M36 30 C 44 27 56 27 64 31" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.6" />
        {/* eye with a highlight, smile and cheek */}
        <circle cx="88" cy="34" r="4" fill="#fff" stroke={INK} strokeWidth="1.4" />
        <circle cx="88.6" cy="34.6" r="2.3" fill={INK} />
        <circle cx="89.4" cy="33.6" r="0.8" fill="#fff" />
        <path d="M92 42 Q98 45 102 39" fill="none" stroke={INK} strokeWidth="1.6" />
        <ellipse cx="94" cy="40" rx="3" ry="2" fill={c.cheek} opacity="0.7" />
        <circle cx="103" cy="33" r="0.9" fill={INK} />
      </g>
    </svg>
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
}: {
  coat?: 'black' | 'white'
  eyes?: keyof typeof CAT_EYES
  className?: string
  closedEyes?: boolean
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
            <circle cx="33" cy="38" r="3.6" fill={eyeColor} />
            <circle cx="51" cy="38" r="3.6" fill={eyeColor} />
            <ellipse cx="33" cy="38" rx="1" ry="2.8" fill={INK} />
            <ellipse cx="51" cy="38" rx="1" ry="2.8" fill={INK} />
            <circle cx="34.2" cy="36.6" r="0.9" fill="#fff" />
            <circle cx="52.2" cy="36.6" r="0.9" fill="#fff" />
          </>
        )}

        {/* nose, mouth and whiskers */}
        <path d="M40 44 L44 44 L42 47 Z" fill={BLUSH} stroke={INK} strokeWidth="1.2" />
        <path d="M42 47 Q40 50 37 49 M42 47 Q44 50 47 49" fill="none" stroke={INK} strokeWidth="1.2" />
        <path d="M22 46 L8 44 M22 50 L8 52 M62 46 L76 44 M62 50 L76 52" stroke="#8a7f99" strokeWidth="1" />
      </g>
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
