import { useEffect, useMemo, useState } from 'react'
import {
  chapterUrl,
  fetchChapter,
  getVerseOfTheDay,
  parseVerseReference,
  type ChapterVerse,
} from './journal/verses'

const READ_STORAGE_KEY = 'verse-read-date'

/** Local calendar day, so "read" resets at local midnight like the verse does. */
function todayStamp() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

function readStoredRead(): boolean {
  try {
    return window.localStorage.getItem(READ_STORAGE_KEY) === todayStamp()
  } catch {
    return false
  }
}

function writeStoredRead(read: boolean) {
  try {
    if (read) window.localStorage.setItem(READ_STORAGE_KEY, todayStamp())
    else window.localStorage.removeItem(READ_STORAGE_KEY)
  } catch {
    // Nothing to do — the verse just shows again next visit.
  }
}

/**
 * The verse of the day. "Mark as read" folds the card to a single line for the
 * rest of the day, with a way to reopen it; "Read the whole chapter" loads the
 * chapter on demand and highlights the verse in it.
 */
export function VerseOfTheDayCard({ title }: { title: string }) {
  // Recomputed per render is cheap, but memoising keeps the reference stable.
  const verse = useMemo(() => getVerseOfTheDay(), [])
  const ref = useMemo(() => parseVerseReference(verse.reference), [verse])
  const [isRead, setIsRead] = useState(readStoredRead)
  const [showChapter, setShowChapter] = useState(false)
  const [chapter, setChapter] = useState<ChapterVerse[] | null>(null)
  const [chapterFailed, setChapterFailed] = useState(false)

  useEffect(() => {
    if (!showChapter || chapter || !ref) return
    const controller = new AbortController()
    fetchChapter(ref, controller.signal)
      .then((verses) => {
        setChapter(verses)
        setChapterFailed(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setChapterFailed(true)
      })
    return () => controller.abort()
  }, [showChapter, chapter, ref])

  function setRead(read: boolean) {
    setIsRead(read)
    writeStoredRead(read)
    if (read) setShowChapter(false)
  }

  if (isRead) {
    return (
      <article className="info-card admin-card verse-card verse-card-read">
        <div className="admin-card-head">
          <h3>{title}</h3>
          <div className="admin-card-actions">
            <span className="admin-pill">Read · {verse.reference}</span>
            <button type="button" className="section-edit-btn" onClick={() => setRead(false)}>
              Reopen
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="info-card admin-card verse-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <span className="admin-pill">KJV</span>
      </div>

      <blockquote className="verse-text">
        <p>{verse.text}</p>
        <cite>{verse.reference}</cite>
      </blockquote>

      <div className="verse-actions">
        {ref ? (
          <button
            type="button"
            className="section-edit-btn"
            aria-expanded={showChapter}
            onClick={() => setShowChapter((value) => !value)}
          >
            {showChapter ? 'Hide chapter' : `Read ${ref.book} ${ref.chapter}`}
          </button>
        ) : null}
        <button type="button" className="section-edit-btn" onClick={() => setRead(true)}>
          Mark as read
        </button>
      </div>

      {showChapter && ref ? (
        <div className="verse-chapter" aria-label={`${ref.book} ${ref.chapter}`}>
          {!chapter && !chapterFailed ? <p className="sheets-meta">Loading chapter…</p> : null}
          {chapterFailed ? (
            <p className="sheets-meta">
              Could not load the chapter.{' '}
              <a href={chapterUrl(ref)} target="_blank" rel="noopener noreferrer">
                Open it on BibleGateway
              </a>
            </p>
          ) : null}
          {chapter ? (
            <p>
              {chapter.map((item) => (
                <span
                  key={item.verse}
                  className={item.verse >= ref.first && item.verse <= ref.last ? 'verse-chapter-hit' : undefined}
                >
                  <sup>{item.verse}</sup> {item.text}{' '}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
