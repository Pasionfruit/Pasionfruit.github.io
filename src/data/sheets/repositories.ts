import { fetchSheetTable, postSheetsAction, type SheetsWriteResponse } from './client'
import type {
  AppleHealthRecord,
  BackpackRecord,
  BucketListRecord,
  CountryRecord,
  CouponRecord,
  CurrentStudyRecord,
  EventRecord,
  FinanceTransactionRecord,
  GarminHealthRecord,
  GarminWellnessRecord,
  GroceryListRecord,
  JournalEntryRecord,
  MealPlanRecord,
  PersonalTrainingRecord,
  PollRecord,
  RecipeComponentRecord,
  RecipeRecord,
  RecipeStepRecord,
  RingconnHealthRecord,
  StoreDealRecord,
  TrainingRecord,
  TripRecord,
  WorkItemRecord,
} from './types'

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'y'
  }

  return false
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    // Strip currency symbols, thousands separators, and whitespace that the
    // Sheets API includes when returning FORMATTED_VALUE (e.g. "$1,234.56")
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

// ── Cloudflare D1 data API (the migration target off Google Sheets) ─────────
// Tables move here one at a time; each function keeps its exact signature so
// call sites never change. Reads are public, writes carry the Google ID token.

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

async function dbRead<T>(table: string, idToken?: string): Promise<T[]> {
  const response = await fetch(`${DB_BASE_URL}/db/${table}`, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
  })
  if (!response.ok) {
    throw new Error(`Database read failed: ${response.status}`)
  }
  const data = (await response.json()) as { rows?: T[] }
  return data.rows ?? []
}

/** Local-time date-key comparison for date-matched upserts. */
function sameDateKey(a?: string, b?: string) {
  if (!a || !b) return false
  const first = new Date(a)
  const second = new Date(b)
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

async function dbWrite(
  table: string,
  method: 'POST' | 'PUT' | 'DELETE',
  idToken: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${DB_BASE_URL}/db/${table}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(data?.error || `Database write failed: ${response.status}`)
  }
}

export async function getPolls(): Promise<PollRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('polls')

  return rows
    .map((row) => ({
      poll_id: String(row.poll_id ?? ''),
      created_date: row.created_date ? String(row.created_date) : undefined,
      question: String(row.question ?? ''),
      option_a: String(row.option_a ?? ''),
      option_b: String(row.option_b ?? ''),
      option_a_votes: parseNumber(row.option_a_votes),
      option_b_votes: parseNumber(row.option_b_votes),
      total_votes: parseNumber(row.total_votes),
      winning_option: row.winning_option ? String(row.winning_option) : undefined,
    }))
    .filter((row) => row.poll_id && row.question)
}

export async function getBucketList(): Promise<BucketListRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('bucket_list')

  return rows
    .map((row) => ({
      bucket_id: String(row.bucket_id ?? ''),
      item: String(row.item ?? ''),
      completed_date: row.completed_date ? String(row.completed_date) : undefined,
      completed: parseBoolean(row.completed),
    }))
    .filter((row) => row.bucket_id && row.item)
}

export async function getCountries(): Promise<CountryRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('countries')

  return rows
    .map((row) => ({
      country_id: String(row.country_id ?? ''),
      country_state_name: String(row.country_state_name ?? ''),
      visited_date: row.visited_date ? String(row.visited_date) : undefined,
      visited: parseBoolean(row.visited),
    }))
    .filter((row) => row.country_id && row.country_state_name)
}

export async function getCurrentStudy(): Promise<CurrentStudyRecord[]> {
  const rows = await dbRead<Record<string, unknown>>('current_study')

  return rows
    .map((row) => ({
      study_id: String(row.study_id ?? ''),
      related_exam: String(row.related_exam ?? ''),
      topic: String(row.topic ?? ''),
      date: row.date ? String(row.date) : undefined,
      completed: parseBoolean(row.completed),
    }))
    .filter((row) => row.study_id && row.topic)
}

export async function getTrainingRecords(): Promise<TrainingRecord[]> {
  const rows = await dbRead<Record<string, unknown>>('training_records')

  return rows
    .map((row) => ({
      training_id: String(row.training_id ?? ''),
      date: row.date ? String(row.date) : undefined,
      morning_workout: row.morning_workout ? String(row.morning_workout) : undefined,
      evening_workout: row.evening_workout ? String(row.evening_workout) : undefined,
      completed_morning: parseBoolean(row.completed_morning),
      completed_evening: parseBoolean(row.completed_evening),
    }))
    .filter((row) => row.training_id)
}

export async function getEvents(): Promise<EventRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('events')

  return rows
    .map((row) => ({
      event_id: String(row.event_id ?? ''),
      event_date: row.event_date ? String(row.event_date) : undefined,
      event_name: String(row.event_name ?? ''),
      type: row.type ? String(row.type) : undefined,
      measurement: row.measurement ? String(row.measurement) : undefined,
      location: row.location ? String(row.location) : undefined,
      link: row.link ? String(row.link) : undefined,
      price: parseNumber(row.price),
      active: parseBoolean(row.active),
    }))
    .filter((row) => row.event_id && row.event_name)
}

