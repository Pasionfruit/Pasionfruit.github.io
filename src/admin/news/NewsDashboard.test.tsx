// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NEWS_SUMMARY_EVENT } from '../ace/newsSummary'

const newsMocks = vi.hoisted(() => ({
  getNews: vi.fn(),
}))

vi.mock('../../data/news/client', () => newsMocks)

import { NewsDashboard } from './NewsDashboard'

const GEOCODE = {
  city: 'Tallahassee',
  locality: 'Tallahassee',
  principalSubdivision: 'Florida',
  localityInfo: { administrative: [{ name: 'Leon County', adminLevel: 6 }] },
}

function headline(title: string) {
  return {
    title,
    url: `https://news.google.com/rss/articles/${encodeURIComponent(title)}`,
    source: 'WCTV',
    publishedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  }
}

function stubGeolocation(result: 'allow' | 'deny') {
  const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
    if (result === 'allow') {
      success({ coords: { latitude: 30.4383, longitude: -84.2807 } } as GeolocationPosition)
    } else {
      failure?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError)
    }
  })
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  newsMocks.getNews.mockImplementation(async (_token: string, query: { feed?: string; place?: string }) => [
    headline(`${query.feed ?? query.place} story`),
  ])
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(GEOCODE), { status: 200 })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NewsDashboard', () => {
  it('keeps every headline available in a keyboard-focusable scrolling list', async () => {
    stubGeolocation('deny')
    newsMocks.getNews.mockResolvedValue(Array.from({ length: 20 }, (_, index) => headline(`Story ${index + 1}`)))
    render(<NewsDashboard idToken="token" />)
    const list = await screen.findByRole('list', { name: 'Nation headlines' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(20)
    expect(within(list).getByRole('link', { name: 'Story 20' })).toBeTruthy()
    expect(list.tabIndex).toBe(0)
  })

  it('passes the selected article to Ace only when the summary button is pressed', async () => {
    stubGeolocation('deny')
    const requested = vi.fn()
    window.addEventListener(NEWS_SUMMARY_EVENT, requested)
    try {
      render(<NewsDashboard idToken="token" />)
      const button = await screen.findByRole('button', { name: 'Ask Ace to summarize nation story' })
      expect(requested).not.toHaveBeenCalled()
      await userEvent.setup().click(button)
      expect(requested).toHaveBeenCalledTimes(1)
      expect((requested.mock.calls[0][0] as CustomEvent).detail.article.title).toBe('nation story')
    } finally {
      window.removeEventListener(NEWS_SUMMARY_EVENT, requested)
    }
  })

  it('shows local, city, national and international headlines, small to large', async () => {
    stubGeolocation('allow')
    render(<NewsDashboard idToken="token" />)

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Local', 'City', 'Nation', 'International'])

    expect(await screen.findByText('Leon County story')).toBeTruthy()
    expect(await screen.findByText('Tallahassee story')).toBeTruthy()
    expect(await screen.findByText('nation story')).toBeTruthy()
    expect(await screen.findByText('world story')).toBeTruthy()

    expect(newsMocks.getNews).toHaveBeenCalledWith('token', { place: 'Leon County', region: 'Florida' })
    expect(newsMocks.getNews).toHaveBeenCalledWith('token', { place: 'Tallahassee', region: 'Florida' })
    expect(screen.getByText('Leon County, Florida')).toBeTruthy()
  })

  it('opens a headline in a new tab and says where and when it is from', async () => {
    stubGeolocation('allow')
    render(<NewsDashboard idToken="token" />)

    const list = await screen.findByRole('list', { name: 'Nation headlines' })
    const link = within(list).getByRole('link', { name: /nation story/ })

    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(within(list).getByText('WCTV · 2h ago')).toBeTruthy()
  })

  it('still shows national and world news when location is blocked', async () => {
    stubGeolocation('deny')
    render(<NewsDashboard idToken="token" />)

    expect(await screen.findByText('world story')).toBeTruthy()
    expect(screen.getAllByText(/Location access is blocked/)).toHaveLength(2)
    expect(newsMocks.getNews).not.toHaveBeenCalledWith('token', expect.objectContaining({ place: expect.any(String) }))
  })
})
