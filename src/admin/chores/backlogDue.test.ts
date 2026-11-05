import { describe, expect, it } from 'vitest'
import { dayOptions, defaultDue, dueState, timeOptions } from './backlogDue'

describe('defaultDue', () => {
  it('is an hour from now, rounded up to the half hour', () => {
    expect(defaultDue(new Date(2026, 10, 5, 11, 25))).toEqual({ date: '2026-11-05', time: '12:30' })
    expect(defaultDue(new Date(2026, 10, 5, 11, 40))).toEqual({ date: '2026-11-05', time: '13:00' })
    expect(defaultDue(new Date(2026, 10, 5, 12, 0))).toEqual({ date: '2026-11-05', time: '13:00' })
  })

  it('rolls over to tomorrow late at night', () => {
    expect(defaultDue(new Date(2026, 10, 5, 23, 15))).toEqual({ date: '2026-11-06', time: '00:30' })
  })
})

describe('options', () => {
  it('labels days plainly and starts today', () => {
    const days = dayOptions(new Date(2026, 10, 5, 12))
    expect(days[0]).toEqual({ value: '2026-11-05', label: 'Today' })
    expect(days[1]).toEqual({ value: '2026-11-06', label: 'Tomorrow' })
    expect(days).toHaveLength(30)
  })

  it('labels times on a 12-hour clock, with All day first', () => {
    const times = timeOptions()
    expect(times[0]).toEqual({ value: '', label: 'All day' })
    expect(times.find((t) => t.value === '00:00')?.label).toBe('12:00 AM')
    expect(times.find((t) => t.value === '13:30')?.label).toBe('1:30 PM')
    expect(times).toHaveLength(49)
  })
})

describe('dueState', () => {
  it('treats a date-only due as running to the end of that day', () => {
    expect(dueState('2026-11-05', new Date(2026, 10, 5, 22))).toBe('today')
    expect(dueState('2026-11-05', new Date(2026, 10, 6, 1))).toBe('overdue')
  })
})