export async function getPersonalTraining(): Promise<PersonalTrainingRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('personal_training')

  return rows
    .map((row) => ({
      type: String(row.type ?? '').toLowerCase().trim(),
      category: String(row.category ?? '').trim(),
      name: String(row.name ?? '').trim(),
      value: String(row.value ?? '').trim(),
    }))
    .filter((row) => row.type && row.name)
}

export async function getGarminHealth(): Promise<GarminHealthRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('garmin_health')

  return rows
    .map((row) => ({
      date:          String(row.date ?? '').trim(),
      activity_type: String(row.activity_type ?? '').trim(),
      title:         String(row.title ?? '').trim(),
      distance_mi:   String(row.distance_mi ?? '').trim(),
      duration_min:  String(row.duration_min ?? '').trim(),
      avg_hr:        String(row.avg_hr ?? '').trim(),
      max_hr:        String(row.max_hr ?? '').trim(),
      calories:      String(row.calories ?? '').trim(),
      tss:           String(row.tss ?? '').trim(),
    }))
    .filter((row) => row.date)
}

/**
 * Whether a wellness row carries any actual measurement.
 *
 * The ingest script writes one row per day through today on every run, so a day
 * Garmin has no data for still lands in the sheet as a date with every metric
 * blank. Left in, the newest placeholder defines "latest" everywhere — the
 * card's date pill, the sleep card's default day, Ace's stale-watch check — and
 * the dashboard ends up labelling three-day-old numbers with today's date.
 */
export function hasWellnessMetrics(row: GarminWellnessRecord) {
  return Object.entries(row).some(([key, value]) => key !== 'date' && String(value).trim() !== '')
}

export async function getGarminWellness(): Promise<GarminWellnessRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('garmin_wellness')

  const text = (value: unknown) => String(value ?? '').trim()

  return rows
    .map((row) => ({
      date:               text(row.date).slice(0, 10),
      sleep_score:        text(row.sleep_score),
      sleep_duration_h:   text(row.sleep_duration_h),
      deep_sleep_h:       text(row.deep_sleep_h),
      rem_sleep_h:        text(row.rem_sleep_h),
      light_sleep_h:      text(row.light_sleep_h),
      awake_h:            text(row.awake_h),
      resting_hr:         text(row.resting_hr),
      hrv:                text(row.hrv),
      body_battery_high:  text(row.body_battery_high),
      stress_avg:         text(row.stress_avg),
      respiration_avg:    text(row.respiration_avg),
      steps:              text(row.steps),
      intensity_minutes:  text(row.intensity_minutes),
      calories:           text(row.calories),
      vo2_max:            text(row.vo2_max),
      training_readiness: text(row.training_readiness),
      training_status:    text(row.training_status),
      endurance_score:    text(row.endurance_score),
    }))
    .filter((row) => row.date && hasWellnessMetrics(row))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function getRingconnHealth(): Promise<RingconnHealthRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('ringconn_health')

  return rows
    .map((row) => ({
      date:             String(row.date ?? '').trim(),
      sleep_score:      String(row.sleep_score ?? '').trim(),
      sleep_duration_h: String(row.sleep_duration_h ?? '').trim(),
      deep_sleep_h:     String(row.deep_sleep_h ?? '').trim(),
      rem_sleep_h:      String(row.rem_sleep_h ?? '').trim(),
      light_sleep_h:    String(row.light_sleep_h ?? '').trim(),
      resting_hr:       String(row.resting_hr ?? '').trim(),
      hrv:              String(row.hrv ?? '').trim(),
      skin_temp_c:      String(row.skin_temp_c ?? '').trim(),
      steps:            String(row.steps ?? '').trim(),
      calories:         String(row.calories ?? '').trim(),
    }))
    .filter((row) => row.date)
}

export async function getAppleHealth(): Promise<AppleHealthRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('apple_health')

  return rows
    .map((row) => ({
      date:            String(row.date ?? '').trim(),
      steps:           String(row.steps ?? '').trim(),
      resting_hr:      String(row.resting_hr ?? '').trim(),
      hrv_sdnn:        String(row.hrv_sdnn ?? '').trim(),
      active_calories: String(row.active_calories ?? '').trim(),
      basal_calories:  String(row.basal_calories ?? '').trim(),
      sleep_h:         String(row.sleep_h ?? '').trim(),
      weight_kg:       String(row.weight_kg ?? '').trim(),
    }))
    .filter((row) => row.date)
}

export async function getBackpackItems(): Promise<BackpackRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('traveling')

  return rows
    .map((row) => ({
      storage: String(row.storage ?? ''),
      type: String(row.type ?? ''),
      item: String(row.item ?? ''),
      quantity: String(row.quantity ?? ''),
      packed: parseBoolean(row.packed),
    }))
    .filter((row) => row.item)
}

export async function setBackpackPacked(
  idToken: string,
  payload: {
    storage: string
    type: string
    item: string
    packed: boolean
  },
) {
  await runWrite({
    action: 'setBackpackPacked',
    idToken,
    storage: payload.storage,
    type: payload.type,
    item: payload.item,
    packed: payload.packed,
  })
}

export async function getMealPlan(): Promise<MealPlanRecord[]> {
  const rows = await dbRead<Record<string, unknown>>('meal_plan')

  return rows
    .map((row) => ({
      day_of_the_week: String(row.day_of_the_week ?? ''),
      breakfast: String(row.breakfast ?? ''),
      lunch: String(row.lunch ?? ''),
      dinner: String(row.dinner ?? ''),
      snack: String(row.snack ?? ''),
    }))
    .filter((row) => row.day_of_the_week)
}

