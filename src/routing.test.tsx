// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  // jsdom does not implement scrollIntoView; the hash-anchor effect calls it.
  Element.prototype.scrollIntoView = vi.fn()
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

describe('guest home page', () => {
  it('renders all three sections as collapsible blocks', () => {
    renderAt('/')

    for (const id of ['experiences', 'personal-sites', 'gaming']) {
      const section = document.getElementById(id)
      expect(section).not.toBeNull()
      expect(section?.querySelector('.home-section-toggle')?.getAttribute('aria-expanded')).toBe('true')
    }
  })

  it('collapses and re-expands a section', async () => {
    const user = userEvent.setup()
    renderAt('/')

    const toggle = document.querySelector<HTMLButtonElement>('#gaming .home-section-toggle')
    if (!toggle) {
      throw new Error('Gaming section toggle not found')
    }

    expect(document.getElementById('gaming-panel')).not.toBeNull()

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('gaming-panel')).toBeNull()

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('gaming-panel')).not.toBeNull()
  })

  it('shows the experience cards and resume downloads', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Education' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Technical Skills' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Professional Experience' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Download PDF' })).toBeTruthy()
  })

  it('lists the deployed side projects with outbound links', () => {
    renderAt('/')

    const hrefs = screen
      .getAllByRole('link', { name: 'Try it' })
      .map((link) => link.getAttribute('href'))

    expect(hrefs).toContain('https://pov-cooking.vercel.app/')
    expect(hrefs).toContain('https://texthero.onrender.com/')
    expect(hrefs).toContain('https://mahjong-xmhv.onrender.com/')
  })

  it('shows only the server cards under Gaming', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Server Status' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'How to Connect' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Control Dashboard' })).toBeTruthy()

    // Removed with the games lists and the player-stats sync.
    expect(screen.queryByRole('heading', { name: 'Player Insights' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Games I Like to Play' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Personally Developed Games' })).toBeNull()
  })

  it('no longer offers a Studying page', () => {
    renderAt('/')

    expect(screen.queryByRole('heading', { name: 'Studying' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Actuary Exams' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Pomodoro Timer' })).toBeNull()
  })

  it('links each section from the menu as an in-page anchor', () => {
    renderAt('/')

    const hrefs = [...document.querySelectorAll('.menu-main-link')].map((link) =>
      link.getAttribute('href'),
    )

    expect(hrefs).toContain('/#experiences')
    expect(hrefs).toContain('/#personal-sites')
    expect(hrefs).toContain('/#gaming')
  })
})

describe('guest routing', () => {
  it.each([
    '/experiences',
    '/experiences/studying',
    '/experience/studying',
    '/personal-sites',
    '/gaming',
    '/gaming/server',
    '/cooking',
    '/cooking/recipes',
    '/mrpasionfruit',
    '/mrpasionfruit/oreo-gang',
    '/training',
    '/finances',
    '/unknown',
  ])('sends %s back to the home page', (path) => {
    renderAt(path)
    expect(pageTitle()).toBe(HOME_TITLE)
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
