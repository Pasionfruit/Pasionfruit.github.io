// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applySavedOrder, arrayMove, getSavedOrder, saveOrder } from './taskOrder'

afterEach(() => {
  localStorage.clear()
})

describe('arrayMove', () => {
  it('moves an item to a new index', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(arrayMove(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('is a no-op for out-of-range or equal indices', () => {
    expect(arrayMove(['a', 'b'], 0, 0)).toEqual(['a', 'b'])
    expect(arrayMove(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(arrayMove(['a', 'b'], -1, 1)).toEqual(['a', 'b'])
  })
})

describe('saved order persistence', () => {
  it('round-trips ids through localStorage per key', () => {
    saveOrder('today', ['3', '1', '2'])
    expect(getSavedOrder('today')).toEqual(['3', '1', '2'])
    expect(getSavedOrder('tomorrow')).toEqual([])
  })

  it('returns an empty array when nothing is stored or JSON is corrupt', () => {
    expect(getSavedOrder('missing')).toEqual([])
    localStorage.setItem('todoist-order:broken', '{not json')
    expect(getSavedOrder('broken')).toEqual([])
  })
})

describe('applySavedOrder', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('returns items untouched when no order is saved', () => {
    expect(applySavedOrder(items, 'none')).toBe(items)
  })

  it('reorders by the saved sequence', () => {
    saveOrder('k', ['c', 'a', 'b'])
    expect(applySavedOrder(items, 'k').map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('drops stale ids and appends new items after saved ones', () => {
    // 'z' was completed/removed; 'c' is new and never got a saved slot.
    saveOrder('k', ['z', 'b', 'a'])
    expect(applySavedOrder(items, 'k').map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })
})
