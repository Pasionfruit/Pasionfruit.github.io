import { describe, expect, it } from 'vitest'
import type { Chore } from '../../data/chores/client'
import { choreStatus, lastDoneLabel, sortChores, warningLabel } from './choreStatus'

const chore = (over: Partial<Chore>): Chore => ({
  id: 'c', name: 'Dishes', category: 'kitchen', intervalDays: 3, lastDone: '', ...over,
})

describe('choreStatus', () => {
  it('flags a never-done chore', () => {
    const s = choreStatus(chore({}), '2026-11-05')
    expect(s.state).toBe('never')
    expect(lastDoneLabel(s)).toBe('Never done')
  })

  it('is ok before the interval has passed', () => {
    const s = choreStatus(chore({ lastDone: '2026-11-04' }), '2026-11-05')
    expect(s.state).toBe('ok')
    expect(warningLabel(s)).toBe('')
    expect(lastDoneLabel(s)).toBe('Done yesterday')
  })

  it('is due today exactly at the interval', () => {
    expect(choreStatus(chore({ lastDone: '2026-11-02' }), '2026-11-05').state).toBe('due-today')
  })

  it('warns once past the interval', () => {
    const s = choreStatus(chore({ lastDone: '2026-10-30' }), '2026-11-05')
    expect(s.state).toBe('overdue')
    expect(warningLabel(s)).toBe('Overdue by 3 days')
    expect(lastDoneLabel(s)).toBe('Done 6 days ago')
  })

  it('counts days across a DST change', () => {
    expect(choreStatus(chore({ intervalDays: 1, lastDone: '2026-11-01' }), '2026-11-03').daysSince).toBe(2)
  })
})

describe('sortChores', () => {
  it('puts the most overdue first and fine chores last', () => {
    const list = [
      chore({ id: 'ok', name: 'a', lastDone: '2026-11-05' }),
      chore({ id: 'late', name: 'b', lastDone: '2026-10-20' }),
      chore({ id: 'never', name: 'c' }),
    ]
    expect(sortChores(list, '2026-11-05').map((c) => c.id)).toEqual(['late', 'never', 'ok'])
  })
})
