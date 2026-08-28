import { useEffect, useMemo, useState } from 'react'
import { PageFrame } from '../components/PageFrame'
import { adminDashboardsById } from '../siteContent'
import {
  createWorkItem,
  deleteWorkItem,
  getWorkItems,
  updateWorkItem,
} from '../data/sheets/repositories'
import type { WorkItemRecord } from '../data/sheets/types'

const STATUSES = ['Not started', 'In progress', 'Blocked', 'Review', 'Done'] as const
const PRIORITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Normal', 3: 'High', 4: 'Urgent' }

/** Links opened most mornings anyway — kept here so they are one click from the day's list. */
const WORK_LINKS = [
  { label: 'Jira board', href: 'https://www.atlassian.com/software/jira' },
  { label: 'Confluence', href: 'https://www.atlassian.com/software/confluence' },
  { label: 'Outlook', href: 'https://outlook.office.com/mail/' },
  { label: 'Teams', href: 'https://teams.microsoft.com/' },
]

type Draft = {
  project: string
  item: string
  status: string
  dueDate: string
  priority: number
  notes: string
  link: string
}

function emptyDraft(): Draft {
  return { project: '', item: '', status: 'Not started', dueDate: '', priority: 2, notes: '', link: '' }
}

function toDraft(row: WorkItemRecord): Draft {
  return {
    project: row.project,
    item: row.item,
    status: row.status,
    dueDate: row.due_date ?? '',
    priority: row.priority,
    notes: row.notes ?? '',
    link: row.link ?? '',
  }
}

function localDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dueLabel(dueDate: string | undefined, today: string) {
  if (!dueDate) {
    return { text: 'No date', tone: 'none' as const }
  }

  if (dueDate < today) {
    return { text: `Overdue · ${dueDate}`, tone: 'overdue' as const }
  }

  if (dueDate === today) {
    return { text: 'Due today', tone: 'today' as const }
  }

  return { text: `Due ${dueDate}`, tone: 'upcoming' as const }
}

