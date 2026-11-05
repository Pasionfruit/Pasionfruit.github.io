import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Plus, Trash2, TriangleAlert } from 'lucide-react'
import {
  CHORE_CATEGORIES,
  CHORE_CATEGORY_LABELS,
  deleteChore,
  listChores,
  saveChore,
  type Chore,
  type ChoreCategory,
} from '../../data/chores/client'
import { choreStatus, lastDoneLabel, localDayKey, sortChores, warningLabel } from './choreStatus'

type Filter = 'all' | ChoreCategory

/**
 * Recurring household chores. Each has a category and a "every N days" interval;
 * the card shows when it was last done and warns when it is past due.
 */
export function ChoresCard({ title, idToken }: { title: string; idToken: string }) {
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [today, setToday] = useState(() => localDayKey(new Date()))

  useEffect(() => {
    let cancelled = false
    listChores(idToken)
      .then((rows) => {
        if (!cancelled) setChores(rows)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'The chores could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idToken])

  // A tab left open past midnight should not keep yesterday's overdue maths.
  useEffect(() => {
    const refresh = () => setToday(localDayKey(new Date()))
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const markDone = useCallback(
    async (chore: Chore) => {
      const next = { ...chore, lastDone: localDayKey(new Date()) }
      setChores((current) => current.map((c) => (c.id === chore.id ? next : c)))
      setError('')
      try {
        await saveChore(idToken, next)
      } catch (caught) {
        setChores((current) => current.map((c) => (c.id === chore.id ? chore : c)))
        setError(caught instanceof Error ? caught.message : 'The chore could not be saved.')
      }
    },
    [idToken],
  )

  const remove = useCallback(
    async (chore: Chore) => {
      setChores((current) => current.filter((c) => c.id !== chore.id))
      setError('')
      try {
        await deleteChore(idToken, chore.id)
      } catch (caught) {
        setChores((current) => [...current, chore])
        setError(caught instanceof Error ? caught.message : 'The chore could not be deleted.')
      }
    },
    [idToken],
  )

  const add = useCallback(
    async (chore: Chore) => {
      setChores((current) => [...current, chore])
      setAdding(false)
      setError('')
      try {
        await saveChore(idToken, chore)
      } catch (caught) {
        setChores((current) => current.filter((c) => c.id !== chore.id))
        setError(caught instanceof Error ? caught.message : 'The chore could not be added.')
      }
    },
    [idToken],
  )

  const sorted = useMemo(() => sortChores(chores, today), [chores, today])
  const visible = filter === 'all' ? sorted : sorted.filter((c) => c.category === filter)
  const overdueCount = chores.filter((c) => {
    const state = choreStatus(c, today).state
    return state === 'overdue' || state === 'never'
  }).length

  return (
    <article className="info-card admin-card chores-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          {overdueCount > 0 ? (
            <span className="admin-pill chore-warn-pill">
              <TriangleAlert size={12} strokeWidth={1.8} aria-hidden="true" /> {overdueCount} need attention
            </span>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-label={adding ? 'Cancel adding a chore' : 'Add a chore'}
            aria-expanded={adding}
            onClick={() => setAdding((open) => !open)}
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="chore-filter" role="group" aria-label="Filter chores by category">
        {(['all', ...CHORE_CATEGORIES] as Filter[]).map((id) => (
          <button
            key={id}
            type="button"
            className="chore-filter-btn"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {id !== 'all' ? <span className={`chore-dot chore-dot--${id}`} aria-hidden="true" /> : null}
            {id === 'all' ? 'All' : CHORE_CATEGORY_LABELS[id]}
          </button>
        ))}
      </div>

      {adding ? <AddChoreForm defaultCategory={filter === 'all' ? 'kitchen' : filter} onAdd={add} /> : null}

      {error ? (
        <p className="chore-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="chore-empty">Loading chores…</p>
      ) : visible.length === 0 ? (
        <p className="chore-empty">{chores.length === 0 ? 'No chores yet. Add one with the + button.' : 'Nothing in this category.'}</p>
      ) : (
        <ul className="chore-list">
          {visible.map((chore) => {
            const status = choreStatus(chore, today)
            const warning = warningLabel(status)
            const alert = status.state === 'overdue' || status.state === 'never'
            return (
              <li key={chore.id} className={`chore-row${alert ? ' is-overdue' : ''}`}>
                <button
                  type="button"
                  className="chore-done-btn"
                  aria-label={`Mark ${chore.name} done`}
                  onClick={() => void markDone(chore)}
                >
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                </button>
                <div className="chore-main">
                  <span className="chore-name">{chore.name}</span>
                  <span className="chore-meta">
                    <span className={`chore-dot chore-dot--${chore.category}`} aria-hidden="true" />
                    {CHORE_CATEGORY_LABELS[chore.category]} · {lastDoneLabel(status)} · every {chore.intervalDays}d
                  </span>
                </div>
                {warning ? (
                  <span className={`chore-status chore-status--${status.state}`}>
                    {alert ? <TriangleAlert size={12} strokeWidth={1.8} aria-hidden="true" /> : null}
                    {warning}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="chore-delete-btn"
                  aria-label={`Delete ${chore.name}`}
                  onClick={() => void remove(chore)}
                >
                  <Trash2 size={14} strokeWidth={1.6} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

function AddChoreForm({
  defaultCategory,
  onAdd,
}: {
  defaultCategory: ChoreCategory
  onAdd: (chore: Chore) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ChoreCategory>(defaultCategory)
  const [interval, setInterval] = useState('7')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    const days = Math.round(Number(interval))
    if (!trimmed || !Number.isFinite(days) || days < 1) return
    onAdd({ id: crypto.randomUUID(), name: trimmed, category, intervalDays: days, lastDone: '' })
  }

  return (
    <form className="chore-form" onSubmit={submit}>
      <input
        aria-label="Chore name"
        placeholder="Chore, e.g. Scoop litter box"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <select
        aria-label="Category"
        value={category}
        onChange={(event) => setCategory(event.target.value as ChoreCategory)}
      >
        {CHORE_CATEGORIES.map((id) => (
          <option key={id} value={id}>
            {CHORE_CATEGORY_LABELS[id]}
          </option>
        ))}
      </select>
      <label className="chore-interval">
        Every
        <input
          aria-label="Repeat every N days"
          type="number"
          min={1}
          inputMode="numeric"
          value={interval}
          onChange={(event) => setInterval(event.target.value)}
        />
        days
      </label>
      <button type="submit" className="primary-action">
        Add chore
      </button>
    </form>
  )
}