export async function getGroceryList(): Promise<GroceryListRecord[]> {
  const rows = await dbRead<Record<string, unknown>>('grocery_list')

  return rows
    .map((row) => ({
      type: String(row.type ?? '').trim() || 'ETC',
      item: String(row.item ?? ''),
      completed: parseBoolean(row.completed),
      include: parseBoolean(row.include),
    }))
    .filter((row) => row.item)
}

function mapFinanceTransactions(rows: Record<string, unknown>[]): FinanceTransactionRecord[] {
  const mapped = rows
    .map((row) => ({
      date: row.date ? String(row.date) : undefined,
      description: String(row.description ?? ''),
      amount: parseNumber(row.amount) ?? 0,
      category: String(row.category ?? ''),
      card: String(row.card ?? ''),
    }))
    .filter((row) => row.description)

  if (import.meta.env.DEV) {
    const uniqueCategories = [...new Set(mapped.map((r) => r.category).filter(Boolean))]
    console.log('[finance] raw categories from sheet:', uniqueCategories)
  }

  return mapped
}

export type BudgetTargetRecord = {
  user: string
  category: string
  budget_amount: number
}

export async function getBudgetTargets(): Promise<BudgetTargetRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('budget_targets')
  return rows
    .map((row) => ({
      user: String(row.user ?? '').toLowerCase().trim(),
      category: String(row.category ?? '').toLowerCase().trim(),
      budget_amount: parseNumber(row.budget_amount) ?? 0,
    }))
    .filter((row) => row.user && row.category && row.budget_amount > 0)
}

export async function saveBudgetTarget(
  idToken: string,
  category: string,
  budgetAmount: number | null,
  user: string,
) {
  await runWrite({
    action: 'setBudgetTarget',
    idToken,
    category: category.toLowerCase().trim(),
    budget_amount: budgetAmount ?? 0,
    user: user.toLowerCase().trim(),
  })
}

export async function getAbeTransactions(): Promise<FinanceTransactionRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('abe_transactions')
  return mapFinanceTransactions(rows)
}

export async function getCiaraTransactions(): Promise<FinanceTransactionRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('ciara_transactions')
  return mapFinanceTransactions(rows)
}

async function runWrite(payload: Record<string, unknown>) {
  const result = await postSheetsAction<SheetsWriteResponse>(payload)

  if (!result.ok) {
    const rawError = result.error || 'Sheets write failed'
    const actionName = typeof payload.action === 'string' ? payload.action : 'unknown-action'

    if (/invalid token/i.test(rawError)) {
      throw new Error(
        'Invalid or expired Google token. Please sign in again on Login. If this persists only for Add/Update/Delete, your Apps Script likely needs those new action handlers deployed.',
      )
    }

    if (/unknown action/i.test(rawError)) {
      throw new Error(
        `Unsupported Apps Script action: ${actionName}. Add this case to your Apps Script doPost action router, then redeploy the Web App.`,
      )
    }

    throw new Error(rawError)
  }
}

export async function votePoll(idToken: string, pollId: string, selectedOption: 'A' | 'B') {
  await runWrite({
    action: 'pollVote',
    idToken,
    poll_id: pollId,
    selected_option: selectedOption,
  })
}

export async function setBucketCompleted(idToken: string, bucketId: string, completed: boolean) {
  await runWrite({
    action: 'setBucketCompleted',
    idToken,
    bucket_id: bucketId,
    completed,
  })
}

export async function setCountryVisited(idToken: string, countryId: string, visited: boolean) {
  await runWrite({
    action: 'setCountryVisited',
    idToken,
    country_id: countryId,
    visited,
  })
}

export async function setCurrentStudyCompleted(idToken: string, studyId: string, completed: boolean) {
  const rows = await dbRead<Record<string, unknown>>('current_study')
  const row = rows.find((entry) => String(entry.study_id) === studyId)
  if (!row) throw new Error('Study row not found')

  await dbWrite('current_study', 'PUT', idToken, {
    study_id: studyId,
    related_exam: String(row.related_exam ?? ''),
    topic: String(row.topic ?? ''),
    date: String(row.date ?? ''),
    completed,
  })
}

export async function setTrainingWorkoutCompleted(
  idToken: string,
  trainingId: string,
  workoutPeriod: 'morning' | 'evening',
  completed: boolean,
) {
  const rows = await dbRead<Record<string, unknown>>('training_records')
  const row = rows.find((entry) => String(entry.training_id) === trainingId)
  if (!row) throw new Error('Training row not found')

  await dbWrite('training_records', 'PUT', idToken, {
    training_id: trainingId,
    date: String(row.date ?? ''),
    morning_workout: String(row.morning_workout ?? ''),
    evening_workout: String(row.evening_workout ?? ''),
    completed_morning: workoutPeriod === 'morning' ? completed : Boolean(Number(row.completed_morning)),
    completed_evening: workoutPeriod === 'evening' ? completed : Boolean(Number(row.completed_evening)),
  })
}

