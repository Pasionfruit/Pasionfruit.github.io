/* The little characters on the WW+TG page. All decorative: drawn inline so nothing
   extra loads, and hidden from screen readers (the page's text says what matters). */

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
        <ellipse key={angle} cx="20" cy="11" rx="7" ry="10" fill={petal} transform={`rotate(${angle} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="5.5" fill={center} />
    </svg>
  )
}

/** A garland of flowers and leaves along the top of the page. */
export function FlowerGarland() {
  const blooms: { petal: string; center: string; x: number; y: number; size: number }[] = [
    { petal: '#ffb3d1', center: '#ffd966', x: 4, y: 40, size: 30 },
    { petal: '#c9b8ff', center: '#fff1a8', x: 16, y: 16, size: 22 },
    { petal: '#ffd1e3', center: '#ff8fb8', x: 30, y: 52, size: 26 },
    { petal: '#bde7ff', center: '#ffe27a', x: 44, y: 18, size: 30 },
    { petal: '#ffb3d1', center: '#ffd966', x: 58, y: 46, size: 24 },
    { petal: '#c9b8ff', center: '#fff1a8', x: 72, y: 14, size: 28 },
    { petal: '#ffd1e3', center: '#ff8fb8', x: 86, y: 50, size: 26 },
    { petal: '#bde7ff', center: '#ffe27a', x: 96, y: 20, size: 22 },
  ]
  return (
    <div className="ciara-garland" aria-hidden="true">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="ciara-garland-vine">
        <path d="M0 36 C 20 10, 40 60, 60 34 S 90 12, 100 34" fill="none" stroke="#9fd8b4" strokeWidth="1.4" />
      </svg>
      {blooms.map((bloom) => (
        <Flower
          key={`${bloom.x}-${bloom.y}`}
          petal={bloom.petal}
          center={bloom.center}
          size={bloom.size}
          className="ciara-garland-bloom"
        />
      ))}
    </div>
  )
}

export function Frog({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      {/* legs */}
      <path d="M14 40 q-8 4 -4 12 q6 -2 8 -6 z" fill="#5fbf78" />
      <path d="M50 40 q8 4 4 12 q-6 -2 -8 -6 z" fill="#5fbf78" />
      {/* body */}
      <ellipse cx="32" cy="36" rx="20" ry="15" fill="#86d99a" />
      <ellipse cx="32" cy="42" rx="11" ry="7" fill="#c6f0cf" />
      {/* eyes */}
      <circle cx="21" cy="20" r="9" fill="#86d99a" />
      <circle cx="43" cy="20" r="9" fill="#86d99a" />
      <circle cx="21" cy="19" r="6" fill="#fff" />
      <circle cx="43" cy="19" r="6" fill="#fff" />
      <circle cx="22" cy="19" r="3" fill="#2b2330" />
      <circle cx="44" cy="19" r="3" fill="#2b2330" />
      <circle cx="23" cy="18" r="1" fill="#fff" />
      <circle cx="45" cy="18" r="1" fill="#fff" />
      {/* cheeks and smile */}
      <ellipse cx="16" cy="32" rx="4" ry="2.4" fill="#ffafc8" opacity="0.8" />
      <ellipse cx="48" cy="32" rx="4" ry="2.4" fill="#ffafc8" opacity="0.8" />
      <path d="M24 34 q8 6 16 0" fill="none" stroke="#2b2330" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const AXOLOTL_COLORS: Record<'pink' | 'blue', Colors> = {
  pink: { body: '#ffb3d6', gill: '#ff7fbb', belly: '#ffe0ee', cheek: '#ff9ec7' },
  blue: { body: '#a9dcff', gill: '#5fb4f0', belly: '#e0f2ff', cheek: '#8fd0ff' },
}

/** An axolotl facing right, with frilly gills. `flip` mirrors it to face left. */
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
      {/* gills, three each side */}
      {[0, 1, 2].map((i) => (
        <g key={i} fill="none" stroke={c.gill} strokeWidth="3" strokeLinecap="round">
          <path d={`M${74 + i * 4} ${22 + i * 4} q-10 -6 -18 ${-2 + i * 2}`} />
          <path d={`M${74 + i * 4} ${30 + i * 4} q-10 2 -18 ${6 + i * 2}`} />
        </g>
      ))}
      {/* tail */}
      <path d="M18 34 q-14 -6 -16 6 q2 8 16 2 z" fill={c.body} />
      {/* legs */}
      <ellipse cx="44" cy="46" rx="6" ry="3.5" fill={c.body} />
      <ellipse cx="66" cy="46" rx="6" ry="3.5" fill={c.body} />
      {/* body and head */}
      <ellipse cx="54" cy="36" rx="30" ry="14" fill={c.body} />
      <ellipse cx="74" cy="34" rx="14" ry="12" fill={c.body} />
      <ellipse cx="60" cy="42" rx="18" ry="6" fill={c.belly} />
      {/* eye and smile */}
      <circle cx="78" cy="30" r="3.2" fill="#2b2330" />
      <circle cx="79" cy="29" r="1" fill="#fff" />
      <path d="M80 38 q4 2 7 -1" fill="none" stroke="#2b2330" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="82" cy="36" rx="3" ry="2" fill={c.cheek} opacity="0.8" />
    </svg>
  )
}

const CAT_EYES = { yellow: '#ffd23f', green: '#9be37a', blue: '#8fd8ff' }

/**
 * A sitting cat, facing the viewer. A tuxedo cat gets the white bib, muzzle and
 * paws; a plain black cat is all shadow except for its eyes.
 */
export function Cat({
  coat = 'black',
  eyes = 'yellow',
  className = '',
  closedEyes = false,
}: {
  coat?: 'black' | 'tuxedo'
  eyes?: keyof typeof CAT_EYES
  className?: string
  closedEyes?: boolean
}) {
  const fur = '#2b2330'
  const eyeColor = CAT_EYES[eyes]
  const tux = coat === 'tuxedo'
  return (
    <svg className={className} width="84" height="104" viewBox="0 0 84 104" aria-hidden="true">
      {/* tail curling round the front */}
      <path d="M68 96 q14 -4 12 -22 q-2 -10 -10 -6" fill="none" stroke={fur} strokeWidth="7" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="42" cy="70" rx="26" ry="28" fill={fur} />
      {tux && <path d="M42 50 q10 14 0 36 q-10 -22 0 -36 z" fill="#fff8f0" />}
      {/* ears */}
      <path d="M20 26 L24 2 L40 18 Z" fill={fur} />
      <path d="M64 26 L60 2 L44 18 Z" fill={fur} />
      <path d="M26 20 L27 10 L35 17 Z" fill="#ffb3d1" opacity={tux ? 0 : 0.5} />
      {/* head */}
      <ellipse cx="42" cy="36" rx="24" ry="20" fill={fur} />
      {tux && <path d="M30 42 q12 12 24 0 q-2 10 -12 12 q-10 -2 -12 -12 z" fill="#fff8f0" />}
      {/* eyes */}
      {closedEyes ? (
        <>
          <path d="M30 34 q4 4 8 0" fill="none" stroke={eyeColor} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M46 34 q4 4 8 0" fill="none" stroke={eyeColor} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="34" cy="33" rx="4.2" ry="5" fill={eyeColor} />
          <ellipse cx="50" cy="33" rx="4.2" ry="5" fill={eyeColor} />
          <ellipse cx="34" cy="33" rx="1.5" ry="3.6" fill="#2b2330" />
          <ellipse cx="50" cy="33" rx="1.5" ry="3.6" fill="#2b2330" />
        </>
      )}
      {/* nose and whiskers */}
      <path d="M40 42 h4 l-2 2.5 z" fill="#ff9ec7" />
      <path d="M22 42 l-12 -2 M22 45 l-12 2 M62 42 l12 -2 M62 45 l12 2" stroke="#8a7f99" strokeWidth="1" />
      {/* paws */}
      <ellipse cx="34" cy="96" rx="7" ry="4" fill={tux ? '#fff8f0' : fur} />
      <ellipse cx="50" cy="96" rx="7" ry="4" fill={tux ? '#fff8f0' : fur} />
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
