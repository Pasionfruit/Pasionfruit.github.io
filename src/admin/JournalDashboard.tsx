import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AdminPage } from './AdminPage'
import { adminDashboardsById } from '../siteContent'
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntries,
  updateJournalEntry,
} from '../data/sheets/repositories'
import type { JournalEntryRecord } from '../data/sheets/types'
import { BreathingTimerCard } from './BreathingTimerCard'
import { MoodTrackerCard } from './MoodTrackerCard'
import { MOOD_SCALE } from './journal/moods'
import { VerseOfTheDayCard } from './VerseOfTheDayCard'
import { GarminSleepCard } from './GarminCards'
import { GRATITUDE_LINE_COUNT, getPromptOfTheDay } from './journal/prompts'

/** Best first in the picker; MOOD_SCALE is ordered worst-first for scoring. */
const MOODS = [...MOOD_SCALE].reverse()

type Draft = {
  entryDate: string
  title: string
  mood: string
  body: string
  gratitude: string[]
  prompt: string
  reflection: string
  tags: string
}

function localDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function emptyDraft(): Draft {
  return {
    entryDate: localDayKey(new Date()),
    title: '',
    mood: 'Good',
    body: '',
    gratitude: Array(GRATITUDE_LINE_COUNT).fill(''),
    prompt: getPromptOfTheDay(),
    reflection: '',
    tags: '',
  }
}

function toDraft(entry: JournalEntryRecord): Draft {
  const gratitude = Array(GRATITUDE_LINE_COUNT).fill('')
  entry.gratitude.slice(0, GRATITUDE_LINE_COUNT).forEach((line, index) => {
    gratitude[index] = line
  })

  return {
    entryDate: entry.entry_date,
    title: entry.title,
    mood: entry.mood || 'Good',
    body: entry.body,
    gratitude,
    // Older entries predate the prompt, so fall back to today's question.
    prompt: entry.prompt || getPromptOfTheDay(),
    reflection: entry.reflection,
    tags: entry.tags.join(', '),
  }
}