export async function upsertTrainingRecord(
  idToken: string,
  input: { date: string; morningWorkout: string; eveningWorkout: string },
) {
  const rows = await getTrainingRecords()
  const existing = rows.find((row) => sameDateKey(row.date, input.date))

  if (existing) {
    await dbWrite('training_records', 'PUT', idToken, {
      training_id: existing.training_id,
      date: existing.date ?? input.date,
      morning_workout: input.morningWorkout,
      evening_workout: input.eveningWorkout,
      completed_morning: existing.completed_morning,
      completed_evening: existing.completed_evening,
    })
    return
  }

  // Nothing planned and no existing row: nothing to do.
  if (!input.morningWorkout && !input.eveningWorkout) return

  await dbWrite('training_records', 'POST', idToken, {
    training_id: crypto.randomUUID(),
    date: input.date,
    morning_workout: input.morningWorkout,
    evening_workout: input.eveningWorkout,
    completed_morning: false,
    completed_evening: false,
  })
}

export async function replaceCurrentStudyForDate(
  idToken: string,
  input: { date: string; relatedExam: string; topic: string },
) {
  const rows = await dbRead<Record<string, unknown>>('current_study')
  const matches = rows.filter((row) => sameDateKey(String(row.date ?? ''), input.date))

  for (const row of matches) {
    await dbWrite('current_study', 'DELETE', idToken, { study_id: String(row.study_id) })
  }

  // An empty topic clears the day instead of writing a blank row.
  if (input.topic.trim()) {
    await dbWrite('current_study', 'POST', idToken, {
      study_id: crypto.randomUUID(),
      related_exam: input.relatedExam,
      topic: input.topic,
      date: input.date,
      completed: false,
    })
  }
}

export async function createEvent(
  idToken: string,
  payload: {
    eventDate: string
    eventName: string
    type?: string
    measurement?: string
    location?: string
    link?: string
    price?: number
    active?: boolean
  },
) {
  await runWrite({
    action: 'createEvent',
    idToken,
    event_date: payload.eventDate,
    event_name: payload.eventName,
    type: payload.type ?? '',
    measurement: payload.measurement ?? '',
    location: payload.location ?? '',
    link: payload.link ?? '',
    price: payload.price ?? '',
    active: payload.active ?? false,
  })
}

export async function updateEvent(
  idToken: string,
  eventId: string,
  payload: {
    eventDate: string
    eventName: string
    type?: string
    measurement?: string
    location?: string
    link?: string
    price?: number
    active?: boolean
  },
) {
  await runWrite({
    action: 'updateEvent',
    idToken,
    event_id: eventId,
    event_date: payload.eventDate,
    event_name: payload.eventName,
    type: payload.type ?? '',
    measurement: payload.measurement ?? '',
    location: payload.location ?? '',
    link: payload.link ?? '',
    price: payload.price ?? '',
    active: payload.active ?? false,
  })
}

export async function deleteEvent(idToken: string, eventId: string) {
  await runWrite({
    action: 'deleteEvent',
    idToken,
    event_id: eventId,
  })
}

export async function setActiveEvent(idToken: string, eventId: string) {
  await runWrite({
    action: 'setActiveEvent',
    idToken,
    event_id: eventId,
  })
}

export async function createPoll(idToken: string, question: string, optionA: string, optionB: string) {
  await runWrite({
    action: 'createPoll',
    idToken,
    question,
    option_a: optionA,
    option_b: optionB,
  })
}

export async function updatePoll(
  idToken: string,
  pollId: string,
  question: string,
  optionA: string,
  optionB: string,
) {
  await runWrite({
    action: 'updatePoll',
    idToken,
    poll_id: pollId,
    question,
    option_a: optionA,
    option_b: optionB,
  })
}

export async function deletePoll(idToken: string, pollId: string) {
  await runWrite({
    action: 'deletePoll',
    idToken,
    poll_id: pollId,
  })
}

export async function createBucketItem(idToken: string, item: string) {
  await runWrite({
    action: 'createBucketItem',
    idToken,
    item,
  })
}

export async function updateBucketItem(idToken: string, bucketId: string, item: string) {
  await runWrite({
    action: 'updateBucketItem',
    idToken,
    bucket_id: bucketId,
    item,
  })
}

export async function deleteBucketItem(idToken: string, bucketId: string) {
  await runWrite({
    action: 'deleteBucketItem',
    idToken,
    bucket_id: bucketId,
  })
}

export async function createCountry(idToken: string, countryStateName: string, visited = false) {
  await runWrite({
    action: 'createCountry',
    idToken,
    country_state_name: countryStateName,
    visited,
  })
}

export async function updateCountry(idToken: string, countryId: string, countryStateName: string) {
  await runWrite({
    action: 'updateCountry',
    idToken,
    country_id: countryId,
    country_state_name: countryStateName,
  })
}

export async function deleteCountry(idToken: string, countryId: string) {
  await runWrite({
    action: 'deleteCountry',
    idToken,
    country_id: countryId,
  })
}

export async function updateBackpackItem(
  idToken: string,
  payload: {
    originalStorage: string
    originalType: string
    originalItem: string
    storage: string
    type: string
    quantity: string
  },
) {
  await runWrite({
    action: 'updateBackpackItem',
    idToken,
    original_storage: payload.originalStorage,
    original_type: payload.originalType,
    original_item: payload.originalItem,
    storage: payload.storage,
    type: payload.type,
    quantity: payload.quantity,
  })
}

