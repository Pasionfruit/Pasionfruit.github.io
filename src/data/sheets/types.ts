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
  packed: boolean
}

export type MealPlanRecord = {
  day_of_the_week: string
  breakfast: string
  lunch: string
  dinner: string
  snack: string
}

export type GroceryListRecord = {
  type: string
  item: string
  completed: boolean
  include: boolean
}

export type FinanceTransactionRecord = {
  date?: string
  description: string
  amount: number
  category: string
  card: string
}

export type PersonalTrainingRecord = {
  type: 'milestone' | 'equipment' | string
  category: string
  name: string
  value: string
}

export type GarminHealthRecord = {
  date: string
  activity_type: string
  title: string
  distance_km: string
  duration_min: string
  avg_hr: string
  max_hr: string
  calories: string
  tss: string
}

export type RingconnHealthRecord = {
  date: string
  sleep_score: string
  sleep_duration_h: string
  deep_sleep_h: string
  rem_sleep_h: string
  light_sleep_h: string
  resting_hr: string
  hrv: string
  spo2: string
  skin_temp_c: string
  steps: string
  calories: string
}

export type AppleHealthRecord = {
  date: string
  steps: string
  resting_hr: string
  hrv_sdnn: string
  active_calories: string
  basal_calories: string
  sleep_h: string
  spo2_avg: string
  weight_kg: string
}

export type RecipeRecord = {
  recipe_id: string
  recipe_name: string
  category: string
  calories: string
  servings: string
  video_link: string
  website_link: string
  cook_time: string
}

export type RecipeComponentRecord = {
  component_id: string
  recipe_id: string
  type: string
  name: string
  quantity: string
  unit: string
  note: string
}

export type RecipeStepRecord = {
  step_id: string
  recipe_id: string
  step_number: number
  instruction: string
}

export type TripRecord = {
  trip_id: string
  name: string
  target_date: string
  target_amount: number
  saved_amount: number
}

export type SheetsCollectionResponse<T> = {
  data: T[]
}
