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

export type SheetsCollectionResponse<T> = {
  data: T[]
}
