/** Where a dragged task would land. `gap` puts it at the top level before root `index`; `nest` makes it a subtask of `parentId`. */
export type DropTarget = { kind: 'gap'; index: number } | { kind: 'nest'; parentId: string }

/** Screen boxes for one top-level task: the whole block (with subtasks), and its own row. */
export type RootRowBox = {
  id: string
  top: number
  bottom: number
  rowTop: number
  rowBottom: number
}

/** The middle share of a root's own row: dropping here nests, the edges insert between rows. */
export const NEST_BAND = 0.3

export function resolveDropTarget(
  rows: RootRowBox[],
  y: number,
  draggingId: string,
  canNest: boolean,
): DropTarget {
  if (canNest) {
    for (const row of rows) {
      if (row.id === draggingId) continue
      const inset = (row.rowBottom - row.rowTop) * NEST_BAND
      if (y > row.rowTop + inset && y < row.rowBottom - inset) {
        return { kind: 'nest', parentId: row.id }
      }
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    if (y < (rows[index].top + rows[index].bottom) / 2) {
      return { kind: 'gap', index }
    }
  }
  return { kind: 'gap', index: rows.length }
}
