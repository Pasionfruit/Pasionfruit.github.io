import { useEffect, type CSSProperties } from 'react'

const COLORS = ['#ff8fb8', '#ffd966', '#9be37a', '#8fd8ff', '#c9b8ff', '#ff7a7a']

/** Each piece's fall is fixed when the module loads, so re-renders do not reshuffle the confetti. */
const PIECES = Array.from({ length: 70 }, (_, index) => ({
  key: index,
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2.8 + Math.random() * 2.4,
  drift: (Math.random() - 0.5) * 140,
  size: 6 + Math.random() * 6,
  color: COLORS[index % COLORS.length],
  round: index % 3 === 0,
}))

function Confetti() {
  return (
    <div className="ciara-confetti" aria-hidden="true">
      {PIECES.map((piece) => (
        <span
          key={piece.key}
          className="ciara-confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}px`,
              width: piece.size,
              height: piece.size * 1.6,
              background: piece.color,
              borderRadius: piece.round ? '50%' : '2px',
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** The popup shown when the page opens on a monthiversary. Closes on its button or Escape. */
export function Monthiversary({ months, onClose }: { months: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ciara-monthiversary">
      <Confetti />
      <div className="ciara-mv-card" role="dialog" aria-modal="true" aria-labelledby="ciara-mv-title">
        <p className="ciara-mv-kicker">monthiversary</p>
        <h2 id="ciara-mv-title">Happy {months} Months!</h2>
        <p className="ciara-mv-note">Another month of us.</p>
        <button type="button" className="primary-action" onClick={onClose} autoFocus>
          Yay!
        </button>
      </div>
    </div>
  )
}
