/**
 * The 365 challenges. The list itself ships with the site (challenges.json) so
 * it is there before anything loads; what changes over time — status, video
 * link, edited wording — lives in the db Worker's `challenges` table, one row
 * per challenge that has been touched. Reading is public (the guest page shows
 * progress); writing needs the admin session.
 */

const DB_BASE_URL =
  (import.meta.env.VITE_DB_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  'https://db.abepasion.workers.dev'

export const CHALLENGE_STATUSES = ['Not Started', 'In Progress', 'Done'] as const
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number]

export const CHALLENGE_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Random'] as const

export type Challenge = {
  id: number
  category: string
  challenge: string
  duration: string
  difficulty: string
  status: ChallengeStatus
  /** Link to the video of attempting it, or '' until there is one. */
  videoUrl: string
}

type ChallengeRow = {
  challenge_id: string
  category: string
  challenge: string
  duration: string
  difficulty: string
  status: string
  video_url: string
}

type SeedChallenge = Omit<Challenge, 'videoUrl' | 'status'> & { status: string }

export function isChallengeStatus(value: string): value is ChallengeStatus {
  return (CHALLENGE_STATUSES as readonly string[]).includes(value)
}

/** Only web links become links; anything else typed in the field is ignored. */
export function safeVideoUrl(value: string): string {
  const text = value.trim()
  if (!text) return ''
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

/** The bundled list with whatever has been saved laid over it. */
export function mergeChallenges(seed: SeedChallenge[], rows: ChallengeRow[]): Challenge[] {
  const saved = new Map(rows.map((row) => [Number(row.challenge_id), row]))

  return seed.map((item) => {
    const row = saved.get(item.id)
    return {
      id: item.id,
      category: row?.category || item.category,
      challenge: row?.challenge || item.challenge,
      duration: row?.duration || item.duration,
      difficulty: row?.difficulty || item.difficulty,
      status: isChallengeStatus(row?.status ?? '') ? (row!.status as ChallengeStatus) : isChallengeStatus(item.status) ? item.status : 'Not Started',
      videoUrl: safeVideoUrl(row?.video_url ?? ''),
    }
  })
}

export async function loadSeedChallenges(): Promise<SeedChallenge[]> {
  const module = await import('./challenges.json')
  return module.default as SeedChallenge[]
}

export async function listChallengeRows(): Promise<ChallengeRow[]> {
  const response = await fetch(`${DB_BASE_URL}/db/challenges`)
  if (!response.ok) throw new Error(`Challenges read failed: ${response.status}`)

  const data = (await response.json()) as { rows?: ChallengeRow[] }
  return data.rows ?? []
}

export async function saveChallenge(idToken: string, challenge: Challenge): Promise<void> {
  const response = await fetch(`${DB_BASE_URL}/db/challenges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge_id: String(challenge.id),
      category: challenge.category,
      challenge: challenge.challenge,
      duration: challenge.duration,
      difficulty: challenge.difficulty,
      status: challenge.status,
      video_url: challenge.videoUrl,
      updated_at: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `Challenge save failed: ${response.status}`)
  }
}
