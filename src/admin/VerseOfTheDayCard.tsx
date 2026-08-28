import { useMemo } from 'react'
import { getVerseOfTheDay } from './journal/verses'

export function VerseOfTheDayCard({ title }: { title: string }) {
  // Recomputed per render is cheap, but memoising keeps the reference stable.
  const verse = useMemo(() => getVerseOfTheDay(), [])

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
    </article>
  )
}
