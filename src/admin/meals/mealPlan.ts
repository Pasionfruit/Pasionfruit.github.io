import { useSyncExternalStore } from 'react'

/**
 * The weekly meal plan: what is eaten at each meal on each day, keyed by local
 * 'YYYY-MM-DD'. It lives in this browser's localStorage for now, behind a
 * subscribe/snapshot pair so the calendar's day panel and the plan card stay in
 * step. Moving it to the db Worker later only means swapping the read and write
 * below; nothing that uses the hook changes.
 */
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export type DayMeals = Partial<Record<MealSlot, string>>
export type MealPlan = Record<string, DayMeals>

const STORAGE_KEY = 'admin-meal-plan'
const EMPTY: MealPlan = {}

let cached: { raw: string | null; plan: MealPlan } = { raw: null, plan: EMPTY }
const listeners = new Set<() => void>()

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
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') plan = parsed as MealPlan
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

/** Sets one meal; an empty string clears it, and a day with nothing left is dropped. */
export function setMeal(key: string, slot: MealSlot, value: string) {
  const plan = getSnapshot()
  const day: DayMeals = { ...plan[key] }
  const text = value.trim()

  if (text) day[slot] = text
  else delete day[slot]

  const next: MealPlan = { ...plan }
  if (Object.keys(day).length > 0) next[key] = day
  else delete next[key]

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the plan simply is not kept past this visit.
  }
  listeners.forEach((listener) => listener())
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
