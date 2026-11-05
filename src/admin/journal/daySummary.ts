import { CHORE_CATEGORY_LABELS, listChores, type Chore } from '../../data/chores/client'
import { getGarminHealth, getTrainingRecords } from '../../data/sheets/repositories'
import type { GarminHealthRecord, TrainingRecord } from '../../data/sheets/types'
import { getCompletedTasks } from '../../data/todoist/repositories'
import type { TodoistTask } from '../../data/todoist/types'

/** The journal's "Summarize day" is deliberately short: never more than this many bullets. */
export const MAX_BULLETS = 3

/** Names shown in a bullet before the rest are folded into "+N more". */
const NAMES_SHOWN = 3

export type DaySources = {
  training: TrainingRecord[]
  activities: GarminHealthRecord[]
  chores: Chore[]
  tasks: TodoistTask[]
}

function sameDay(value: string | undefined, date: string) {
  return Boolean(value) && String(value).slice(0, 10) === date
}

function listNames(names: string[]) {
  const shown = names.slice(0, NAMES_SHOWN).join(', ')
  return names.length > NAMES_SHOWN ? `${shown} +${names.length - NAMES_SHOWN} more` : shown
}

/** "running" -> "Running", "strength_training" -> "Strength training". */
function activityName(record: GarminHealthRecord) {
  const raw = (record.activity_type || record.title || 'Workout').replace(/_/g, ' ').trim().toLowerCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function activityLine(record: GarminHealthRecord) {
  const miles = Number.parseFloat(record.distance_mi)
  const minutes = Number.parseFloat(record.duration_min)
  const parts = [activityName(record)]
  if (Number.isFinite(miles) && miles > 0) parts.push(`${Math.round(miles * 10) / 10} mi`)
  if (Number.isFinite(minutes) && minutes > 0) parts.push(`${Math.round(minutes)} min`)
  return parts.join(' ')
}

function workoutBullet(date: string, { training, activities }: DaySources) {
  const done: string[] = []
  for (const row of training.filter((r) => sameDay(r.date, date))) {
    if (row.completed_morning && row.morning_workout) done.push(row.morning_workout)
    if (row.completed_evening && row.evening_workout) done.push(row.evening_workout)
  }
  const logged = activities.filter((a) => sameDay(a.date, date)).map(activityLine)

  const pieces: string[] = []
  if (done.length) pieces.push(`completed ${listNames(done)}`)
  if (logged.length) pieces.push(`Garmin logged ${listNames(logged)}`)
  return pieces.length ? `Workout: ${pieces.join('; ')}.` : null
}

function choresBullet(date: string, { chores }: DaySources) {
  const done = chores.filter((c) => c.lastDone === date)
  if (!done.length) return null

  const byCategory = new Map<string, number>()
  for (const chore of done) {
    const label = CHORE_CATEGORY_LABELS[chore.category].toLowerCase()
    byCategory.set(label, (byCategory.get(label) ?? 0) + 1)
  }
  const breakdown = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} ${count}`)
    .join(', ')
  return `Chores: ${done.length} done (${breakdown}).`
}

function tasksBullet({ tasks }: DaySources) {
  if (!tasks.length) return null
  return `Tasks: finished ${tasks.length} — ${listNames(tasks.map((t) => t.content))}.`
}

/** High-level bullets for one day, workout first. Nothing logged means no bullets, never a "none" line. */
export function buildDaySummary(date: string, sources: DaySources): string[] {
  return [workoutBullet(date, sources), choresBullet(date, sources), tasksBullet(sources)]
    .filter((line): line is string => line !== null)
    .slice(0, MAX_BULLETS)
    .map((line) => `- ${line}`)
}

export type DaySummaryResult = {
  bullets: string[]
  /** Sources that could not be read, by name, so the editor can say what is missing. */
  unavailable: string[]
}

/**
 * Pull the day from each dashboard. One source failing (Todoist not configured,
 * a sheet that will not load) only drops its own bullet; the rest still count.
 */
export async function loadDaySummary(date: string, idToken: string): Promise<DaySummaryResult> {
  const [training, activities, chores, tasks] = await Promise.allSettled([
    getTrainingRecords(),
    getGarminHealth(),
    listChores(idToken),
    getCompletedTasks(date, date),
  ])

  const unavailable: string[] = []
  const pick = <T,>(result: PromiseSettledResult<T[]>, name: string): T[] => {
    if (result.status === 'fulfilled') return result.value
    unavailable.push(name)
    return []
  }

  const sources: DaySources = {
    training: pick(training, 'workouts'),
    activities: pick(activities, 'Garmin'),
    chores: pick(chores, 'chores'),
    tasks: pick(tasks, 'tasks'),
  }

  return { bullets: buildDaySummary(date, sources), unavailable }
}
