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
}

/** The middle share of a task's own row: dropping here nests, the edges insert between top-level rows. */
export const NEST_BAND = 0.3

export function resolveDropTarget(
  rows: DropRowBox[],
  y: number,
  draggingId: string,
  canNestUnder: (targetId: string, targetDepth: number) => boolean,
): DropTarget {
  for (const row of rows) {
    if (row.id === draggingId || !canNestUnder(row.id, row.depth)) continue
    const inset = (row.rowBottom - row.rowTop) * NEST_BAND
    if (y > row.rowTop + inset && y < row.rowBottom - inset) {
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
