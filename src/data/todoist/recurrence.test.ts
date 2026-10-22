import { describe, expect, it } from 'vitest'
import { parseRecurrence, recurrenceToDueString } from './recurrence'

describe('recurrenceToDueString', () => {
  it('uses the singular for one', () => {
    expect(recurrenceToDueString({ every: 1, unit: 'day' })).toBe('every day')
  })

  it('pluralises the unit for more than one', () => {
    expect(recurrenceToDueString({ every: 2, unit: 'week' })).toBe('every 2 weeks')
  })
})

describe('parseRecurrence', () => {
  it('reads back what recurrenceToDueString writes', () => {
    expect(parseRecurrence(recurrenceToDueString({ every: 3, unit: 'month' }))).toEqual({ every: 3, unit: 'month' })
    expect(parseRecurrence('every day')).toEqual({ every: 1, unit: 'day' })
  })

  it('returns null for patterns it cannot edit', () => {
    expect(parseRecurrence('every other week')).toBeNull()
    expect(parseRecurrence(undefined)).toBeNull()
  })
})