export async function updateMealPlan(
  idToken: string,
  payload: {
    originalDayOfTheWeek: string
    dayOfTheWeek: string
    breakfast: string
    lunch: string
    dinner: string
    snack: string
  },
) {
  await dbWrite('meal_plan', 'PUT', idToken, {
    original_day_of_the_week: payload.originalDayOfTheWeek,
    day_of_the_week: payload.dayOfTheWeek,
    breakfast: payload.breakfast,
    lunch: payload.lunch,
    dinner: payload.dinner,
    snack: payload.snack,
  })
}

export async function createGroceryListItem(idToken: string, type: string, item: string, completed = false, include = false) {
  await dbWrite('grocery_list', 'POST', idToken, {
    type,
    item,
    completed,
    include,
  })
}

export async function updateGroceryListItem(
  idToken: string,
  payload: {
    originalItem: string
    item: string
    type: string
    completed?: boolean
    include?: boolean
  },
) {
  await dbWrite('grocery_list', 'PUT', idToken, {
    original_item: payload.originalItem,
    item: payload.item,
    type: payload.type,
    completed: payload.completed ?? false,
    include: payload.include ?? false,
  })
}

export async function getRecipes(): Promise<RecipeRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('recipes')
  return rows
    .map((row) => ({
      recipe_id: String(row.recipe_id ?? ''),
      recipe_name: String(row.recipe_name ?? ''),
      category: String(row.category ?? ''),
      calories: String(row.calories ?? ''),
      servings: String(row.servings ?? ''),
      video_link: String(row.video_link ?? ''),
      website_link: String(row.website_link ?? ''),
      cook_time: String(row.cook_time ?? ''),
    }))
    .filter((row) => row.recipe_id)
}

export async function getRecipeComponents(): Promise<RecipeComponentRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('recipe_components')
  return rows
    .map((row) => ({
      component_id: String(row.component_id ?? ''),
      recipe_id: String(row.recipe_id ?? ''),
      type: String(row.type ?? ''),
      name: String(row.name ?? ''),
      quantity: String(row.quantity ?? ''),
      unit: String(row.unit ?? ''),
      note: String(row.note ?? ''),
    }))
    .filter((row) => row.component_id)
}

export async function getRecipeSteps(): Promise<RecipeStepRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('recipe_steps')
  return rows
    .map((row) => ({
      step_id: String(row.step_id ?? ''),
      recipe_id: String(row.recipe_id ?? ''),
      step_number: parseNumber(row.step_number) ?? 0,
      instruction: String(row.instruction ?? ''),
    }))
    .filter((row) => row.step_id)
}

export async function createRecipe(
  idToken: string,
  payload: {
    recipeName: string
    category: string
    calories: string
    servings: string
    videoLink: string
    websiteLink: string
    cookTime: string
  },
) {
  await runWrite({
    action: 'createRecipe',
    idToken,
    recipe_name: payload.recipeName,
    category: payload.category,
    calories: payload.calories,
    servings: payload.servings,
    video_link: payload.videoLink,
    website_link: payload.websiteLink,
    cook_time: payload.cookTime,
  })
}

export async function updateRecipe(
  idToken: string,
  recipeId: string,
  payload: {
    recipeName: string
    category: string
    calories: string
    servings: string
    videoLink: string
    websiteLink: string
    cookTime: string
  },
) {
  await runWrite({
    action: 'updateRecipe',
    idToken,
    recipe_id: recipeId,
    recipe_name: payload.recipeName,
    category: payload.category,
    calories: payload.calories,
    servings: payload.servings,
    video_link: payload.videoLink,
    website_link: payload.websiteLink,
    cook_time: payload.cookTime,
  })
}

export async function deleteRecipe(idToken: string, recipeId: string) {
  await runWrite({ action: 'deleteRecipe', idToken, recipe_id: recipeId })
}

export async function createRecipeComponent(
  idToken: string,
  payload: {
    recipeId: string
    type: string
    name: string
    quantity: string
    unit: string
    note: string
  },
) {
  await runWrite({
    action: 'createRecipeComponent',
    idToken,
    recipe_id: payload.recipeId,
    type: payload.type,
    name: payload.name,
    quantity: payload.quantity,
    unit: payload.unit,
    note: payload.note,
  })
}

export async function updateRecipeComponent(
  idToken: string,
  componentId: string,
  payload: {
    type: string
    name: string
    quantity: string
    unit: string
    note: string
  },
) {
  await runWrite({
    action: 'updateRecipeComponent',
    idToken,
    component_id: componentId,
    type: payload.type,
    name: payload.name,
    quantity: payload.quantity,
    unit: payload.unit,
    note: payload.note,
  })
}

export async function deleteRecipeComponent(idToken: string, componentId: string) {
  await runWrite({ action: 'deleteRecipeComponent', idToken, component_id: componentId })
}

export async function createRecipeStep(
  idToken: string,
  payload: {
    recipeId: string
    stepNumber: number
    instruction: string
  },
) {
  await runWrite({
    action: 'createRecipeStep',
    idToken,
    recipe_id: payload.recipeId,
    step_number: payload.stepNumber,
    instruction: payload.instruction,
  })
}

export async function updateRecipeStep(
  idToken: string,
  stepId: string,
  payload: {
    stepNumber: number
    instruction: string
  },
) {
  await runWrite({
    action: 'updateRecipeStep',
    idToken,
    step_id: stepId,
    step_number: payload.stepNumber,
    instruction: payload.instruction,
  })
}

