import { useEffect, useRef, useState } from 'react'

function GamePanel({ game, onPlay }) {
  const [isRulesOpen, setIsRulesOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!isRulesOpen) {
      return undefined
    }

    const handleDocumentClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsRulesOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsRulesOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isRulesOpen])

  return (
    <article className="game-panel" ref={panelRef}>
      <header className="panel-header">
        <h2>{game.name}</h2>
        <p>{game.tagline}</p>
      </header>

      <button className="panel-action" type="button" onClick={onPlay}>
        {game.ctaLabel}
      </button>

      <button
        className="rules-button"
        type="button"
        aria-label={`Show ${game.name} rules`}
        aria-expanded={isRulesOpen}
        onClick={() => setIsRulesOpen((open) => !open)}
      >
        ?
      </button>

      {isRulesOpen ? (
        <div className="rules-popup" role="dialog" aria-label={`${game.name} rules`}>
          <div className="rules-popup-header">
            <h3>{game.name} Rules</h3>
            <button
              className="rules-close"
              type="button"
              aria-label={`Close ${game.name} rules`}
              onClick={() => setIsRulesOpen(false)}
            >
              x
            </button>
          </div>
          <ul>
            {game.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

export default GamePanel
