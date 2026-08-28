/** Mood labels in order, worst to best. Index + 1 is the score. */
export const MOOD_SCALE = ['Rough', 'Tired', 'Flat', 'Good', 'Great'] as const

export type Mood = (typeof MOOD_SCALE)[number]

export const MOOD_COLORS: Record<Mood, string> = {
  Rough: '#dc2626',
  Tired: '#f97316',
  Flat: '#a1a1aa',
  Good: '#22c55e',
  Great: '#0ea5e9',
}

/** 1–5 for a known mood, or null for anything else (including an empty cell). */
export function moodScore(mood: string): number | null {
  const index = MOOD_SCALE.indexOf(mood as Mood)
  return index < 0 ? null : index + 1
}
