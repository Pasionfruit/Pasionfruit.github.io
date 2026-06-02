export type PollRecord = {
  poll_id: string
  created_date?: string
  question: string
  option_a: string
  option_b: string
  option_a_votes?: number
  option_b_votes?: number
  total_votes?: number
  winning_option?: string
}

export type BucketListRecord = {
  bucket_id: string
  item: string
  completed_date?: string
  completed: boolean
}

export type CountryRecord = {
  country_id: string
  country_state_name: string
  visited_date?: string
  visited: boolean
}

export type CurrentStudyRecord = {
  study_id: string
  related_exam: string
  topic: string
  date?: string
  own_terms?: string
  problems_solved?: number
  problems_worked?: number
  completed: boolean
}

export type TrainingRecord = {
  training_id: string
  date?: string
  morning_workout?: string
  evening_workout?: string
  completed_morning: boolean
  completed_evening: boolean
}

export type EventRecord = {
  event_id: string
  event_date?: string
  event_name: string
  type?: string
  measurement?: string
  location?: string
  link?: string
  price?: number
  active: boolean
}

export type BackpackRecord = {
  storage: string
  type: string
  item: string
  quantity: string
}

export type MealPlanRecord = {
  day_of_the_week: string
  breakfast: string
  lunch: string
  dinner: string
  snack: string
}

export type GroceryListRecord = {
  item: string
  description: string
  completed: boolean
}

export type SheetsCollectionResponse<T> = {
  data: T[]
}
