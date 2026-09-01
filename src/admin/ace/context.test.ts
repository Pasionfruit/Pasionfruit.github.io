import { describe, expect, it } from 'vitest'
import { hasAnyData, renderAceContext, type AceContext } from './context'
import type { TodoistTask } from '../../data/todoist/types'

function context(overrides: Partial<AceContext> = {}): AceContext {
  return {
    now: new Date('2026-08-31T09:00:00'),
    mail: [],
    events: [],
    tasksToday: [],
    tasksOverdue: [],
    completedYesterday: [],
    completedToday: [],
    slippedYesterday: [],
    tasksTomorrow: [],
    wellness: null,
    gaps: [],
    ...overrides,
  }
}

const TASK = {
  id: 't-1',
  content: 'Renew passport',
  priority: 1,
  due: { date: '2026-08-31' },
} as unknown as TodoistTask

describe('renderAceContext', () => {
  it('states plainly that there is no data when every source is empty', () => {
    const empty = context({ gaps: ['Gmail', 'Calendar'] })

    expect(hasAnyData(empty)).toBe(false)

    const text = renderAceContext(empty)
    expect(text).toContain('## No data for today')
    expect(text).toContain('Do not list, summarise, or invent any items.')
    // The unreachable sources are still named so the model knows why.
    expect(text).toContain('Gmail, Calendar')
    // No per-section "Nothing…" template for the model to fill in.
    expect(text).not.toContain('## Due today')
    expect(text).not.toContain("## Today's schedule")
  })

  it('renders the sections when there is something to report', () => {
    const withTask = context({ tasksToday: [TASK] })

    expect(hasAnyData(withTask)).toBe(true)

    const text = renderAceContext(withTask)
    expect(text).toContain('## Due today')
    expect(text).toContain('- Renew passport (due 2026-08-31)')
    expect(text).not.toContain('## No data for today')
  })
})
