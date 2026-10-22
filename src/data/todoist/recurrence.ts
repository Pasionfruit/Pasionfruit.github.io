export const RECURRENCE_UNITS = ['day', 'week', 'month', 'year'] as const

export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number]

/** A task repeats every `every` `unit`s, e.g. every 2 weeks. */
export type Recurrence = {
  every: number
  unit: RecurrenceUnit
}

/** What a task repeats by when it is first set to repeat. */
export const DEFAULT_RECURRENCE: Recurrence = { every: 1, unit: 'week' }

/** The Todoist due string for a repeat, e.g. "every 2 weeks" or "every day". */
export function recurrenceToDueString({ every, unit }: Recurrence): string {
  return every === 1 ? `every ${unit}` : `every ${every} ${unit}s`
}

/**
 * Reads a repeat back out of a Todoist due string. Returns null for patterns this
 * app does not edit (such as "every other week"), so the caller can fall back.
 */
export function parseRecurrence(dueString: string | undefined): Recurrence | null {
  const match = /^every (?:(\d+) )?(day|week|month|year)s?$/i.exec(dueString?.trim() ?? '')
  if (!match) return null
  return { every: match[1] ? Number(match[1]) : 1, unit: match[2].toLowerCase() as RecurrenceUnit }
}

/** The repeat fields as a form holds them. `every` is text so a cleared field can be typed over. */
export type RepeatDraft = {
  repeats: boolean
  every: string
  unit: RecurrenceUnit
}

/** The form's starting repeat for a task: its saved repeat, or the default when it repeats in a way the form cannot edit. */
export function repeatDraftFor(dueString: string | undefined, isRecurring: boolean): RepeatDraft {
  const saved = parseRecurrence(dueString) ?? DEFAULT_RECURRENCE
  return { repeats: isRecurring, every: String(saved.every), unit: saved.unit }
}

/** The repeat to save from a form. A repeat needs a date to start from, so without one there is none. */
export function recurrenceFromDraft(draft: RepeatDraft, hasDate: boolean): Recurrence | null {
  if (!draft.repeats || !hasDate) return null
  return { every: Math.max(1, Number.parseInt(draft.every, 10) || 1), unit: draft.unit }
}
