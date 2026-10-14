// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const githubMocks = vi.hoisted(() => ({ getContributions: vi.fn() }))
vi.mock('../data/github/contributions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/github/contributions')>()),
  getContributions: githubMocks.getContributions,
}))

import { GitHubActivity } from './GitHubActivity'

const THIS_YEAR = new Date().getFullYear()
const LAST_YEAR = THIS_YEAR - 1

function day(date: string, count: number, level: number) {
  return [date, { date, count, level }] as const
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('GitHubActivity', () => {
  it("shades last year's days by GitHub's level, with the year's total and streak", async () => {
    const user = userEvent.setup()
    githubMocks.getContributions.mockResolvedValue({
      totals: { [THIS_YEAR]: 0, [LAST_YEAR]: 42 },
      days: new Map([day(`${LAST_YEAR}-01-05`, 3, 2), day(`${LAST_YEAR}-01-06`, 9, 4), day(`${LAST_YEAR}-01-07`, 1, 1)]),
    })
    render(<GitHubActivity username="Pasionfruit" />)

    const years = await screen.findByRole('listbox', { name: 'Select year' })
    expect(within(years).getAllByRole('option').map((option) => option.textContent)).toEqual([
      String(THIS_YEAR),
      String(LAST_YEAR),
    ])

    await user.click(within(years).getByRole('option', { name: String(LAST_YEAR) }))

    expect(screen.getByText(/contributions in/).textContent).toBe(`42 contributions in ${LAST_YEAR} · longest streak 3 days`)
    const busiest = screen.getByRole('listitem', { name: `Jan 6, ${LAST_YEAR} — 9 contributions` })
    expect(busiest.getAttribute('data-level')).toBe('4')
    expect(screen.getByRole('link', { name: /@Pasionfruit/ }).getAttribute('href')).toBe('https://github.com/Pasionfruit')
  })

  it('falls back to a link when the activity cannot be loaded', async () => {
    githubMocks.getContributions.mockRejectedValue(new Error('down'))
    render(<GitHubActivity username="Pasionfruit" />)

    expect(await screen.findByText(/GitHub activity is unavailable right now/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'See it on GitHub' }).getAttribute('href')).toBe('https://github.com/Pasionfruit')
  })
})
