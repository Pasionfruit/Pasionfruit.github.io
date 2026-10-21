import { describe, expect, it } from 'vitest'
import { resolveDropTarget, type RootRowBox } from './dropTarget'

// Three top-level tasks, each 40px tall, with no subtasks: rows 0-40, 40-80, 80-120.
const rows: RootRowBox[] = [
  { id: 'a', top: 0, bottom: 40, rowTop: 0, rowBottom: 40 },
  { id: 'b', top: 40, bottom: 80, rowTop: 40, rowBottom: 80 },
  { id: 'c', top: 80, bottom: 120, rowTop: 80, rowBottom: 120 },
]

describe('resolveDropTarget', () => {
  it('nests into the middle band of a top-level row', () => {
    expect(resolveDropTarget(rows, 60, 'x', true)).toEqual({ kind: 'nest', parentId: 'b' })
  })

  it('places between rows near the edges', () => {
    expect(resolveDropTarget(rows, 42, 'x', true)).toEqual({ kind: 'gap', index: 1 })
    expect(resolveDropTarget(rows, 78, 'x', true)).toEqual({ kind: 'gap', index: 2 })
  })

  it('returns a gap at the end when below every row', () => {
    expect(resolveDropTarget(rows, 500, 'x', true)).toEqual({ kind: 'gap', index: 3 })
  })

  it('never nests into the dragged task itself', () => {
    expect(resolveDropTarget(rows, 60, 'b', true)).toEqual({ kind: 'gap', index: 2 })
  })

  it('reorders only when the dragged task cannot take children', () => {
    expect(resolveDropTarget(rows, 60, 'x', false)).toEqual({ kind: 'gap', index: 2 })
  })

  it('uses the whole block for gaps, so subtasks push the next gap down', () => {
    const withSubtasks: RootRowBox[] = [
      { id: 'a', top: 0, bottom: 120, rowTop: 0, rowBottom: 40 },
      { id: 'b', top: 120, bottom: 160, rowTop: 120, rowBottom: 160 },
    ]
    // y=100 sits in a's subtask block, below a's row midpoint (60), so the gap is after a.
    expect(resolveDropTarget(withSubtasks, 100, 'x', false)).toEqual({ kind: 'gap', index: 1 })
  })
})
