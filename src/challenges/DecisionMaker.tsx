import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { SlotReel } from './SlotReel'

const STORAGE_KEY = 'decision-maker-options'

function readOptions(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function writeOptions(options: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // The list still works for this visit; it just will not be remembered.
  }
}

/**
 * A wheel of your own: type the options in, spin the slot-machine reel, and
 * whatever it stops on is the decision. The list is kept on this device.
 * Adding the same option twice gives it two chances, which is a cheap way to
 * weight a choice. Editing is locked while the reel runs, since changing the
 * options rebuilds it.
 */
export function DecisionMaker({ title = 'Decision maker', className = 'info-card admin-card admin-card-wide' }: { title?: string; className?: string }) {
  const [options, setOptions] = useState(readOptions)
  const [draft, setDraft] = useState('')
  const [isSpinning, setIsSpinning] = useState(false)
  const [decision, setDecision] = useState<string | null>(null)

  function update(next: string[]) {
    setOptions(next)
    setDecision(null)
    writeOptions(next)
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || isSpinning) return
    update([...options, text])
    setDraft('')
  }

  const items = options.map((label, index) => ({ id: String(index), label }))

  return (
    <article className={className}>
      <div className="admin-card-head">
        <h3>{title}</h3>
        {options.length > 0 ? <span className="admin-pill">{options.length} options</span> : null}
      </div>

      <form className="decision-add" onSubmit={add}>
        <input
          className="task-input"
          value={draft}
          placeholder="Add an option"
          aria-label="New option"
          disabled={isSpinning}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="challenge-btn" disabled={isSpinning || !draft.trim()}>
          Add
        </button>
        {options.length > 0 ? (
          <button type="button" className="challenge-btn" disabled={isSpinning} onClick={() => update([])}>
            Clear
          </button>
        ) : null}
      </form>

      {options.length > 0 ? (
        <ul className="decision-options" aria-label="Options">
          {options.map((label, index) => (
            <li key={`${index}-${label}`} className="decision-option">
              <span>{label}</span>
              <button
                type="button"
                className="challenge-icon-btn"
                aria-label={`Remove ${label}`}
                disabled={isSpinning}
                onClick={() => update(options.filter((_, at) => at !== index))}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sheets-meta">Add a few options, then spin to let the reel decide.</p>
      )}

      {options.length === 1 ? <p className="sheets-meta">Add at least one more option to spin.</p> : null}

      {options.length > 0 ? (
        // Rebuilt whenever the options change: the reel fixes its order when it mounts.
        <SlotReel
          key={options.join('\u0000')}
          items={items}
          ariaLabel="Decision slot machine"
          spinLabel="Decide for me"
          minItems={2}
          onSpinningChange={setIsSpinning}
          onLanded={(id) => setDecision(options[Number(id)] ?? null)}
        />
      ) : null}

      {decision ? (
        <section className="challenge-picked" aria-label="Decision">
          <h4>The reel says</h4>
          <p className="decision-result">{decision}</p>
        </section>
      ) : null}
    </article>
  )
}
