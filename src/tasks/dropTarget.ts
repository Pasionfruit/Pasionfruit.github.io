/** Where a dragged task would land. `gap` puts it at the top level before top-level task `index`; `nest` makes it a subtask of `parentId`. */
export type DropTarget = { kind: 'gap'; index: number } | { kind: 'nest'; parentId: string }

/** Screen boxes for one visible task: the whole block (with its subtasks), and its own row. */
export type DropRowBox = {
  id: string
  /** 0 for a top-level task. */
  depth: number
  top: number
  bottom: number
  rowTop: number
  rowBottom: number
  /** Left edge of the task's own row. */
  rowLeft: number
}

/** The middle share of a task's own row, vertically, where a nest can happen. */
export const NEST_BAND = 0.3

/**
 * How far right of a row's left edge the pointer must be to nest under it. Without
 * this, a plain reorder dropped over a task's middle would nest instead.
 */
export const NEST_INDENT_PX = 48

export function resolveDropTarget(
  rows: DropRowBox[],
  x: number,
  y: number,
  draggingId: string,
  canNestUnder: (targetId: string, targetDepth: number) => boolean,
): DropTarget {
  for (const row of rows) {
    if (row.id === draggingId || !canNestUnder(row.id, row.depth)) continue
    const inset = (row.rowBottom - row.rowTop) * NEST_BAND
    const indented = x >= row.rowLeft + NEST_INDENT_PX
    if (indented && y > row.rowTop + inset && y < row.rowBottom - inset) {
      return { kind: 'nest', parentId: row.id }
    }
  }

  const topLevel = rows.filter((row) => row.depth === 0)
  for (let index = 0; index < topLevel.length; index += 1) {
    if (y < (topLevel[index].top + topLevel[index].bottom) / 2) {
      return { kind: 'gap', index }
    }
  }
  return { kind: 'gap', index: topLevel.length }
}