export async function deleteRecipeStep(idToken: string, stepId: string) {
  await runWrite({ action: 'deleteRecipeStep', idToken, step_id: stepId })
}

export async function deleteGroceryListItem(
  idToken: string,
  payload: {
    item: string
  },
) {
  await dbWrite('grocery_list', 'DELETE', idToken, {
    item: payload.item,
  })
}

export async function getTrips(): Promise<TripRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('trips')
  return rows
    .map((row) => ({
      trip_id: String(row.name ?? '').trim(),
      name: String(row.name ?? '').trim(),
      target_date: String(row.date ?? '').trim(),
      target_amount: parseNumber(row.budget) ?? 0,
      saved_amount: parseNumber(row.saved) ?? 0,
    }))
    .filter((row) => row.name)
}

export async function createTrip(
  idToken: string,
  name: string,
  targetDate: string,
  targetAmount: number,
) {
  await runWrite({
    action: 'createTrip',
    idToken,
    name,
    date: targetDate,
    budget: targetAmount,
  })
}

export async function updateTrip(idToken: string, tripId: string, savedAmount: number) {
  await runWrite({
    action: 'updateTrip',
    idToken,
    name: tripId,
    saved: savedAmount,
  })
}

export async function deleteTrip(idToken: string, tripId: string) {
  await runWrite({
    action: 'deleteTrip',
    idToken,
    name: tripId,
  })
}

export async function getStoreDeals(): Promise<StoreDealRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('store_deals')
  return rows
    .map((row) => ({
      deal_id: String(row.deal_id ?? ''),
      store: String(row.store ?? '').trim(),
      item: String(row.item ?? '').trim(),
      category: String(row.category ?? '').trim(),
      original_price: parseNumber(row.original_price) ?? 0,
      sale_price: parseNumber(row.sale_price) ?? 0,
      discount_pct: parseNumber(row.discount_pct) ?? 0,
      expiry_date: row.expiry_date ? String(row.expiry_date) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      active: parseBoolean(row.active),
    }))
    .filter((row) => row.deal_id && row.item)
}

export async function createStoreDeal(
  idToken: string,
  payload: {
    store: string
    item: string
    category: string
    originalPrice: number
    salePrice: number
    discountPct: number
    expiryDate?: string
    notes?: string
    active?: boolean
  },
) {
  await runWrite({
    action: 'createStoreDeal',
    idToken,
    store: payload.store,
    item: payload.item,
    category: payload.category,
    original_price: payload.originalPrice,
    sale_price: payload.salePrice,
    discount_pct: payload.discountPct,
    expiry_date: payload.expiryDate ?? '',
    notes: payload.notes ?? '',
    active: payload.active ?? true,
  })
}

export async function updateStoreDeal(
  idToken: string,
  dealId: string,
  payload: {
    store: string
    item: string
    category: string
    originalPrice: number
    salePrice: number
    discountPct: number
    expiryDate?: string
    notes?: string
    active?: boolean
  },
) {
  await runWrite({
    action: 'updateStoreDeal',
    idToken,
    deal_id: dealId,
    store: payload.store,
    item: payload.item,
    category: payload.category,
    original_price: payload.originalPrice,
    sale_price: payload.salePrice,
    discount_pct: payload.discountPct,
    expiry_date: payload.expiryDate ?? '',
    notes: payload.notes ?? '',
    active: payload.active ?? true,
  })
}

export async function deleteStoreDeal(idToken: string, dealId: string) {
  await runWrite({ action: 'deleteStoreDeal', idToken, deal_id: dealId })
}

export async function getCoupons(): Promise<CouponRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('coupons')
  return rows
    .map((row) => ({
      coupon_id: String(row.coupon_id ?? ''),
      place: String(row.place ?? '').trim(),
      type: String(row.type ?? '').trim().toLowerCase(),
      description: String(row.description ?? '').trim(),
      discount: String(row.discount ?? '').trim(),
      code: row.code ? String(row.code) : undefined,
      expiry_date: row.expiry_date ? String(row.expiry_date) : undefined,
      source: row.source ? String(row.source) : undefined,
      active: parseBoolean(row.active),
    }))
    .filter((row) => row.coupon_id && row.description)
}

export async function createCoupon(
  idToken: string,
  payload: {
    place: string
    type: string
    description: string
    discount: string
    code?: string
    expiryDate?: string
    source?: string
    active?: boolean
  },
) {
  await runWrite({
    action: 'createCoupon',
    idToken,
    place: payload.place,
    type: payload.type,
    description: payload.description,
    discount: payload.discount,
    code: payload.code ?? '',
    expiry_date: payload.expiryDate ?? '',
    source: payload.source ?? '',
    active: payload.active ?? true,
  })
}

export async function updateCoupon(
  idToken: string,
  couponId: string,
  payload: {
    place: string
    type: string
    description: string
    discount: string
    code?: string
    expiryDate?: string
    source?: string
    active?: boolean
  },
) {
  await runWrite({
    action: 'updateCoupon',
    idToken,
    coupon_id: couponId,
    place: payload.place,
    type: payload.type,
    description: payload.description,
    discount: payload.discount,
    code: payload.code ?? '',
    expiry_date: payload.expiryDate ?? '',
    source: payload.source ?? '',
    active: payload.active ?? true,
  })
}

