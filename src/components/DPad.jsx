import './DPad.css'

const DIRS = ['up', 'left', 'right', 'down']

const ARROWS = {
  up:    '▲',
  down:  '▼',
  left:  '◀',
  right: '▶',
}

export default function DPad({ onStart, onEnd }) {
  function makeHandlers(dir) {
    return {
      onPointerDown: (e) => { e.preventDefault(); onStart(dir) },
      onPointerUp:   (e) => { e.preventDefault(); onEnd(dir)   },
      onPointerLeave:(e) => { e.preventDefault(); onEnd(dir)   },
    }
  }

  return (
    <div className="dpad" aria-label="direction pad">
      {DIRS.map(dir => (
        <button
          key={dir}
          className={`dpad-btn dpad-${dir}`}
          {...makeHandlers(dir)}
          aria-label={`move ${dir}`}
        >
          {ARROWS[dir]}
        </button>
      ))}
      <div className="dpad-center" />
    </div>
  )
}
