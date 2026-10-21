import { describe, expect, it } from 'vitest'
import { NEST_INDENT_PX, resolveDropTarget, type DropRowBox } from './dropTarget'

const anyNest = () => true
const noNest = () => false

// Pointer x values: a plain drop sits at the left edge, a nest is dragged right.
const PLAIN = 10
const INDENTED = NEST_INDENT_PX + 10

// Three top-level tasks, each 40px tall: rows 0-40, 40-80, 80-120.
const rows: DropRowBox[] = [
  { id: 'a', depth: 0, top: 0, bottom: 40, rowTop: 0, rowBottom: 40, rowLeft: 0, parentId: null },
  { id: 'b', depth: 0, top: 40, bottom: 80, rowTop: 40, rowBottom: 80, rowLeft: 0, parentId: null },
  { id: 'c', depth: 0, top: 80, bottom: 120, rowTop: 80, rowBottom: 120, rowLeft: 0, parentId: null },
]

// Task P with subtasks s1, s2, s3 (each 30px), then top-level Q.
const withSubtasks: DropRowBox[] = [
  { id: 'P', depth: 0, top: 0, bottom: 120, rowTop: 0, rowBottom: 30, rowLeft: 0, parentId: null },
  { id: 's1', depth: 1, top: 30, bottom: 60, rowTop: 30, rowBottom: 60, rowLeft: 24, parentId: 'P' },
  { id: 's2', depth: 1, top: 60, bottom: 90, rowTop: 60, rowBottom: 90, rowLeft: 24, parentId: 'P' },
  { id: 's3', depth: 1, top: 90, bottom: 120, rowTop: 90, rowBottom: 120, rowLeft: 24, parentId: 'P' },
  { id: 'Q', depth: 0, top: 120, bottom: 150, rowTop: 120, rowBottom: 150, rowLeft: 0, parentId: null },
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
    expect(resolveDropTarget(withSubtasks, INDENTED + 24, 75, 'x', anyNest)).toEqual({
      kind: 'nest',
      parentId: 's2',
    })
  })

  it('uses the whole top-level block for gaps, so subtasks push the next gap down', () => {
    // y=100 is below P's row midpoint but still inside P's block, so the gap sits before Q.
    expect(resolveDropTarget(withSubtasks, PLAIN, 100, 'x', noNest)).toEqual({ kind: 'gap', index: 1 })
  })

  it('reorders a subtask among its siblings', () => {
    // Dragging s1 (no indent) down past s2's midpoint lands after s2.
    expect(resolveDropTarget(withSubtasks, 30, 80, 's1', noNest)).toEqual({
      kind: 'sibling',
      parentId: 'P',
      index: 1,
    })
  })

  it('places a subtask at the top of its siblings', () => {
    expect(resolveDropTarget(withSubtasks, 30, 35, 's3', noNest)).toEqual({
      kind: 'sibling',
      parentId: 'P',
      index: 0,
    })
  })

  it('places a subtask at the bottom of its siblings', () => {
    expect(resolveDropTarget(withSubtasks, 30, 118, 's1', noNest)).toEqual({
      kind: 'sibling',
      parentId: 'P',
      index: 2,
    })
  })

  it('unnests a subtask when dropped outside its sibling block', () => {
    // y=125 is below the sibling block (ends at 120) and above Q's midpoint: a top-level gap after P.
    expect(resolveDropTarget(withSubtasks, 30, 125, 's1', noNest)).toEqual({ kind: 'gap', index: 1 })
  })
})