export async function deleteCoupon(idToken: string, couponId: string) {
  await runWrite({ action: 'deleteCoupon', idToken, coupon_id: couponId })
}

// ── Gaming ─────────────────────────────────────────────────────────────────

const MC_LOCAL_API  = (import.meta.env.VITE_MC_LOCAL_API  as string | undefined)?.replace(/\/$/, '')
const MC_API_TOKEN  = import.meta.env.VITE_MC_API_TOKEN   as string | undefined

function mcApiHeaders(): Record<string, string> {
  return MC_API_TOKEN ? { Authorization: `Bearer ${MC_API_TOKEN}` } : {}
}

export async function logMcServerStart(playerName: string): Promise<{ serverStarted: boolean }> {
  if (MC_LOCAL_API) {
    const res = await fetch(`${MC_LOCAL_API}/start`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...mcApiHeaders() },
      body:    JSON.stringify({ playerName }),
    })
    if (!res.ok) throw new Error('Local API /start failed')
    const data = await res.json()
    return { serverStarted: !!data.ok }
  }
  // Aternos path: log to sheet + send ntfy push notification
  const result = await postSheetsAction<SheetsWriteResponse & { serverStarted?: boolean }>({
    action:     'mcServerStart',
    playerName,
    timestamp:  new Date().toISOString(),
  })
  if (!result.ok) {
    throw new Error(result.error || 'Failed to log server start')
  }
  return { serverStarted: result.serverStarted ?? false }
}

// ── Gmail ─────────────────────────────────────────────────────────────────

export type MailSummaryRecord = {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  receivedAt: string
  unread: boolean
  important: boolean
}

/**
 * Recent inbox mail, read by the Apps Script Web App running as the owner.
 *
 * Goes through the same authenticated POST as every write: the script verifies
 * the Google ID token against Google before it touches the mailbox, so no Gmail
 * scope or access token is ever needed in the browser.
 */
export async function getMail(idToken: string, limit = 10): Promise<MailSummaryRecord[]> {
  const result = await postSheetsAction<
    SheetsWriteResponse & { messages?: MailSummaryRecord[] }
  >({ action: 'getMail', idToken, limit })

  if (!result.ok) {
    const error = result.error || 'Unable to read mail'

    if (/unknown action/i.test(error)) {
      throw new Error(
        'The Apps Script deployment has no getMail action yet. Add it and redeploy the Web App.',
      )
    }

    if (/permission|scope|authoriz/i.test(error)) {
      throw new Error(
        'Apps Script is not authorised for Gmail. Add the gmail.readonly scope to appsscript.json, run any function once to accept the prompt, then redeploy.',
      )
    }

    throw new Error(error)
  }

  return result.messages ?? []
}

/**
 * Turn the script's raw archive failure into something the dashboard can act
 * on. Exported for tests.
 */
export function describeArchiveError(raw: string) {
  if (/unknown action/i.test(raw)) {
    return 'The Apps Script deployment has no archiveMail action yet. Paste updated_code.gs in and redeploy the Web App.'
  }

  if (/permission|scope|authoriz/i.test(raw)) {
    return 'Apps Script is not authorised to change Gmail. Add the gmail.modify scope to appsscript.json, run authorizeGmail once, then redeploy the Web App.'
  }

  if (!raw.trim()) {
    return 'Gmail did not archive the thread. If this keeps happening, the deployed Apps Script is probably missing the gmail.modify scope — see README → Gmail.'
  }

  return raw
}

/**
 * Archive threads out of the inbox. Archiving removes the INBOX label only —
 * the mail stays in All Mail and is recoverable. Nothing here deletes.
 *
 * Older script builds report per-thread failures inside an `ok: true` envelope
 * with no reason attached, so "nothing archived" is treated as a failure here
 * rather than trusting the envelope — otherwise a missing Gmail scope looks
 * exactly like success.
 */
export async function archiveMail(idToken: string, threadIds: string[]) {
  const result = await postSheetsAction<
    SheetsWriteResponse & {
      archived?: string[]
      failed?: string[]
      reasons?: Record<string, string>
    }
  >({ action: 'archiveMail', idToken, thread_ids: threadIds })

  if (!result.ok) {
    throw new Error(describeArchiveError(result.error || ''))
  }

  const archived = result.archived ?? []
  const failed = result.failed ?? []

  if (archived.length === 0 && failed.length > 0) {
    throw new Error(describeArchiveError(result.reasons?.[failed[0]] ?? ''))
  }

  return { archived, failed }
}

/**
 * Save a reply draft on a thread. Never sends — the draft lands in Gmail and
 * the returned permalink is how the UI hands off for the final read-and-send.
 */
export async function createDraftReply(idToken: string, threadId: string, body: string) {
  const result = await postSheetsAction<
    SheetsWriteResponse & { draftId?: string; permalink?: string }
  >({ action: 'createDraftReply', idToken, thread_id: threadId, body })

  if (!result.ok) {
    throw new Error(result.error || 'Unable to create draft')
  }

  return { draftId: result.draftId ?? '', permalink: result.permalink ?? '' }
}

// ── Calendar ──────────────────────────────────────────────────────────────

export type CalendarEventRecord = {
  id: string
  source: 'google' | 'apple'
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  calendarName?: string
}

