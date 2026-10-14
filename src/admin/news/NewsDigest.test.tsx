// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  getNews: vi.fn(), aceChat: vi.fn(),
  getAceConfig: vi.fn(() => ({ baseUrl: 'https://ace.test', model: 'qwen3:8b' })),
}))
vi.mock('../../data/news/client', () => ({ getNews: mocks.getNews }))
vi.mock('../ace/client', () => ({ aceChat: mocks.aceChat, getAceConfig: mocks.getAceConfig }))
import { NewsDigest } from './NewsDigest'
import type { NewsPlacesState } from './useNewsPlaces'

const location: NewsPlacesState = {
  status: 'ready', error: '', places: {
    local: { place: 'Leon County', region: 'Florida', label: 'Leon County, Florida' },
    city: { place: 'Tallahassee', region: 'Florida', label: 'Tallahassee, Florida' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getNews.mockResolvedValue([{ title: 'A new park opened', source: 'Publisher', url: 'https://publisher.test/park', publishedAt: '' }])
  mocks.aceChat.mockResolvedValue('- A new park opened.')
})
afterEach(cleanup)

describe('news TL;DR', () => {
  it('waits for a click, then summarizes every category with one model request at a time', async () => {
    let active = 0
    let maxActive = 0
    mocks.aceChat.mockImplementation(async () => {
      active += 1
      maxActive = Math.max(active, maxActive)
      await Promise.resolve()
      active -= 1
      return '- A new park opened.'
    })
    render(<NewsDigest idToken="token" location={location} />)
    expect(mocks.aceChat).not.toHaveBeenCalled()
    expect(mocks.getNews).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Summarize all news' }))
    await screen.findByRole('button', { name: 'Refresh TL;DR' })
    expect(mocks.aceChat).toHaveBeenCalledTimes(5)
    expect(maxActive).toBe(1)
    for (const title of ['Local', 'City', 'Nation', 'International', 'Tech']) {
      const section = screen.getByRole('region', { name: `${title} TL;DR` })
      expect(within(section).getByText('A new park opened.')).toBeTruthy()
      expect(within(section).getByRole('link', { name: 'A new park opened', hidden: true }).getAttribute('href')).toBe('https://publisher.test/park')
    }
    const request = mocks.aceChat.mock.calls[0][0]
    expect(request.purpose).toBe('news')
    expect(request.messages[0].content).toContain('not full articles')
    expect(request.messages[1].content).toContain('A new park opened')
  })

  it('keeps fixed categories available when location is blocked', async () => {
    render(<NewsDigest idToken="token" location={{ status: 'error', places: null, error: 'Location access is blocked.' }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Summarize all news' }))
    await screen.findByRole('button', { name: 'Refresh TL;DR' })
    expect(mocks.aceChat).toHaveBeenCalledTimes(3)
    expect(screen.getAllByText('Location access is blocked.')).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Tech TL;DR' })).toBeTruthy()
  })

  it('shows a category failure and completes the other categories', async () => {
    mocks.getNews.mockRejectedValueOnce(new Error('Local feed unavailable'))
    render(<NewsDigest idToken="token" location={location} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Summarize all news' }))
    await screen.findByRole('button', { name: 'Refresh TL;DR' })
    expect(screen.getByText('Local feed unavailable')).toBeTruthy()
    expect(mocks.aceChat).toHaveBeenCalledTimes(4)
  })

  it('does not ask Ace to invent a summary for an empty feed', async () => {
    mocks.getNews.mockResolvedValue([])
    render(<NewsDigest idToken="token" location={location} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Summarize all news' }))
    await screen.findByRole('button', { name: 'Refresh TL;DR' })
    expect(mocks.aceChat).not.toHaveBeenCalled()
    expect(screen.getAllByText('No recent headlines available.')).toHaveLength(5)
  })

  it('cancels pending work when leaving the page', async () => {
    mocks.getNews.mockReturnValue(new Promise(() => {}))
    const view = render(<NewsDigest idToken="token" location={location} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Summarize all news' }))
    await waitFor(() => expect(mocks.getNews).toHaveBeenCalledTimes(1))
    const signal = mocks.getNews.mock.calls[0][2] as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
    expect(mocks.aceChat).not.toHaveBeenCalled()
  })
})