function formatEntryDate(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) {
    return key
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function JournalDashboard({ canWrite, idToken }: { canWrite: boolean; idToken: string }) {
  const meta = adminDashboardsById.personal
  const [entries, setEntries] = useState<JournalEntryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [tagFilter, setTagFilter] = useState('')
  const [entryIndex, setEntryIndex] = useState(0)

  async function load() {
    try {
      setEntries(await getJournalEntries(idToken))
      setLoadError('')
    } catch (caught) {
      setEntries([])
      setLoadError(caught instanceof Error ? caught.message : 'Unable to load journal entries')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const rows = await getJournalEntries(idToken)
        if (!cancelled) {
          setEntries(rows)
          setLoadError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setEntries([])
          setLoadError(caught instanceof Error ? caught.message : 'Unable to load journal entries')
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

  const allTags = useMemo(() => {
    const seen = new Set<string>()
    for (const entry of entries) {
      for (const tag of entry.tags) {
        seen.add(tag)
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [entries])

  // Newest first; the pager walks back one day at a time from here.
  const visibleEntries = useMemo(() => {
    const filtered = tagFilter ? entries.filter((entry) => entry.tags.includes(tagFilter)) : entries
    return [...filtered].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  }, [entries, tagFilter])

  // A new filter starts from the newest entry; a shrunken list stays in range.
  useEffect(() => {
    setEntryIndex(0)
  }, [tagFilter])

  useEffect(() => {
    setEntryIndex((index) => Math.min(index, Math.max(0, visibleEntries.length - 1)))
  }, [visibleEntries])

  // Consecutive days with an entry, counting back from today.
  const streak = useMemo(() => {
    const keys = new Set(entries.map((entry) => entry.entry_date))
    const cursor = new Date()
    let count = 0

    while (keys.has(localDayKey(cursor))) {
      count += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    return count
  }, [entries])

  // The card shows one entry at a time; the pager moves through visibleEntries.
  const currentEntry: JournalEntryRecord | undefined =
    visibleEntries[Math.min(entryIndex, Math.max(0, visibleEntries.length - 1))]

  async function handleSave() {
    if (!canWrite || !idToken || isWriting || !draft.entryDate) {
      return
    }

    setIsWriting(true)
    setWriteError('')

    const payload = {
      entryDate: draft.entryDate,
      title: draft.title.trim(),
      mood: draft.mood,
      body: draft.body,
      gratitude: draft.gratitude.map((line) => line.trim()).filter(Boolean),
      prompt: draft.prompt,
      reflection: draft.reflection.trim(),
      tags: parseTags(draft.tags),
    }

    try {
      if (editingId) {
        await updateJournalEntry(idToken, editingId, payload)
      } else {
        await createJournalEntry(idToken, payload)
      }

      setEditingId(null)
      setIsComposing(false)
      setDraft(emptyDraft())
      await load()
    } catch (caught) {
      setWriteError(caught instanceof Error ? caught.message : 'Unable to save entry')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDelete(entry: JournalEntryRecord) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')

    try {
      await deleteJournalEntry(idToken, entry.journal_id)
      await load()
    } catch (caught) {
      setWriteError(caught instanceof Error ? caught.message : 'Unable to delete entry')
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
    <AdminPage meta={meta}>
      {/* Verse spans the full width; sleep and the timer share the row below. */}
      <VerseOfTheDayCard title="Verse of the day" />

      <div className="journal-top-row">
        <GarminSleepCard title="Sleep & recovery" />
        <BreathingTimerCard title="Breathe" />
      </div>

      <MoodTrackerCard title="Mood" entries={entries} isLoading={isLoading} />

      <article className="info-card admin-card admin-card-wide">
        <div className="admin-card-head">
          <h3>Entries</h3>
          <div className="admin-card-actions">
            <span className="admin-pill">
              {entries.length} total · {streak} day streak
            </span>
            {canWrite ? (
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  if (isEditorOpen) {
                    closeEditor()
                    return
                  }
                  setEditingId(null)
                  setDraft(emptyDraft())
                  setIsComposing(true)
                }}
              >
                {isEditorOpen ? 'Cancel' : 'New entry'}
              </button>
            ) : null}
          </div>
        </div>

        {allTags.length > 0 ? (
          <div className="journal-tag-filter">
            <button
              type="button"
              className={tagFilter === '' ? 'active' : ''}
              onClick={() => setTagFilter('')}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={tagFilter === tag ? 'active' : ''}
                onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}

        {isEditorOpen ? (
          <div className="journal-editor">
            <div className="journal-editor-row">
              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={draft.entryDate}
                  onChange={(event) => setDraft({ ...draft, entryDate: event.target.value })}
                />
              </label>
              <label>
                <span>Mood</span>
                <select
                  value={draft.mood}
                  onChange={(event) => setDraft({ ...draft, mood: event.target.value })}
                >
                  {MOODS.map((mood) => (
                    <option key={mood} value={mood}>
                      {mood}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Title</span>
              <input
                type="text"
                value={draft.title}
                placeholder="What was today about?"
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>

            <label>
              <span>Entry</span>
              <textarea
                rows={8}
                value={draft.body}
                placeholder="Short is fine."
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
            </label>

            <fieldset className="gratitude-block">
              <legend>Grateful for</legend>
              {draft.gratitude.map((line, index) => (
                <input
                  key={index}
                  type="text"
                  value={line}
                  aria-label={`Grateful for, item ${index + 1}`}
                  placeholder={index === 0 ? 'Something small counts' : ''}
                  onChange={(event) => {
                    const gratitude = [...draft.gratitude]
                    gratitude[index] = event.target.value
                    setDraft({ ...draft, gratitude })
                  }}
                />
              ))}
            </fieldset>

            <label className="reflection-field">
              <span>{draft.prompt}</span>
              <textarea
                rows={3}
                value={draft.reflection}
                placeholder="A sentence is enough."
                onChange={(event) => setDraft({ ...draft, reflection: event.target.value })}
              />
            </label>

            <label>
              <span>Tags</span>
              <input
                type="text"
                value={draft.tags}
                placeholder="work, training, family"
                onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
              />
            </label>

            <div className="journal-editor-actions">
              <button type="button" onClick={handleSave} disabled={isWriting || !draft.entryDate}>
                {isWriting ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
              </button>
              <button type="button" className="secondary-action" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {writeError ? <p className="sheets-meta">{writeError}</p> : null}

        {isLoading ? (
          <p className="sheets-meta">Loading journal…</p>
        ) : loadError ? (
          <p className="sheets-meta">{loadError}</p>
        ) : !currentEntry ? (
          <p className="sheets-meta">
            {tagFilter ? `No entries tagged "${tagFilter}".` : 'No entries yet.'}
          </p>
        ) : (
          <>
            <div className="journal-pager">
              <button
                type="button"
                className="journal-pager-btn"
                onClick={() => setEntryIndex((index) => Math.min(index + 1, visibleEntries.length - 1))}
                disabled={entryIndex >= visibleEntries.length - 1}
                aria-label="Older entry"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <div className="journal-pager-label">
                <span>{formatEntryDate(currentEntry.entry_date)}</span>
                <small>
                  {entryIndex + 1} of {visibleEntries.length}
                </small>
              </div>
              <button
                type="button"
                className="journal-pager-btn"
                onClick={() => setEntryIndex((index) => Math.max(index - 1, 0))}
                disabled={entryIndex === 0}
                aria-label="Newer entry"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="journal-entry journal-entry--single">
              <div className="journal-entry-head">
                <h4>{currentEntry.title || 'Untitled'}</h4>
                <div className="journal-entry-meta">
                  {currentEntry.mood ? <span className="admin-pill">{currentEntry.mood}</span> : null}
                  {canWrite ? (
                    <>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => {
                          setIsComposing(false)
                          setEditingId(currentEntry.journal_id)
                          setDraft(toDraft(currentEntry))
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => handleDelete(currentEntry)}
                        disabled={isWriting}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {currentEntry.body ? <p className="journal-entry-body">{currentEntry.body}</p> : null}

              {currentEntry.gratitude.length > 0 ? (
                <div className="journal-gratitude">
                  <h5>Grateful for</h5>
                  <ul>
                    {currentEntry.gratitude.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {currentEntry.reflection ? (
                <div className="journal-reflection">
                  <h5>{currentEntry.prompt || 'Reflection'}</h5>
                  <p>{currentEntry.reflection}</p>
                </div>
              ) : null}

              {currentEntry.tags.length > 0 ? (
                <div className="journal-entry-tags">
                  {currentEntry.tags.map((tag) => (
                    <span key={tag} className="journal-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </article>
    </AdminPage>
  )
}
