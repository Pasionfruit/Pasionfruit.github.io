import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Clock, ListFilter, Plus, Trash2, TriangleAlert } from 'lucide-react'
import {
  CHORE_CATEGORIES,
  CHORE_CATEGORY_LABELS,
  deleteChore,
  listChores,
  saveChore,
  type Chore,
  type ChoreCategory,
} from '../../data/chores/client'
import {
  CADENCE_LABELS,
  choreCadence,
  choreStatus,
  lastDoneLabel,
  localDayKey,
  needsAttention,
  sortChores,
  warningLabel,
  type ChoreCadence,
} from './choreStatus'

type Filter = 'all' | ChoreCategory
type CadenceFilter = 'all' | ChoreCadence
type OpenFilter = 'time' | 'category' | null

/**
 * Recurring household chores. Each has a category and a "every N days" interval;
 * the card shows when it was last done and warns when it is past due.
 */
export function ChoresCard({ title, idToken }: { title: string; idToken: string }) {
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [cadence, setCadence] = useState<CadenceFilter>('all')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null)
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
  const visible = sorted.filter(
    (c) =>
      (filter === 'all' || c.category === filter) &&
      (cadence === 'all' || choreCadence(c) === cadence) &&
      (!attentionOnly || needsAttention(c, today)),
  )
  const attentionCount = chores.filter((c) => needsAttention(c, today)).length

  return (
    <article className="info-card admin-card chores-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
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

      <div className="chore-filters">
        <div className="chore-filter-bar">
          <button
            type="button"
            className="chore-filter-btn chore-attention-btn"
            aria-pressed={attentionOnly}
            onClick={() => setAttentionOnly((on) => !on)}
          >
            <TriangleAlert size={12} strokeWidth={1.8} aria-hidden="true" />
            Needs attention
            <span className="chore-count">{attentionCount}</span>
          </button>

          <div className="chore-filter-icons">
            <button
              type="button"
              className="chore-icon-btn"
              aria-label="Filter by how often"
              title={cadence === 'all' ? 'Any time' : CADENCE_LABELS[cadence]}
              aria-expanded={openFilter === 'time'}
              aria-controls="chore-time-options"
              data-active={cadence !== 'all'}
              onClick={() => setOpenFilter((open) => (open === 'time' ? null : 'time'))}
            >
              <Clock size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="chore-icon-btn"
              aria-label="Filter by category"
              title={filter === 'all' ? 'All categories' : CHORE_CATEGORY_LABELS[filter]}
              aria-expanded={openFilter === 'category'}
              aria-controls="chore-category-options"
              data-active={filter !== 'all'}
              onClick={() => setOpenFilter((open) => (open === 'category' ? null : 'category'))}
            >
              <ListFilter size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        {openFilter === 'time' ? (
          <div id="chore-time-options" className="chore-filter" role="group" aria-label="Time options">
            {(['all', 'daily', 'weekly', 'monthly'] as CadenceFilter[]).map((id) => (
              <button
                key={id}
                type="button"
                className="chore-filter-btn"
                aria-pressed={cadence === id}
                onClick={() => {
                  setCadence(id)
                  setOpenFilter(null)
                }}
              >
                {id === 'all' ? 'Any time' : CADENCE_LABELS[id]}
              </button>
            ))}
          </div>
        ) : null}

        {openFilter === 'category' ? (
          <div id="chore-category-options" className="chore-filter" role="group" aria-label="Category options">
            {(['all', ...CHORE_CATEGORIES] as Filter[]).map((id) => (
              <button
                key={id}
                type="button"
                className="chore-filter-btn"
                aria-pressed={filter === id}
                onClick={() => {
                  setFilter(id)
                  setOpenFilter(null)
                }}
              >
                {id !== 'all' ? <span className={`chore-dot chore-dot--${id}`} aria-hidden="true" /> : null}
                {id === 'all' ? 'All categories' : CHORE_CATEGORY_LABELS[id]}
              </button>
            ))}
          </div>
        ) : null}
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
        <p className="chore-empty">{chores.length === 0 ? 'No chores yet. Add one with the + button.' : attentionOnly && chores.length > 0 ? 'Nothing needs attention here.' : 'No chores match these filters.'}</p>
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
