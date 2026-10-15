// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { YouTubeSnapshot } from '../../data/youtube/client'

const clientMocks = vi.hoisted(() => ({ getYouTubeVideos: vi.fn() }))
vi.mock('../../data/youtube/client', () => clientMocks)

import { YouTubeDashboard } from './YouTubeDashboard'

function snapshot(overrides: Partial<YouTubeSnapshot> = {}): YouTubeSnapshot {
  return {
    version: 1,
    video: 'miss',
    video_id: 'ldVdVPo8eO8',
    title: 'Why You Still Miss Your Ex at 2 A.M.',
    url: 'https://youtu.be/ldVdVPo8eO8',
    thumbnail: '',
    published_at: '2026-10-15T18:00:00Z',
    privacy: 'public',
    duration: 307.9,
    fetched_at: new Date().toISOString(),
    analytics_through: '2026-10-17',
    live: { views: 1200, likes: 96, comments: 14 },
    totals: {
      views: 1100,
      minutes_watched: 2310,
      average_view_seconds: 126,
      average_view_percent: 41,
      shares: 9,
      subscribers_gained: 31,
      subscribers_lost: 2,
    },
    ratios: { likes_per_100_views: 8, comments_per_1000_views: 11.67, subscribers_per_1000_views: 26.36 },
    daily: [
      { date: '2026-10-15', views: 300, minutes: 600, subscribers: 8, likes: 20 },
      { date: '2026-10-16', views: 800, minutes: 1710, subscribers: 23, likes: 70 },
    ],
    retention: Array.from({ length: 100 }, (_, i) => ({
      t: Math.round(((i + 1) / 100) * 307.9 * 10) / 10,
      watching: 1 - i * 0.006,
      relative: 0.5,
    })),
    moments: [
      { kind: 'hook', start: 3.1, end: 30, change: -0.3, watching: 0.7, line: "It's 2 a.m.", scene: '2am', chapter: "It's 2 a.m.", note: '70% still watching at 0:30' },
      {
        kind: 'drop',
        start: 117,
        end: 126,
        change: -0.07,
        watching: 0.42,
        line: 'Think about a slot machine.',
        scene: 'slot',
        chapter: 'Why the bad ones stick harder',
        note: '7 points of the audience left in 9 s',
      },
    ],
    chapters: [
      { t: 0, name: "It's 2 a.m.", watching: 1 },
      { t: 89, name: 'Why the bad ones stick harder', watching: 0.5 },
    ],
    traffic: [
      { source: 'RELATED_VIDEO', label: 'Suggested videos', views: 700, minutes: 1500 },
      { source: 'YT_SEARCH', label: 'YouTube search', views: 400, minutes: 810 },
    ],
    devices: [{ device: 'Phone', views: 900 }],
    lines: [{ start: 115, end: 119, text: 'Think about a slot machine.' }],
    scenes: [{ start: 96, end: 127, name: 'slot' }],
    comments: Array.from({ length: 6 }, (_, i) => ({
      author: `Viewer ${i + 1}`,
      text: i === 0 ? 'This explained my whole last year.' : `Comment ${i + 1}`,
      likes: 6 - i,
      published_at: new Date().toISOString(),
      replies: 0,
    })),
    notes: [],
    ...overrides,
  }
}

beforeEach(() => {
  clientMocks.getYouTubeVideos.mockResolvedValue([snapshot()])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('YouTubeDashboard', () => {
  it('shows the headline numbers', async () => {
    render(<YouTubeDashboard idToken="token" />)

    const link = await screen.findByRole('link', { name: /Why You Still Miss Your Ex/ })
    expect(link.getAttribute('href')).toBe('https://youtu.be/ldVdVPo8eO8')
    const stats = within(document.querySelector('.yt-stats') as HTMLElement)
    expect(stats.getByText('1,200')).toBeTruthy()
    expect(stats.getByText('41%')).toBeTruthy()
    expect(stats.getByText('+29')).toBeTruthy()
    expect(clientMocks.getYouTubeVideos).toHaveBeenCalledWith('token')
  })

  it('pins each drop to what was on screen', async () => {
    render(<YouTubeDashboard idToken="token" />)

    const moments = await screen.findByRole('list', { name: 'Moments worth a look' })
    expect(within(moments).getByText('Drop')).toBeTruthy()
    expect(within(moments).getByText('Think about a slot machine.')).toBeTruthy()
    expect(within(moments).getByText(/Scene: slot/)).toBeTruthy()
    expect(screen.getByText('70% past the hook')).toBeTruthy()
  })

  it('previews four comments and opens the rest on request', async () => {
    render(<YouTubeDashboard idToken="token" />)

    expect(await screen.findByText('This explained my whole last year.')).toBeTruthy()
    expect(screen.queryByText('Comment 6')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all 6' }))
    expect(screen.getByText('Comment 6')).toBeTruthy()
  })

  it('explains the wait while analytics catch up', async () => {
    clientMocks.getYouTubeVideos.mockResolvedValue([
      snapshot({ analytics_through: null, retention: [], moments: [], daily: [], traffic: [], devices: [], comments: [] }),
    ])
    render(<YouTubeDashboard idToken="token" />)

    expect(await screen.findByText(/No retention curve yet/)).toBeTruthy()
    expect(screen.getByText(/No daily numbers yet/)).toBeTruthy()
    expect(screen.getByText(/No comments yet/)).toBeTruthy()
  })

  it('switches between videos and compares them once there are two', async () => {
    clientMocks.getYouTubeVideos.mockResolvedValue([
      snapshot(),
      snapshot({ video_id: 'other000000', title: 'The Meaning of Life in 36 Seconds', live: { views: 50, likes: 2, comments: 0 } }),
    ])
    render(<YouTubeDashboard idToken="token" />)

    const tabs = await screen.findByRole('tablist', { name: 'Videos' })
    fireEvent.click(within(tabs).getByRole('tab', { name: 'The Meaning of Life in 36 Seconds' }))
    expect(screen.getByRole('link', { name: /The Meaning of Life/ })).toBeTruthy()
    expect(screen.getByText('All videos')).toBeTruthy()
  })

  it('says how to fill it when there is nothing yet', async () => {
    clientMocks.getYouTubeVideos.mockResolvedValue([])
    render(<YouTubeDashboard idToken="token" />)

    expect(await screen.findByText('No videos yet')).toBeTruthy()
  })

  it('shows the error when the results cannot be read', async () => {
    clientMocks.getYouTubeVideos.mockRejectedValue(new Error("Couldn't load the YouTube results (403)"))
    render(<YouTubeDashboard idToken="token" />)

    expect(await screen.findByText("Couldn't load the YouTube results (403)")).toBeTruthy()
  })
})
