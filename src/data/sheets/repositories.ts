import { fetchSheetTable, postSheetsAction, type SheetsWriteResponse } from './client'
import type { BucketListRecord, CountryRecord, PollRecord } from './types'

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
    const parsed = Number(value)
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
