import { useSyncExternalStore } from 'react'

/**
 * The meal plan: each date holds any number of named entries, and an entry
 * lists its dishes. "Thanksgiving" with turkey, ham and mac and cheese is one
 * entry; a plain Tuesday might be "Dinner" with one dish. Keyed by local
 * 'YYYY-MM-DD'.
 *
 * It lives in this browser's localStorage for now, behind a subscribe/snapshot
 * pair so the calendar's day panel and the plan card stay in step. Moving it to
 * the db Worker later only means swapping the read and write below.
 */
export type MealEntry = { id: string; title: string; dishes: string[] }
export type MealPlan = Record<string, MealEntry[]>

const STORAGE_KEY = 'admin-meal-plan'
const EMPTY: MealPlan = {}

let cached: { raw: string | null; plan: MealPlan } = { raw: null, plan: EMPTY }
const listeners = new Set<() => void>()

const OLD_SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

/** Reads a stored plan, including the earlier fixed-slot shape ({ dinner: 'Salmon' }). */
function normalize(parsed: unknown): MealPlan {
  const plan: MealPlan = {}
  if (!parsed || typeof parsed !== 'object') return plan

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      plan[key] = value.filter((entry): entry is MealEntry => Boolean(entry && typeof entry === 'object' && 'id' in entry))
    } else if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([slot, text]) => slot in OLD_SLOT_LABELS && typeof text === 'string' && text)
        .map(([slot, text]) => ({ id: `${key}-${slot}`, title: OLD_SLOT_LABELS[slot], dishes: [text as string] }))
      if (entries.length > 0) plan[key] = entries
    }
  }

  return plan
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function getSnapshot(): MealPlan {
  const raw = readRaw()
  if (raw === cached.raw) return cached.plan

  let plan = EMPTY
  if (raw) {
    try {
      plan = normalize(JSON.parse(raw))
    } catch {
      plan = EMPTY
    }
  }

  cached = { raw, plan }
  return plan
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function commit(next: MealPlan) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the plan simply is not kept past this visit.
  }
  listeners.forEach((listener) => listener())
}

function withDay(key: string, change: (entries: MealEntry[]) => MealEntry[]) {
  const plan = getSnapshot()
  const entries = change(plan[key] ?? [])
  const next: MealPlan = { ...plan }

  if (entries.length > 0) next[key] = entries
  else delete next[key]

  commit(next)
}

/** "turkey, ham,  mac and cheese" becomes three dishes. */
export function parseDishes(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((dish) => dish.trim())
    .filter(Boolean)
}

export function addMeal(key: string) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  withDay(key, (entries) => [...entries, { id, title: '', dishes: [] }])
}

export function updateMeal(key: string, id: string, update: { title: string; dishes: string }) {
  withDay(key, (entries) =>
    entries.map((entry) =>
      entry.id === id ? { ...entry, title: update.title.trim(), dishes: parseDishes(update.dishes) } : entry,
    ),
  )
}

export function removeMeal(key: string, id: string) {
  withDay(key, (entries) => entries.filter((entry) => entry.id !== id))
}

/** An entry with neither a name nor a dish is just a blank row being filled in. */
export function isFilled(entry: MealEntry): boolean {
  return Boolean(entry.title || entry.dishes.length > 0)
}

export function useMealPlan(): MealPlan {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
}

/** The Sunday that starts the week containing `date`, matching the calendar grid. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - start.getDay())
  return start
}
