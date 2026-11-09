// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerseOfTheDayCard } from './VerseOfTheDayCard'
import { getVerseOfTheDay, parseVerseReference } from './journal/verses'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('parseVerseReference', () => {
  it('reads single verses, ranges and numbered books', () => {
    expect(parseVerseReference('Psalm 23:1')).toEqual({ book: 'Psalm', chapter: 23, first: 1, last: 1 })
    expect(parseVerseReference('1 Thessalonians 5:16-18')).toEqual({ book: '1 Thessalonians', chapter: 5, first: 16, last: 18 })
    expect(parseVerseReference('Selah')).toBeNull()
  })
})

describe('VerseOfTheDayCard', () => {
  it('folds to a line once marked read, and reopens', async () => {
    const user = userEvent.setup()
    render(<VerseOfTheDayCard title="Verse of the day" />)
    const verse = getVerseOfTheDay()

    expect(screen.getByText(verse.text)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mark as read' }))
    expect(screen.queryByText(verse.text)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(screen.getByText(verse.text)).toBeTruthy()
  })

  it('stays read for the rest of the day', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<VerseOfTheDayCard title="Verse of the day" />)
    await user.click(screen.getByRole('button', { name: 'Mark as read' }))
    unmount()

    render(<VerseOfTheDayCard title="Verse of the day" />)
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy()
  })

  it('loads the whole chapter on demand and marks the verse', async () => {
    const user = userEvent.setup()
    const verse = getVerseOfTheDay()
    const ref = parseVerseReference(verse.reference)!
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          verses: [
            { verse: 1, text: 'First verse text\n' },
            { verse: ref.first, text: 'The verse of the day' },
          ],
        }),
      }),
    )
    render(<VerseOfTheDayCard title="Verse of the day" />)

    await user.click(screen.getByRole('button', { name: `Read ${ref.book} ${ref.chapter}` }))

    expect(await screen.findByText(/First verse text/)).toBeTruthy()
    expect(document.querySelector('.verse-chapter-hit')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Hide chapter' }))
    expect(document.querySelector('.verse-chapter')).toBeNull()
  })

  it('falls back to a link when the chapter cannot be fetched', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<VerseOfTheDayCard title="Verse of the day" />)

    await user.click(screen.getByRole('button', { name: /^Read / }))

    expect(await screen.findByRole('link', { name: 'Open it on BibleGateway' })).toBeTruthy()
  })
})
