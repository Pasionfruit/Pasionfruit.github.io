import { fetchSheetTable, postSheetsAction, type SheetsWriteResponse } from './client'
import type {
  BackpackRecord,
  BucketListRecord,
  CountryRecord,
  CurrentStudyRecord,
  EventRecord,
  FinanceTransactionRecord,
  GroceryListRecord,
  MealPlanRecord,
  PersonalTrainingRecord,
  PollRecord,
  TrainingRecord,
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
  const rows = await fetchSheetTable<Record<string, unknown>>('current_study')

  return rows
    .map((row) => ({
      study_id: String(row.study_id ?? ''),
      related_exam: String(row.related_exam ?? ''),
      topic: String(row.topic ?? ''),
      date: row.date ? String(row.date) : undefined,
      own_terms: row.own_terms ? String(row.own_terms) : undefined,
      problems_solved: parseNumber(row.problems_solved),
      problems_worked: parseNumber(row.problems_worked),
      completed: parseBoolean(row.completed),
    }))
    .filter((row) => row.study_id && row.topic)
}

export async function getTrainingRecords(): Promise<TrainingRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('training_records')

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

export async function getBackpackItems(): Promise<BackpackRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('traveling')

  return rows
    .map((row) => ({
      storage: String(row.storage ?? ''),
      type: String(row.type ?? ''),
      item: String(row.item ?? ''),
      quantity: String(row.quantity ?? ''),
    }))
    .filter((row) => row.item)
}

export async function getMealPlan(): Promise<MealPlanRecord[]> {
  const rows = await fetchSheetTable<Record<string, unknown>>('meal_plan')

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
  const rows = await fetchSheetTable<Record<string, unknown>>('grocery_list')

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
  await runWrite({
    action: 'setCurrentStudyCompleted',
    idToken,
    study_id: studyId,
    completed,
  })
}

export async function setTrainingWorkoutCompleted(
  idToken: string,
  trainingId: string,
  workoutPeriod: 'morning' | 'evening',
  completed: boolean,
) {
  await runWrite({
    action: 'setTrainingWorkoutCompleted',
    idToken,
    training_id: trainingId,
    workout_period: workoutPeriod,
    completed,
  })
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
  await runWrite({
    action: 'updateMealPlan',
    idToken,
    original_day_of_the_week: payload.originalDayOfTheWeek,
    day_of_the_week: payload.dayOfTheWeek,
    breakfast: payload.breakfast,
    lunch: payload.lunch,
    dinner: payload.dinner,
    snack: payload.snack,
  })
}

export async function createGroceryListItem(idToken: string, type: string, item: string, completed = false, include = false) {
  await runWrite({
    action: 'createGroceryListItem',
    idToken,
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
  await runWrite({
    action: 'updateGroceryListItem',
    idToken,
    original_item: payload.originalItem,
    item: payload.item,
    type: payload.type,
    completed: payload.completed ?? false,
    include: payload.include ?? false,
  })
}

export async function deleteGroceryListItem(
  idToken: string,
  payload: {
    item: string
  },
) {
  await runWrite({
    action: 'deleteGroceryListItem',
    idToken,
    item: payload.item,
  })
}
