import { RECURRENCE_UNITS, type RecurrenceUnit, type RepeatDraft } from '../data/todoist/recurrence'

export type RepeatControlsProps = {
  draft: RepeatDraft
  onChange: (draft: RepeatDraft) => void
  /** A repeat needs a date to start from, so this is off until the task has one. */
  canRepeat: boolean
  disabled?: boolean
}

/** The Repeat checkbox, and the interval fields once it is on. */
export function RepeatControls({ draft, onChange, canRepeat, disabled = false }: RepeatControlsProps) {
  const showFields = draft.repeats && canRepeat

  return (
    <div className="task-edit-row task-repeat-row">
      <label className="task-repeat-toggle">
        <input
          type="checkbox"
          checked={draft.repeats}
          disabled={disabled || !canRepeat}
          onChange={(event) => onChange({ ...draft, repeats: event.target.checked })}
        />
        Repeat
      </label>
      {showFields ? (
        <>
          <span className="task-repeat-every-label">every</span>
          <input
            className="task-input task-repeat-every"
            type="number"
            min={1}
            value={draft.every}
            aria-label="Repeat every"
            onChange={(event) => onChange({ ...draft, every: event.target.value })}
          />
          <select
            className="task-input"
            value={draft.unit}
            aria-label="Repeat unit"
            onChange={(event) => onChange({ ...draft, unit: event.target.value as RecurrenceUnit })}
          >
            {RECURRENCE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}s
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  )
}