/**
 * Events across every Google calendar plus the optional published Apple feed.
 *
 * Read server-side by Apps Script, which sidesteps both problems the browser
 * route had: no Calendar scope on the site's OAuth client, and no CORS on the
 * iCloud `.ics` feed.
 */
export async function getCalendarEvents(
  idToken: string,
  start: Date,
  end: Date,
): Promise<{ events: CalendarEventRecord[]; errors: string[]; appleConfigured: boolean }> {
  const result = await postSheetsAction<
    SheetsWriteResponse & {
      events?: CalendarEventRecord[]
      errors?: string[]
      appleConfigured?: boolean
    }
  >({
    action: 'getCalendarEvents',
    idToken,
    start: start.toISOString(),
    end: end.toISOString(),
  })

  if (!result.ok) {
    const error = result.error || 'Unable to read calendars'

    if (/unknown action/i.test(error)) {
      throw new Error(
        'The Apps Script deployment has no getCalendarEvents action yet. Paste the latest code and redeploy.',
      )
    }

    throw new Error(error)
  }

  return {
    events: result.events ?? [],
    errors: result.errors ?? [],
    appleConfigured: Boolean(result.appleConfigured),
  }
}

// ── Journal ───────────────────────────────────────────────────────────────

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** Gratitude lines are newline-separated so an entry can contain commas. */
function parseLines(value: unknown): string[] {
  if (typeof value !== 'string') {
    return []
  }

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Newest entry first, so the journal opens on the most recent day. */
export async function getJournalEntries(idToken: string): Promise<JournalEntryRecord[]> {
  const rows = await dbRead<Record<string, unknown>>('journal_entries', idToken)

  return rows
    .map((row) => ({
      journal_id: String(row.journal_id ?? ''),
      entry_date: String(row.entry_date ?? '').slice(0, 10),
      title: String(row.title ?? ''),
      mood: String(row.mood ?? ''),
      body: String(row.body ?? ''),
      gratitude: parseLines(row.gratitude),
      prompt: String(row.prompt ?? ''),
      reflection: String(row.reflection ?? ''),
      tags: parseTags(row.tags),
      created_at: row.created_at ? String(row.created_at) : undefined,
    }))
    .filter((row) => row.journal_id && row.entry_date)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
}

export type JournalEntryDraft = {
  entryDate: string
  title: string
  mood: string
  body: string
  gratitude: string[]
  prompt: string
  reflection: string
  tags: string[]
}

function journalPayload(entry: JournalEntryDraft) {
  return {
    entry_date: entry.entryDate,
    title: entry.title,
    mood: entry.mood,
    body: entry.body,
    gratitude: entry.gratitude.filter(Boolean).join('\n'),
    prompt: entry.prompt,
    reflection: entry.reflection,
    tags: entry.tags.join(', '),
  }
}

export async function createJournalEntry(idToken: string, entry: JournalEntryDraft) {
  await dbWrite('journal_entries', 'POST', idToken, {
    journal_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...journalPayload(entry),
  })
}

export async function updateJournalEntry(
  idToken: string,
  journalId: string,
  entry: JournalEntryDraft,
) {
  // The worker replaces the whole row, so carry the original created_at over.
  const rows = await dbRead<Record<string, unknown>>('journal_entries', idToken)
  const existing = rows.find((row) => String(row.journal_id) === journalId)

  await dbWrite('journal_entries', 'PUT', idToken, {
    journal_id: journalId,
    created_at: String(existing?.created_at ?? ''),
    ...journalPayload(entry),
  })
}

export async function deleteJournalEntry(idToken: string, journalId: string) {
  await dbWrite('journal_entries', 'DELETE', idToken, {
    journal_id: journalId,
  })
}

// ── Work ──────────────────────────────────────────────────────────────────

export async function getWorkItems(): Promise<WorkItemRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('work_items')

  return rows
    .map((row) => ({
      work_id: String(row.work_id ?? ''),
      project: String(row.project ?? ''),
      item: String(row.item ?? ''),
      status: String(row.status ?? 'Not started'),
      due_date: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
      priority: parseNumber(row.priority) ?? 1,
      notes: row.notes ? String(row.notes) : undefined,
      link: row.link ? String(row.link) : undefined,
    }))
    .filter((row) => row.work_id && row.item)
}

type WorkItemDraft = {
  project: string
  item: string
  status: string
  dueDate?: string
  priority: number
  notes?: string
  link?: string
}

export async function createWorkItem(idToken: string, draft: WorkItemDraft) {
  await runWrite({
    action: 'createWorkItem',
    idToken,
    project: draft.project,
    item: draft.item,
    status: draft.status,
    due_date: draft.dueDate ?? '',
    priority: draft.priority,
    notes: draft.notes ?? '',
    link: draft.link ?? '',
  })
}

export async function updateWorkItem(idToken: string, workId: string, draft: WorkItemDraft) {
  await runWrite({
    action: 'updateWorkItem',
    idToken,
    work_id: workId,
    project: draft.project,
    item: draft.item,
    status: draft.status,
    due_date: draft.dueDate ?? '',
    priority: draft.priority,
    notes: draft.notes ?? '',
    link: draft.link ?? '',
  })
}

export async function deleteWorkItem(idToken: string, workId: string) {
  await runWrite({
    action: 'deleteWorkItem',
    idToken,
    work_id: workId,
  })
}
