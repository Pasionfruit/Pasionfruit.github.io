import { Fragment, type ReactNode } from 'react'
import { workoutLines, type WorkoutLine } from './workoutPlan'

function renderSegments(line: WorkoutLine) {
  return line.segments.map((segment, index) =>
    segment.bold ? <strong key={index}>{segment.text}</strong> : <Fragment key={index}>{segment.text}</Fragment>,
  )
}

/**
 * A stored workout, rendered: bold title, bullet list, or plain text. A
 * one-line workout ("Legs") stays a bare span so short cells look as before.
 */
export function WorkoutText({ value, empty = '—' }: { value: string | undefined; empty?: string }) {
  const lines = workoutLines(value)

  if (lines.length === 0) return <span>{empty}</span>
  if (lines.length === 1 && lines[0].kind === 'text') return <span>{renderSegments(lines[0])}</span>

  // Consecutive bullets share one <ul>; anything else is a line of its own.
  const blocks: ReactNode[] = []
  let items: ReactNode[] = []

  const flushItems = () => {
    if (items.length) blocks.push(<ul key={`list-${blocks.length}`}>{items}</ul>)
    items = []
  }

  lines.forEach((line, index) => {
    if (line.kind === 'item') {
      items.push(<li key={index}>{renderSegments(line)}</li>)
      return
    }
    flushItems()
    blocks.push(<span key={index}>{renderSegments(line)}</span>)
  })
  flushItems()

  return <div className="workout-text">{blocks}</div>
}
