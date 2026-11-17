import { describe, expect, it } from 'vitest'
import { cleanSpots, whereText } from './skin.js'

describe('cleanSpots', () => {
  it('keeps good spots and drops malformed, off-image and duplicate ones', () => {
    const spots = cleanSpots([
      { kind: 'acne', x: 0.2, y: 0.3 },
      { kind: 'acne', x: 0.201, y: 0.3 },
      { kind: 'scar', x: 1.2, y: 0.3 },
      { kind: 'wart', x: 0.5, y: 0.5 },
      { kind: 'scar', x: 0.6, y: 0.6 },
    ])
    expect(spots).toEqual([
      { kind: 'acne', x: 0.2, y: 0.3 },
      { kind: 'scar', x: 0.6, y: 0.6 },
    ])
  })
  it('copes with a missing list', () => {
    expect(cleanSpots(undefined)).toEqual([])
  })
})

describe('whereText', () => {
  it('names the angle', () => {
    expect(whereText('back')).toMatch(/back/)
    expect(whereText('left')).toMatch(/left side/)
  })
})
