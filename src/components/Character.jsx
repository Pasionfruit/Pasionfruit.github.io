import './Character.css'

/**
 * Character rendered as a minimal SVG person.
 * Props: state ('run' | 'bike' | 'swim'), direction ('right' | 'left' | 'up' | 'down'), isMoving
 */
export default function Character({ state = 'run', direction = 'right', isMoving = false }) {
  const flipX = direction === 'left' ? -1 : 1
  const animClass = isMoving ? `char-anim-${state}` : ''

  return (
    <div
      className={`character ${animClass}`}
      style={{ transform: `scaleX(${flipX})` }}
      aria-label="player character"
    >
      <svg
        viewBox="0 0 24 32"
        width="28"
        height="36"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {/* Head */}
        <circle cx="12" cy="5" r="4.5" fill="#f5d6a8" stroke="#222" strokeWidth="1" />
        {/* Eyes */}
        <circle cx="10.5" cy="4.5" r="0.7" fill="#222" />
        <circle cx="13.5" cy="4.5" r="0.7" fill="#222" />

        {state === 'run' && (
          <>
            {/* Body */}
            <rect x="8.5" y="10" width="7" height="9" rx="1.5" fill="#4287f5" stroke="#222" strokeWidth="0.8" />
            {/* Left leg */}
            <line x1="10" y1="19" x2="8.5"  y2="28" stroke="#222" strokeWidth="2" strokeLinecap="round" className="leg-l" />
            {/* Right leg */}
            <line x1="14" y1="19" x2="15.5" y2="28" stroke="#222" strokeWidth="2" strokeLinecap="round" className="leg-r" />
            {/* Left arm */}
            <line x1="8.5" y1="12" x2="5"   y2="17" stroke="#f5d6a8" strokeWidth="2" strokeLinecap="round" className="arm-l" />
            {/* Right arm */}
            <line x1="15.5" y1="12" x2="19" y2="17" stroke="#f5d6a8" strokeWidth="2" strokeLinecap="round" className="arm-r" />
          </>
        )}

        {state === 'bike' && (
          <>
            {/* Leaned body */}
            <rect x="8.5" y="10" width="7" height="7" rx="1.5" fill="#42f56f" stroke="#222" strokeWidth="0.8" transform="rotate(-15 12 14)" />
            {/* Wheels */}
            <circle cx="7"  cy="26" r="4" fill="none" stroke="#222" strokeWidth="1.5" />
            <circle cx="17" cy="26" r="4" fill="none" stroke="#222" strokeWidth="1.5" />
            {/* Frame */}
            <line x1="7"  y1="26" x2="12" y2="18" stroke="#888" strokeWidth="1.5" />
            <line x1="17" y1="26" x2="12" y2="18" stroke="#888" strokeWidth="1.5" />
            <line x1="7"  y1="26" x2="17" y2="26" stroke="#888" strokeWidth="1.5" />
            {/* Handlebar */}
            <line x1="12" y1="18" x2="19" y2="17" stroke="#555" strokeWidth="1.5" />
            {/* Legs on pedals */}
            <line x1="10" y1="17" x2="7.5" y2="24" stroke="#222" strokeWidth="2" strokeLinecap="round" className="pedal-l" />
            <line x1="14" y1="17" x2="16.5" y2="22" stroke="#222" strokeWidth="2" strokeLinecap="round" className="pedal-r" />
          </>
        )}

        {state === 'swim' && (
          <>
            {/* Horizontal body */}
            <rect x="6" y="12" width="12" height="6" rx="3" fill="#f56942" stroke="#222" strokeWidth="0.8" />
            {/* Arms (stroke) */}
            <line x1="6"  y1="14" x2="1"  y2="10" stroke="#f5d6a8" strokeWidth="2.5" strokeLinecap="round" className="swim-arm-l" />
            <line x1="18" y1="14" x2="23" y2="10" stroke="#f5d6a8" strokeWidth="2.5" strokeLinecap="round" className="swim-arm-r" />
            {/* Legs (kick) */}
            <line x1="8"  y1="18" x2="6"  y2="24" stroke="#222" strokeWidth="2" strokeLinecap="round" className="swim-leg-l" />
            <line x1="16" y1="18" x2="18" y2="24" stroke="#222" strokeWidth="2" strokeLinecap="round" className="swim-leg-r" />
            {/* Bubble */}
            <circle cx="3" cy="8" r="1.2" fill="none" stroke="#aef" strokeWidth="0.8" opacity="0.7" />
          </>
        )}
      </svg>
    </div>
  )
}
