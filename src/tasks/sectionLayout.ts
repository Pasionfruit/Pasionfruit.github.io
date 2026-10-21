import type { TodoistSection } from '../data/todoist/types'

/** One saved row per Todoist section: where it sits in its project, and whether it is hidden. */
export type SectionLayoutRow = { project_id: string; position: number; hidden: boolean }

/** Keyed by Todoist section id. A section with no row keeps Todoist's own order. */
export type SectionLayout = Record<string, SectionLayoutRow>

// Unsaved sections sort after every saved one, in Todoist's order among themselves.
const UNSAVED_BASE = 1_000_000

function effectivePosition(section: TodoistSection, layout: SectionLayout) {
  return layout[section.id]?.position ?? UNSAVED_BASE + (section.section_order ?? 0)
}

export function orderSections(sections: TodoistSection[], layout: SectionLayout): TodoistSection[] {
  return [...sections].sort((a, b) => effectivePosition(a, layout) - effectivePosition(b, layout))
}

export function isSectionHidden(sectionId: string, layout: SectionLayout) {
  return layout[sectionId]?.hidden ?? false
}

/**
 * Rows for a whole project in the given order. Every section gets an explicit
 * position, so one move or hide leaves the project's order unambiguous.
 */
export function rowsForOrder(
  projectId: string,
  ordered: TodoistSection[],
  layout: SectionLayout,
): SectionLayout {
  const rows: SectionLayout = {}
  ordered.forEach((section, index) => {
    rows[section.id] = {
      project_id: projectId,
      position: index,
      hidden: isSectionHidden(section.id, layout),
    }
  })
  return rows
}
