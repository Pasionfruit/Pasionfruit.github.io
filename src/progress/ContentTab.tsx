import { useState, type FormEvent } from 'react'
import { CONTENT_CATEGORIES, CONTENT_STATUSES, deleteRow, saveRow, type ContentItem } from './client'
import { contentHours, engagementRate, inRange, num, todayLocal, type DateRange } from './analytics'
import type { ProgressData } from './useProgressData'

const blank = (): ContentItem => ({
  content_id: '', title: '', status: 'idea', platform: '', category: CONTENT_CATEGORIES[0], post_date: '',
  filming_min: '', editing_min: '', views: '', likes: '', comments: '', notes: '', updated_at: '',
})

export function ContentTab({ idToken, data, range, onChanged }: { idToken: string; data: ProgressData; range: DateRange; onChanged: () => void }) {
  const [draft, setDraft] = useState<ContentItem>(blank)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<string>('idea')
  const [formOpen, setFormOpen] = useState(false)
  const set = (field: keyof ContentItem, value: string) => setDraft((d) => ({ ...d, [field]: value }))

  const published = data.content.filter((c) => c.status === 'published' && c.post_date && inRange(c.post_date, range))
  const hours = data.content.reduce((n, c) => n + contentHours(c), 0)
  const rate = engagementRate(published)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.title.trim()) {
      setError('Give it a title.')
      return
    }
    for (const f of ['filming_min', 'editing_min', 'views', 'likes', 'comments'] as const) {
      if (draft[f] !== '' && !(num(draft[f]) !== null && Number(draft[f]) >= 0)) {
        setError(`${f.replace('_', ' ')} must be a positive number.`)
        return
      }
    }
    setBusy(true)
    setError('')
    try {
      const status = draft.status === 'published' && !draft.post_date ? todayLocal() : draft.post_date
      await saveRow(idToken, 'progress_content', {
        ...draft,
        title: draft.title.trim(),
        post_date: status,
        content_id: draft.content_id || crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      setDraft(blank())
      setEditing(false)
      setFormOpen(false)
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: ContentItem) {
    if (!window.confirm(`Delete "${item.title}"?`)) return
    try {
      await deleteRow(idToken, 'progress_content', 'content_id', item.content_id)
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Delete failed.')
    }
  }

  async function advance(item: ContentItem) {
    const next = CONTENT_STATUSES[CONTENT_STATUSES.indexOf(item.status as (typeof CONTENT_STATUSES)[number]) + 1]
    if (!next) return
    await saveRow(idToken, 'progress_content', {
      ...item, status: next, post_date: next === 'published' && !item.post_date ? todayLocal() : item.post_date, updated_at: new Date().toISOString(),
    }).then(onChanged, (caught) => setError(caught instanceof Error ? caught.message : 'Could not update.'))
  }

  return (
    <div className="pg-stack">
      <div className="pg-tiles">
        <div><b>{published.length}</b><span>posted in range</span></div>
        <div><b>{Math.round(hours * 10) / 10}</b><span>hours filming + editing</span></div>
        <div><b>{published.reduce((n, c) => n + (num(c.views) ?? 0), 0)}</b><span>views</span></div>
        <div><b>{rate === null ? '—' : `${rate.toFixed(1)}%`}</b><span>engagement</span></div>
      </div>

      <div className="pg-subtabs" role="group" aria-label="Status">
        {CONTENT_STATUSES.map((st) => (
          <button key={st} type="button" className={filter === st ? 'is-on' : ''} aria-pressed={filter === st} onClick={() => setFilter(st)}>
            {st} {data.content.filter((c) => c.status === st).length}
          </button>
        ))}
      </div>
      <ul className="pg-list pg-cards">
        {data.content
          .filter((c) => c.status === filter)
          .sort((a, b) => (b.post_date || b.updated_at).localeCompare(a.post_date || a.updated_at))
          .map((c) => (
            <li key={c.content_id}>
              <div>
                <strong>{c.title}</strong>
                <p className="sheets-meta">{[c.platform, c.category, c.post_date].filter(Boolean).join(' · ')}</p>
                {(c.views || c.likes) && <p className="sheets-meta">{c.views || 0} views · {c.likes || 0} likes</p>}
              </div>
              <div className="pg-row-actions">
                {filter !== 'published' && <button type="button" className="secondary-action" onClick={() => advance(c)} aria-label={`Move ${c.title} to next stage`}>→</button>}
                <button type="button" className="secondary-action" onClick={() => { setDraft(c); setEditing(true); setFormOpen(true) }}>Edit</button>
                <button type="button" className="secondary-action" onClick={() => remove(c)} aria-label={`Delete ${c.title}`}>✕</button>
              </div>
            </li>
          ))}
        {data.content.every((c) => c.status !== filter) && <li className="sheets-meta">Nothing here yet.</li>}
      </ul>

      <details className="pg-details" open={formOpen} onToggle={(e) => setFormOpen(e.currentTarget.open)}>
      <summary>{editing ? 'Edit video' : '+ Add an idea'}</summary>
      <form className="pg-form" onSubmit={submit}>
        <div className="pg-grid">
          <label className="pg-field pg-wide"><span>Title</span><input type="text" value={draft.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="pg-field"><span>Status</span>
            <select value={draft.status} onChange={(e) => set('status', e.target.value)}>{CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </label>
          <label className="pg-field"><span>Category</span>
            <select value={draft.category} onChange={(e) => set('category', e.target.value)}>{CONTENT_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </label>
          <label className="pg-field"><span>Platform</span><input type="text" value={draft.platform} placeholder="YouTube, TikTok…" onChange={(e) => set('platform', e.target.value)} /></label>
          <label className="pg-field"><span>Post date</span><input type="date" value={draft.post_date} onChange={(e) => set('post_date', e.target.value)} /></label>
          {(['filming_min', 'editing_min', 'views', 'likes', 'comments'] as const).map((f) => (
            <label className="pg-field" key={f}><span>{f === 'filming_min' ? 'Filming (min)' : f === 'editing_min' ? 'Editing (min)' : f[0].toUpperCase() + f.slice(1)}</span>
              <input type="number" min="0" inputMode="numeric" value={draft[f]} onChange={(e) => set(f, e.target.value)} /></label>
          ))}
        </div>
        <div className="pg-actions">
          <button type="submit" className="primary-action" disabled={busy}>{editing ? 'Save changes' : 'Add'}</button>
          {editing && <button type="button" className="secondary-action" onClick={() => { setDraft(blank()); setEditing(false) }}>Cancel</button>}
          {error && <span className="pg-error" role="alert">{error}</span>}
        </div>
      </form>
      </details>
    </div>
  )
}
