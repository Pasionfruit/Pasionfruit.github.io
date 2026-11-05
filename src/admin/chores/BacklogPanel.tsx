import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'
import {
  deleteBacklogItem,
  listBacklog,
  saveBacklogItem,
  type BacklogItem,
} from '../../data/backlog/client'
import {
  dayOptions,
  defaultDue,
  dueState,
  formatDue,
  isFutureDue,
  joinDue,
  sortBacklog,
  timeOptionsFor,
} from './backlogDue'

/**
 * A quick-jot list of one-off to-dos. Every item gets a due time: an hour from
 * now unless you pick another, and never in the past. Type, press Enter.
 */
export function BacklogPanel({ idToken }: { idToken: string }) {
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  // Null until you pick one, so the suggestion keeps tracking "an hour from now".
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [pickedTime, setPickedTime] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    listBacklog(idToken)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'The backlog could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idToken])

  // Re-check due times when the app returns to the foreground, and once a minute while open.
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  /** Apply a change now, send it, and put things back if the save fails. */
  const run = useCallback(
    async (apply: () => void, undo: () => void, request: () => Promise<void>, message: string) => {
      apply()
      setError('')
      try {
        await request()
      } catch (caught) {
        undo()
        setError(caught instanceof Error ? caught.message : message)
      }
    },
    [],
  )

  const suggestion = useMemo(() => defaultDue(now), [now])
  const days = useMemo(() => dayOptions(now), [now])
  const day = pickedDay ?? suggestion.date
  const times = useMemo(() => timeOptionsFor(day, now), [day, now])
  // A picked time that has since slipped into the past falls back to the first one still ahead.
  const wanted = pickedTime ?? suggestion.time
  const time = times.some((option) => option.value === wanted)
    ? wanted
    : (times.find((option) => option.value !== '')?.value ?? '')

  function chooseDay(value: string) {
    setPickedDay(value)
    setError('')
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const due = joinDue(day, time)
    if (!isFutureDue(due, new Date())) {
      setError('Pick a time in the future.')
      return
    }
    const item: BacklogItem = {
      id: crypto.randomUUID(),
      title: trimmed,
      due,
      done: false,
      createdAt: new Date().toISOString(),
    }
    setTitle('')
    setPickedDay(null)
    setPickedTime(null)
    void run(
      () => setItems((current) => [...current, item]),
      () => setItems((current) => current.filter((i) => i.id !== item.id)),
      () => saveBacklogItem(idToken, item),
      'The item could not be added.',
    )
  }

  function toggle(item: BacklogItem) {
    const next = { ...item, done: !item.done }
    void run(
      () => setItems((current) => current.map((i) => (i.id === item.id ? next : i))),
      () => setItems((current) => current.map((i) => (i.id === item.id ? item : i))),
      () => saveBacklogItem(idToken, next),
      'The item could not be saved.',
    )
  }

  function remove(item: BacklogItem) {
    void run(
      () => setItems((current) => current.filter((i) => i.id !== item.id)),
      () => setItems((current) => [...current, item]),
      () => deleteBacklogItem(idToken, item.id),
      'The item could not be deleted.',
    )
  }

  const sorted = useMemo(() => sortBacklog(items), [items])
  const doneCount = items.filter((i) => i.done).length

  function clearDone() {
    for (const item of items.filter((i) => i.done)) remove(item)
  }

  return (
    <div className="backlog">
      <form className="backlog-add" onSubmit={add}>
        <div className="backlog-add-row">
          <input
            aria-label="New backlog item"
            placeholder="Jot something down…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button type="submit" className="primary-action" disabled={!title.trim()}>
            Add
          </button>
        </div>
        <div className="backlog-when">
          <select aria-label="Due day" value={day} onChange={(event) => chooseDay(event.target.value)}>
            {days.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Due time"
            value={time}
            onChange={(event) => {
              setPickedTime(event.target.value)
              setError('')
            }}
          >
            {times.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error ? (
        <p className="chore-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="chore-empty">Loading backlog…</p>
      ) : sorted.length === 0 ? (
        <p className="chore-empty">Nothing in the backlog. Jot something down above.</p>
      ) : (
        <ul className="chore-list backlog-list">
          {sorted.map((item) => {
            const state = item.done ? 'none' : dueState(item.due, now)
            return (
              <li
                key={item.id}
                className={`chore-row backlog-row${item.done ? ' is-done' : ''}${state === 'overdue' ? ' is-overdue' : ''}`}
              >
                <button
                  type="button"
                  className="chore-done-btn"
                  aria-label={item.done ? `Reopen ${item.title}` : `Complete ${item.title}`}
                  aria-pressed={item.done}
                  onClick={() => toggle(item)}
                >
                  {item.done ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : null}
                </button>
                <div className="chore-main">
                  <span className="chore-name">{item.title}</span>
                </div>
                {item.due ? <span className="backlog-due">{formatDue(item.due, now)}</span> : null}
                {state === 'overdue' ? (
                  <span className="chore-status chore-status--overdue">
                    <TriangleAlert size={12} strokeWidth={1.8} aria-hidden="true" />
                    Overdue
                  </span>
                ) : null}
                <button
                  type="button"
                  className="chore-edit-btn"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => remove(item)}
                >
                  <X size={14} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {doneCount > 0 ? (
        <button type="button" className="secondary-action backlog-clear" onClick={clearDone}>
          Clear {doneCount} done
        </button>
      ) : null}
    </div>
  )
}