export function WorkDashboard({ canWrite, idToken }: { canWrite: boolean; idToken: string }) {
  const meta = adminDashboardsById.work
  const [rows, setRows] = useState<WorkItemRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [showDone, setShowDone] = useState(false)

  const today = localDayKey(new Date())

  async function load() {
    try {
      setRows(await getWorkItems())
      setLoadError('')
    } catch (caught) {
      setRows([])
      setLoadError(caught instanceof Error ? caught.message : 'Unable to load work items')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const rows = await getWorkItems()
        if (!cancelled) {
          setRows(rows)
          setLoadError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setRows([])
          setLoadError(caught instanceof Error ? caught.message : 'Unable to load work items')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const visibleRows = useMemo(() => {
    const filtered = showDone ? rows : rows.filter((row) => row.status !== 'Done')

    // Overdue first, then by due date, then by priority descending.
    return [...filtered].sort((a, b) => {
      const aDue = a.due_date ?? '9999-12-31'
      const bDue = b.due_date ?? '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return b.priority - a.priority
    })
  }, [rows, showDone])

  const byProject = useMemo(() => {
    const map: Record<string, WorkItemRecord[]> = {}
    for (const row of visibleRows) {
      const key = row.project || 'Unassigned'
      map[key] = map[key] ?? []
      map[key].push(row)
    }
    return map
  }, [visibleRows])

  const counts = useMemo(
    () => ({
      open: rows.filter((row) => row.status !== 'Done').length,
      overdue: rows.filter((row) => row.status !== 'Done' && row.due_date && row.due_date < today)
        .length,
    }),
    [rows, today],
  )

  async function handleSave() {
    if (!canWrite || !idToken || isWriting || !draft.item.trim()) {
      return
    }

    setIsWriting(true)
    setWriteError('')

    const payload = {
      project: draft.project.trim(),
      item: draft.item.trim(),
      status: draft.status,
      dueDate: draft.dueDate,
      priority: draft.priority,
      notes: draft.notes,
      link: draft.link.trim(),
    }

    try {
      if (editingId) {
        await updateWorkItem(idToken, editingId, payload)
      } else {
        await createWorkItem(idToken, payload)
      }

      closeEditor()
      await load()
    } catch (caught) {
      setWriteError(caught instanceof Error ? caught.message : 'Unable to save work item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleStatusChange(row: WorkItemRecord, status: string) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    setRows((previous) =>
      previous.map((item) => (item.work_id === row.work_id ? { ...item, status } : item)),
    )
    setIsWriting(true)
    setWriteError('')

    try {
      await updateWorkItem(idToken, row.work_id, { ...toDraft(row), status })
    } catch (caught) {
      setRows((previous) =>
        previous.map((item) => (item.work_id === row.work_id ? { ...item, status: row.status } : item)),
      )
      setWriteError(caught instanceof Error ? caught.message : 'Unable to update status')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDelete(row: WorkItemRecord) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')

    try {
      await deleteWorkItem(idToken, row.work_id)
      await load()
    } catch (caught) {
      setWriteError(caught instanceof Error ? caught.message : 'Unable to delete work item')
    } finally {
      setIsWriting(false)
    }
  }

  function closeEditor() {
    setEditingId(null)
    setIsComposing(false)
    setDraft(emptyDraft())
  }

  const isEditorOpen = isComposing || editingId !== null

  return (
    <PageFrame
      eyebrow={meta.eyebrow}
      title={meta.title}
      summary={meta.intro}
      accent={meta.accent}
      backLink="/admin"
      backLabel="Back to dashboards"
      note={meta.note}
    >
      <article className="info-card admin-card admin-card-wide">
        <div className="admin-card-head">
          <h3>In flight</h3>
          <div className="admin-card-actions">
            <span className="admin-pill">
              {counts.open} open · {counts.overdue} overdue
            </span>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setShowDone((value) => !value)}
            >
              {showDone ? 'Hide done' : 'Show done'}
            </button>
            {canWrite ? (
              <button
                type="button"
                className="secondary-action"
                onClick={() => (isEditorOpen ? closeEditor() : setIsComposing(true))}
              >
                {isEditorOpen ? 'Cancel' : 'New item'}
              </button>
            ) : null}
          </div>
        </div>

        {isEditorOpen ? (
          <div className="journal-editor">
            <div className="journal-editor-row">
              <label>
                <span>Project</span>
                <input
                  type="text"
                  value={draft.project}
                  placeholder="SunGuide"
                  onChange={(event) => setDraft({ ...draft, project: event.target.value })}
                />
              </label>
              <label>
                <span>Due</span>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
                />
              </label>
            </div>

            <label>
              <span>Item</span>
              <input
                type="text"
                value={draft.item}
                placeholder="What needs doing?"
                onChange={(event) => setDraft({ ...draft, item: event.target.value })}
              />
            </label>

            <div className="journal-editor-row">
              <label>
                <span>Status</span>
                <select
                  value={draft.status}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={draft.priority}
                  onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
                >
                  {[4, 3, 2, 1].map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Notes</span>
              <textarea
                rows={4}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>

            <label>
              <span>Link</span>
              <input
                type="url"
                value={draft.link}
                placeholder="https://"
                onChange={(event) => setDraft({ ...draft, link: event.target.value })}
              />
            </label>

            <div className="journal-editor-actions">
              <button type="button" onClick={handleSave} disabled={isWriting || !draft.item.trim()}>
                {isWriting ? 'Saving…' : editingId ? 'Save changes' : 'Add item'}
              </button>
              <button type="button" className="secondary-action" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {writeError ? <p className="sheets-meta">{writeError}</p> : null}

        {isLoading ? (
          <p className="sheets-meta">Loading work items…</p>
        ) : loadError ? (
          <p className="sheets-meta">{loadError}</p>
        ) : visibleRows.length === 0 ? (
          <p className="sheets-meta">Nothing in flight.</p>
        ) : (
          Object.entries(byProject).map(([project, items]) => (
            <div key={project} className="work-project">
              <h4>{project}</h4>
              <ul className="work-list">
                {items.map((row) => {
                  const due = dueLabel(row.due_date, today)

                  return (
                    <li key={row.work_id} className={`work-row priority-${row.priority}`}>
                      <div className="work-row-main">
                        <p className="work-item-name">
                          {row.link ? (
                            <a href={row.link} target="_blank" rel="noreferrer">
                              {row.item}
                            </a>
                          ) : (
                            row.item
                          )}
                        </p>
                        {row.notes ? <p className="work-notes">{row.notes}</p> : null}
                      </div>

                      <div className="work-row-meta">
                        <span className={`work-due work-due-${due.tone}`}>{due.text}</span>
                        <span className="admin-pill">{PRIORITY_LABELS[row.priority] ?? 'Normal'}</span>

                        {canWrite ? (
                          <>
                            <select
                              value={row.status}
                              onChange={(event) => handleStatusChange(row, event.target.value)}
                              disabled={isWriting}
                              aria-label={`Status for ${row.item}`}
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => {
                                setIsComposing(false)
                                setEditingId(row.work_id)
                                setDraft(toDraft(row))
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => handleDelete(row)}
                              disabled={isWriting}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="admin-pill">{row.status}</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </article>

      <article className="info-card admin-card">
        <h3>Morning links</h3>
        <div className="work-links">
          {WORK_LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="work-link">
              {link.label}
            </a>
          ))}
        </div>
      </article>
    </PageFrame>
  )
}
