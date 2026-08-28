import { describe, expect, it } from 'vitest'
import { KJV_VERSES, getVerseOfTheDay } from './verses'
import { GRATITUDE_PROMPTS, getPromptOfTheDay } from './prompts'
import { MOOD_SCALE, moodScore } from './moods'

describe('verse of the day', () => {
  it('returns the same verse all day and a different one tomorrow', () => {
    const morning = getVerseOfTheDay(new Date(2026, 0, 5, 0, 1))
    const evening = getVerseOfTheDay(new Date(2026, 0, 5, 23, 59))
    const tomorrow = getVerseOfTheDay(new Date(2026, 0, 6, 12, 0))

    expect(morning).toEqual(evening)
    expect(tomorrow).not.toEqual(morning)
  })

  it('cycles through the whole list before repeating', () => {
    const seen = new Set<string>()
    const start = new Date(2026, 0, 1)

    for (let day = 0; day < KJV_VERSES.length; day += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + day)
      seen.add(getVerseOfTheDay(date).reference)
    }

    expect(seen.size).toBe(KJV_VERSES.length)
  })

  it('has a reference and text for every verse', () => {
    for (const verse of KJV_VERSES) {
      expect(verse.reference.length).toBeGreaterThan(3)
      expect(verse.text.length).toBeGreaterThan(15)
    }
  })

  it('never repeats a reference in the list', () => {
    const refs = KJV_VERSES.map((verse) => verse.reference)
    expect(new Set(refs).size).toBe(refs.length)
  })
})

describe('gratitude prompt of the day', () => {
  it('is stable within a day and rotates the next', () => {
    const today = getPromptOfTheDay(new Date(2026, 2, 10, 6, 0))
    expect(getPromptOfTheDay(new Date(2026, 2, 10, 22, 0))).toBe(today)
    expect(getPromptOfTheDay(new Date(2026, 2, 11, 6, 0))).not.toBe(today)
  })

  it('every prompt is a question', () => {
    for (const prompt of GRATITUDE_PROMPTS) {
      expect(prompt.endsWith('?')).toBe(true)
    }
  })
})

describe('mood scoring', () => {
  it('scores the scale 1..5 worst to best', () => {
    expect(MOOD_SCALE.map(moodScore)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns null for an unknown or empty mood', () => {
    expect(moodScore('')).toBeNull()
    expect(moodScore('Ecstatic')).toBeNull()
  })
})
