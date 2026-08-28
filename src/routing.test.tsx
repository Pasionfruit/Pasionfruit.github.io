// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'

const repoMocks = vi.hoisted(() => {
  const empty = () => vi.fn().mockResolvedValue([])
  return {
    getAbeTransactions: empty(),
    getCiaraTransactions: empty(),
    getCurrentStudy: empty(),
    getEvents: empty(),
    getTrainingRecords: empty(),
    getPersonalTraining: empty(),
    getGarminHealth: empty(),
    getRingconnHealth: empty(),
    getAppleHealth: empty(),
    getBudgetTargets: empty(),
    getTrips: empty(),
    getMcPlayerStats: empty(),
    getJournalEntries: empty(),
    getWorkItems: empty(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    setActiveEvent: vi.fn(),
    setCurrentStudyCompleted: vi.fn(),
    setTrainingWorkoutCompleted: vi.fn(),
    upsertTrainingRecord: vi.fn(),
    replaceCurrentStudyForDate: vi.fn(),
    saveBudgetTarget: vi.fn(),
    createTrip: vi.fn(),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn(),
    createJournalEntry: vi.fn(),
    updateJournalEntry: vi.fn(),
    deleteJournalEntry: vi.fn(),
    createWorkItem: vi.fn(),
    updateWorkItem: vi.fn(),
    deleteWorkItem: vi.fn(),
  }
})

const todoistMocks = vi.hoisted(() => ({
  getTasksOfTheDay: vi.fn().mockResolvedValue([]),
  getActiveTasks: vi.fn().mockResolvedValue([]),
  getCompletedTasks: vi.fn().mockResolvedValue([]),
  getProjects: vi.fn().mockResolvedValue([]),
  getSections: vi.fn().mockResolvedValue([]),
  closeTask: vi.fn(),
  createTask: vi.fn(),
  createTaskDetailed: vi.fn(),
  updateTask: vi.fn(),
  rescheduleTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('./data/sheets/repositories', () => repoMocks)
vi.mock('./data/todoist/repositories', () => todoistMocks)
vi.mock('./data/sheets/client', () => ({ warmupAppsScript: vi.fn(), fetchSheetTable: vi.fn() }))
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Google Login</button>,
  useGoogleOneTapLogin: () => undefined,
}))

import App from './App'

const ADMIN_EMAIL = 'pasionabe@gmail.com'
const GUEST_EMAIL = 'someoneelse@gmail.com'

function fakeIdToken(email: string) {
  const encode = (value: object) =>
    window
      .btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.signature`
}

function renderAt(path: string, email?: string) {
  if (email) {
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', fakeIdToken(email))
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** The home page's h1 is visually hidden — the tiles carry the page. */
const HOME_TITLE = 'mrpasionfruit'

/** The page heading rendered by PageFrame, or the home page's own h1. */
function pageTitle() {
  return screen.getAllByRole('heading', { level: 1 })[0]?.textContent ?? ''
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('guest routing', () => {
  it('shows exactly the three public sections on the home page', () => {
    renderAt('/')

    const tiles = [...document.querySelectorAll('a.section-tile')]
    expect(tiles.map((tile) => tile.getAttribute('href'))).toEqual([
      '/experiences',
      '/personal-sites',
      '/gaming',
    ])
  })

  it.each(['/experiences', '/personal-sites', '/gaming'])('renders the public section %s', (path) => {
    renderAt(path)
    expect(pageTitle()).not.toBe(HOME_TITLE)
  })

  it('lists the deployed side projects with outbound links', () => {
    renderAt('/personal-sites')

    const hrefs = screen
      .getAllByRole('link', { name: 'Try it' })
      .map((link) => link.getAttribute('href'))

    expect(hrefs).toContain('https://pov-cooking.vercel.app/')
    expect(hrefs).toContain('https://texthero.onrender.com/')
    expect(hrefs).toContain('https://mahjong-xmhv.onrender.com/')
  })

  it.each(['/admin', '/admin/journal', '/admin/finance', '/admin/work', '/tasks', '/weekly-reset'])(
    'redirects a signed-out visitor away from %s',
    (path) => {
      renderAt(path)
      expect(pageTitle()).toBe(HOME_TITLE)
    },
  )

  it.each(['/admin', '/admin/training'])(
    'redirects a signed-in non-admin away from %s',
    (path) => {
      renderAt(path, GUEST_EMAIL)
      expect(pageTitle()).toBe(HOME_TITLE)
    },
  )

  it('does not show the dashboards link in the menu for guests', () => {
    renderAt('/')
    expect(screen.queryByRole('link', { name: 'Dashboards' })).toBeNull()
  })

  it.each([
    ['/cooking', 'Personal Sites'],
    ['/cooking/recipes', 'Personal Sites'],
  ])('redirects the retired route %s to %s', (path, expected) => {
    renderAt(path)
    expect(pageTitle()).toBe(expected)
  })

  it.each(['/mrpasionfruit', '/mrpasionfruit/oreo-gang', '/training', '/finances'])(
    'sends a guest home from the retired route %s',
    (path) => {
      renderAt(path)
      expect(pageTitle()).toBe(HOME_TITLE)
    },
  )
})

describe('admin routing', () => {
  it.each([
    ['/admin', 'Dashboards'],
    ['/admin/tasks', 'Tasks'],
    ['/admin/calendar', 'Calendar'],
    ['/admin/journal', 'Journal'],
    ['/admin/finance', 'Finance'],
    ['/admin/training', 'Training'],
    ['/admin/work', 'Work'],
  ])('renders %s for the admin account', (path, title) => {
    renderAt(path, ADMIN_EMAIL)
    expect(pageTitle()).toBe(title)
  })

  it('links every dashboard from the /admin hub', () => {
    renderAt('/admin', ADMIN_EMAIL)

    const hrefs = [...document.querySelectorAll('a.admin-tile')].map((link) =>
      link.getAttribute('href'),
    )

    expect(hrefs).toEqual([
      '/admin/tasks',
      '/admin/calendar',
      '/admin/journal',
      '/admin/finance',
      '/admin/training',
      '/admin/work',
    ])
  })

  it('sends the retired /training and /finances routes to their dashboards', () => {
    renderAt('/training', ADMIN_EMAIL)
    expect(pageTitle()).toBe('Training')

    cleanup()

    renderAt('/finances', ADMIN_EMAIL)
    expect(pageTitle()).toBe('Finance')
  })

  it('exposes the dashboards in the menu once signed in as admin', () => {
    renderAt('/', ADMIN_EMAIL)
    expect(screen.getAllByRole('link', { name: 'Dashboards' }).length).toBeGreaterThan(0)
  })
})
