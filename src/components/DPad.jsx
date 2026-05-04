import { touchInput } from '../experience/inputManager.js'
import './DPad.css'

const DIR_TO_INPUT = { up: 'forward', down: 'backward', left: 'left', right: 'right' }
const ARROWS = { up: '▲', down: '▼', left: '◀', right: '▶' }

export default function DPad() {
  function handlers(dir) {
    const k = DIR_TO_INPUT[dir]
    return {
      onPointerDown:  (e) => { e.preventDefault(); touchInput[k] = true  },
      onPointerUp:    (e) => { e.preventDefault(); touchInput[k] = false },
      onPointerLeave: (e) => { e.preventDefault(); touchInput[k] = false },
    }
  }

  return (
    <div className="dpad" aria-label="direction pad">
      {['up','left','right','down'].map(dir => (
        <button key={dir} className={`dpad-btn dpad-${dir}`} {...handlers(dir)} aria-label={`move ${dir}`}>
          {ARROWS[dir]}
        </button>
      ))}
      <div className="dpad-center" />
    </div>
  )
}