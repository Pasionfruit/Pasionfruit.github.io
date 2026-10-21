import { describe, expect, it } from 'vitest'
import { NEST_INDENT_PX, resolveDropTarget, type DropRowBox } from './dropTarget'

const anyNest = () => true
const noNest = () => false

// Pointer x values: a plain drop sits at the left edge, a nest is dragged right.
const PLAIN = 10
const INDENTED = NEST_INDENT_PX + 10

// Three top-level tasks, each 40px tall: rows 0-40, 40-80, 80-120.
const rows: DropRowBox[] = [
  { id: 'a', depth: 0, top: 0, bottom: 40, rowTop: 0, rowBottom: 40, rowLeft: 0 },
  { id: 'b', depth: 0, top: 40, bottom: 80, rowTop: 40, rowBottom: 80, rowLeft: 0 },
  { id: 'c', depth: 0, top: 80, bottom: 120, rowTop: 80, rowBottom: 120, rowLeft: 0 },
]

describe('resolveDropTarget', () => {
  it('nests into a row when dragged right into its middle band', () => {
    expect(resolveDropTarget(rows, INDENTED, 60, 'x', anyNest)).toEqual({ kind: 'nest', parentId: 'b' })
  })

  it('reorders, not nests, when dropped over a row without indenting', () => {
    expect(resolveDropTarget(rows, PLAIN, 60, 'x', anyNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('places between top-level rows near the edges', () => {
    expect(resolveDropTarget(rows, PLAIN, 42, 'x', anyNest)).toEqual({ kind: 'gap', index: 1 })
    expect(resolveDropTarget(rows, PLAIN, 78, 'x', anyNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('returns a gap at the end when below every row', () => {
    expect(resolveDropTarget(rows, PLAIN, 500, 'x', anyNest)).toEqual({ kind: 'gap', index: 3 })
  })

  it('falls back to a gap when the target refuses the drop', () => {
    expect(resolveDropTarget(rows, INDENTED, 60, 'x', noNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('never nests into the dragged task itself', () => {
    expect(resolveDropTarget(rows, INDENTED, 60, 'b', anyNest)).toEqual({ kind: 'gap', index: 2 })
  })

  it('nests into a subtask row, which is not a top-level gap', () => {
    const nested: DropRowBox[] = [
      { id: 'a', depth: 0, top: 0, bottom: 80, rowTop: 0, rowBottom: 40, rowLeft: 0 },
      { id: 'a1', depth: 1, top: 40, bottom: 80, rowTop: 40, rowBottom: 80, rowLeft: 24 },
    ]
    expect(resolveDropTarget(nested, INDENTED + 24, 60, 'x', anyNest)).toEqual({ kind: 'nest', parentId: 'a1' })
  })

  it('uses the whole top-level block for gaps, so subtasks push the next gap down', () => {
    const withSubtasks: DropRowBox[] = [
      { id: 'a', depth: 0, top: 0, bottom: 120, rowTop: 0, rowBottom: 40, rowLeft: 0 },
      { id: 'a1', depth: 1, top: 40, bottom: 80, rowTop: 40, rowBottom: 80, rowLeft: 24 },
      { id: 'b', depth: 0, top: 120, bottom: 160, rowTop: 120, rowBottom: 160, rowLeft: 0 },
    ]
    // a's block midpoint is 60, so y=100 lands after the whole of a.
    expect(resolveDropTarget(withSubtasks, PLAIN, 100, 'x', noNest)).toEqual({ kind: 'gap', index: 1 })
  })
})
