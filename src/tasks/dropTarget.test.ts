import { describe, expect, it } from 'vitest'
import { resolveDropTarget, type DropRowBox } from './dropTarget'

const anyNest = () => true
const noNest = () => false

// Three top-level tasks, each 40px tall: rows 0-40, 40-80, 80-120.
const rows: DropRowBox[] = [
  { id: 'a', depth: 0, top: 0, bottom: 40, rowTop: 0, rowBottom: 40 },
  { id: 'b', depth: 0, top: 40, bottom: 80, rowTop: 40, rowBottom: 80 },
  { id: 'c', depth: 0, top: 80, bottom: 120, rowTop: 80, rowBottom: 120 },
]

describe('resolveDropTarget', () => {
  it('nests into the middle band of a task row', () => {
    expect(resolveDropTarget(rows, 60, 'x', anyNest)).toEqual({ kind: 'nest', parentId: 'b' })
  })

  it('places between top-level rows near the edges', () => {
    expect(resolveDropTarget(rows, 42, 'x', anyNest)).toEqual({ kind: 'gap', index: 1 })
    expect(resolveDropTarget(rows, 78, 'x', anyNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('returns a gap at the end when below every row', () => {
    expect(resolveDropTarget(rows, 500, 'x', anyNest)).toEqual({ kind: 'gap', index: 3 })
  })

  it('skips targets that refuse the drop, falling back to a gap', () => {
    expect(resolveDropTarget(rows, 60, 'x', noNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('never nests into the dragged task itself', () => {
    expect(resolveDropTarget(rows, 60, 'b', anyNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('nests into a subtask row, which is not a top-level gap', () => {
    const nested: DropRowBox[] = [
      { id: 'a', depth: 0, top: 0, bottom: 80, rowTop: 0, rowBottom: 40 },
      { id: 'a1', depth: 1, top: 40, bottom: 80, rowTop: 40, rowBottom: 80 },
    ]
    expect(resolveDropTarget(nested, 60, 'x', anyNest)).toEqual({ kind: 'nest', parentId: 'a1' })
  })

  it('uses the whole top-level block for gaps, so subtasks push the next gap down', () => {
    const withSubtasks: DropRowBox[] = [
      { id: 'a', depth: 0, top: 0, bottom: 120, rowTop: 0, rowBottom: 40 },
      { id: 'a1', depth: 1, top: 40, bottom: 80, rowTop: 40, rowBottom: 80 },
      { id: 'b', depth: 0, top: 120, bottom: 160, rowTop: 120, rowBottom: 160 },
    ]
    // y=100 is below a's row midpoint (20) and above b, so the gap is after a's block.
    expect(resolveDropTarget(withSubtasks, 100, 'x', noNest)).toEqual({ kind: 'gap', index: 1 })
  })
})
