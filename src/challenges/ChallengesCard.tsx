import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Pencil } from 'lucide-react'
import { ChallengeWheel } from './ChallengeWheel'
import {
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_STATUSES,
  listChallengeRows,
  loadSeedChallenges,
  mergeChallenges,
  safeVideoUrl,
  saveChallenge,
  type Challenge,
  type ChallengeStatus,
} from '../data/challenges/client'
import './challenges.css'

const PAGE_SIZE = 40

function statusClass(status: ChallengeStatus) {
  return status === 'Done' ? 'is-done' : status === 'In Progress' ? 'is-active' : ''
}

/**
 * The 365 challenges: filter, pick one at random, watch the video once there
 * is one. Guests read it; with `canEdit` (the admin, on the admin home) every
 * row can be marked, reworded and given a video link in place.
 */
export function ChallengesCard({
  title,
  canEdit = false,
  idToken = '',
  className = '',
}: {
  title: string
  canEdit?: boolean
  idToken?: string
  className?: string
}) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savedOffline, setSavedOffline] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<'all' | ChallengeStatus>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [pickedId, setPickedId] = useState<number | null>(null)
  // Bumped to deal the wheel a new set of challenges.
  const [wheelDeal, setWheelDeal] = useState(0)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ challenge: '', duration: '', difficulty: '', category: '', videoUrl: '' })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const seed = await loadSeedChallenges()
      // The saved rows are an overlay: if they cannot be read, the list still shows.
      const rows = await listChallengeRows().catch(() => {
        if (!cancelled) setSavedOffline(true)
        return []
      })
      if (!cancelled) {
        setChallenges(mergeChallenges(seed, rows))
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => [...new Set(challenges.map((item) => item.category))], [challenges])

  const filtered = useMemo(
    () =>
      challenges.filter(
        (item) => (category === 'all' || item.category === category) && (status === 'all' || item.status === status),
      ),
    [challenges, category, status],
  )

  const doneCount = challenges.filter((item) => item.status === 'Done').length
  const picked = challenges.find((item) => item.id === pickedId) ?? null

  /** Applies a change at once, then saves it; a failed save puts the old row back. */
  async function update(next: Challenge) {
    const previous = challenges.find((item) => item.id === next.id)
    setChallenges((list) => list.map((item) => (item.id === next.id ? next : item)))
    setError('')

    try {
      await saveChallenge(idToken, next)
    } catch (caught) {
      if (previous) setChallenges((list) => list.map((item) => (item.id === next.id ? previous : item)))
      setError(caught instanceof Error ? caught.message : 'Unable to save the challenge')
    }
  }

  function startEdit(item: Challenge) {
    setEditingId(item.id)
    setDraft({
      challenge: item.challenge,
      duration: item.duration,
      difficulty: item.difficulty,
      category: item.category,
      videoUrl: item.videoUrl,
    })
  }

  function saveEdit(item: Challenge) {
    const text = draft.challenge.trim()
    if (!text) return

    void update({
      ...item,
      challenge: text,
      duration: draft.duration.trim() || item.duration,
      difficulty: draft.difficulty || item.difficulty,
      category: draft.category.trim() || item.category,
      videoUrl: safeVideoUrl(draft.videoUrl),
    })
    setEditingId(null)
  }

  function renderActions(item: Challenge) {
    if (!canEdit) return null

    return (
      <div className="challenge-actions">
        <select
          className="challenge-status-select"
          value={item.status}
          aria-label={`Status of challenge ${item.id}`}
          onChange={(event) => void update({ ...item, status: event.target.value as ChallengeStatus })}
        >
          {CHALLENGE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="challenge-icon-btn"
          aria-label={`Edit challenge ${item.id}`}
          onClick={() => (editingId === item.id ? setEditingId(null) : startEdit(item))}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
      </div>
    )
  }

  function renderEditor(item: Challenge) {
    return (
      <form
        className="challenge-editor"
        onSubmit={(event) => {
          event.preventDefault()
          saveEdit(item)
        }}
      >
        <label>
          <span>Challenge</span>
          <input
            type="text"
            value={draft.challenge}
            onChange={(event) => setDraft({ ...draft, challenge: event.target.value })}
          />
        </label>
        <label>
          <span>Category</span>
          <input
            type="text"
            list="challenge-categories"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </label>
        <label>
          <span>Duration</span>
          <input
            type="text"
            value={draft.duration}
            onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
          />
        </label>
        <label>
          <span>Difficulty</span>
          <select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })}>
            {CHALLENGE_DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="challenge-editor-wide">
          <span>Video link</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://youtube.com/…"
            value={draft.videoUrl}
            onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })}
          />
        </label>
        <div className="challenge-editor-buttons">
          <button type="submit" className="challenge-btn is-primary">
            Save
          </button>
          <button type="button" className="challenge-btn" onClick={() => setEditingId(null)}>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  function renderRow(item: Challenge, highlighted = false) {
    return (
      <li key={item.id} className={`challenge-row ${statusClass(item.status)} ${highlighted ? 'is-picked' : ''}`}>
        <div className="challenge-main">
          <span className="challenge-number">#{item.id}</span>
          <span className="challenge-title">{item.challenge}</span>
        </div>
        <div className="challenge-meta">
          <span className="challenge-chip">{item.duration}</span>
          <span className={`challenge-chip difficulty-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>
          {!canEdit ? <span className={`challenge-chip status ${statusClass(item.status)}`}>{item.status}</span> : null}
          {item.videoUrl ? (
            <a className="challenge-video" href={item.videoUrl} target="_blank" rel="noopener noreferrer">
              Watch <ExternalLink size={11} aria-hidden="true" />
            </a>
          ) : null}
        </div>
        {renderActions(item)}
        {canEdit && editingId === item.id ? renderEditor(item) : null}
      </li>
    )
  }

  return (
    <article className={`info-card challenges-card ${className}`.trim()}>
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          {!isLoading ? (
            <span className="admin-pill">
              {doneCount} / {challenges.length} done
            </span>
          ) : null}
        </div>
      </div>

      <div className="challenge-toolbar">
        <select
          value={category}
          aria-label="Filter by category"
          onChange={(event) => {
            setCategory(event.target.value)
            setVisible(PAGE_SIZE)
          }}
        >
          <option value="all">All categories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={status}
          aria-label="Filter by status"
          onChange={(event) => {
            setStatus(event.target.value as 'all' | ChallengeStatus)
            setVisible(PAGE_SIZE)
          }}
        >
          <option value="all">Any status</option>
          {CHALLENGE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <datalist id="challenge-categories">
        {categories.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      {error ? <p className="sheets-meta challenge-error">{error}</p> : null}
      {savedOffline ? (
        <p className="sheets-meta">Saved progress could not be loaded, so everything shows as not started.</p>
      ) : null}

      {!isLoading ? (
        <ChallengeWheel
          key={`${category}|${status}|${wheelDeal}`}
          pool={filtered}
          onLanded={setPickedId}
          onReshuffle={() => setWheelDeal((deal) => deal + 1)}
        />
      ) : null}

      {picked ? (
        <section className="challenge-picked" aria-label="Picked challenge">
          <h4>The wheel says</h4>
          <ul className="challenge-list">{renderRow(picked, true)}</ul>
        </section>
      ) : null}

      {isLoading ? <p className="sheets-meta">Loading challenges…</p> : null}

      <ul className="challenge-list">{filtered.slice(0, visible).map((item) => renderRow(item))}</ul>

      {!isLoading && filtered.length === 0 ? <p className="sheets-meta">No challenges match.</p> : null}

      {filtered.length > visible ? (
        <button type="button" className="challenge-btn challenge-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
          Show more ({filtered.length - visible} left)
        </button>
      ) : null}
    </article>
  )
}
