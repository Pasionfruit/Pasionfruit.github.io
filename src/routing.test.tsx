// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => {
  const empty = () => vi.fn().mockResolvedValue([])
  return {
    getEvents: empty(),
    getTrainingRecords: empty(),
    getPersonalTraining: empty(),
    getGarminHealth: empty(),
    getRingconnHealth: empty(),
    getAppleHealth: empty(),
    getJournalEntries: empty(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    upsertTrainingRecord: vi.fn(),
    createJournalEntry: vi.fn(),
    updateJournalEntry: vi.fn(),
    deleteJournalEntry: vi.fn(),
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
import { adminDashboards, personalSiteEntries } from './siteContent'

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

/** The home page's h1 is the hero name. */
const HOME_TITLE = 'Abe Pasion'

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
  // Env stubs are per-test; without this they leak into every later test.
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('guest home page', () => {
  it('leads with the hero so the page names its owner above the fold', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { level: 1, name: 'Abe Pasion' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Abe Pasion, Data Analyst' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Résumé (PDF)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Email' })).toBeTruthy()
  })

  it('opens Experiences by default and leaves the others collapsed', () => {
    renderAt('/')

    const expanded = (id: string) =>
      document.querySelector(`#${id} .home-section-toggle`)?.getAttribute('aria-expanded')

    expect(expanded('experiences')).toBe('true')
    expect(expanded('personal-sites')).toBe('false')
    expect(expanded('gaming')).toBe('false')
    expect(expanded('training')).toBe('false')
  })

  it("shows guests today's workout, then the training log and countdown, read-only", async () => {
    const user = userEvent.setup()
    const today = new Date()
    repoMocks.getTrainingRecords.mockResolvedValueOnce([
      {
        training_id: 'today',
        date: `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`,
        morning_workout: '**Easy swim**\n• 4×50m free',
        evening_workout: 'Legs',
        completed_morning: false,
        completed_evening: false,
      },
    ])
    renderAt('/')

    const toggle = document.querySelector<HTMLButtonElement>('#training .home-section-toggle')
    if (!toggle) {
      throw new Error('Training section toggle not found')
    }
    await user.click(toggle)

    const section = document.getElementById('training')
    if (!section) {
      throw new Error('Training section not found')
    }
    const headings = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['Workout of the Day', 'Training Log', 'Next Event Countdown'])

    expect(await within(section).findByText('Easy swim')).toBeTruthy()
    expect(within(section).getByText('Legs')).toBeTruthy()
    // Morning and evening are the two columns, side by side.
    expect(within(section).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Morning',
      'Evening',
    ])
    const [workoutRow] = within(section).getAllByRole('row').slice(1)
    expect(within(workoutRow).getAllByRole('cell')).toHaveLength(2)
    // The log's own Garmin "today" panel would repeat the card above it.
    expect(within(section).queryByText('Workout(s) of the Day')).toBeNull()
    // Nothing here is editable for a guest.
    expect(section.querySelector('[title="Edit values"]')).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Mark Complete' })).toBeNull()
  })

  it('expands and re-collapses a section', async () => {
    const user = userEvent.setup()
    renderAt('/')

    const toggle = document.querySelector<HTMLButtonElement>('#gaming .home-section-toggle')
    if (!toggle) {
      throw new Error('Gaming section toggle not found')
    }

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('gaming-panel')?.hasAttribute('hidden')).toBe(false)

    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('gaming-panel')?.hasAttribute('hidden')).toBe(true)
  })

  it('keeps collapsed content in the DOM so it stays crawlable', () => {
    renderAt('/')

    // Present in the markup but hidden from the a11y tree, hence `hidden: true`.
    // This is the only indexed page on the site, so the content has to ship.
    expect(screen.getByRole('heading', { name: 'Professional Experience', hidden: true })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Try it', hidden: true }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Server Status', hidden: true })).toBeTruthy()
  })

  it('puts the resume downloads in the hero, not behind a section', () => {
    renderAt('/')

    const pdf = screen.getByRole('link', { name: 'Résumé (PDF)' })
    expect(pdf.getAttribute('href')).toBe('/files/abe-pasion-resume.pdf')
    expect(pdf.closest('.home-section-panel')).toBeNull()
    expect(pdf.closest('.home-hero')).not.toBeNull()
  })

  it('lists the deployed side projects with outbound links', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(document.querySelector<HTMLButtonElement>('#personal-sites .home-section-toggle')!)

    const hrefs = screen
      .getAllByRole('link', { name: 'Try it' })
      .map((link) => link.getAttribute('href'))

    // Derived from the content, so editing the project list cannot make this
    // assert a URL that no longer exists.
    expect(hrefs).toEqual(personalSiteEntries.map((entry) => entry.url))
    expect(hrefs.length).toBeGreaterThan(0)
  })

  it('puts the section note above the cards', () => {
    renderAt('/')

    const panel = document.getElementById('personal-sites-panel')
    const note = panel?.querySelector('.page-note')
    const grid = panel?.querySelector('.page-grid')

    if (!note || !grid) {
      throw new Error('Personal Sites note or card grid not found')
    }

    expect(note.textContent).toContain('free hosting tiers')
    expect(note.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows only the server cards under Gaming', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(document.querySelector<HTMLButtonElement>('#gaming .home-section-toggle')!)

    expect(screen.getByRole('heading', { name: 'Server Status' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'How to Connect' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Control Dashboard' })).toBeTruthy()

    // `hidden: true` so these assert real removal rather than just a collapsed panel.
    expect(screen.queryByRole('heading', { name: 'Player Insights', hidden: true })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Games I Like to Play', hidden: true })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Personally Developed Games', hidden: true })).toBeNull()
    expect(screen.queryByText(/Aternos is busy/)).toBeNull()
  })

  it('opens the section a /#anchor link points at', () => {
    renderAt('/#gaming')

    expect(document.querySelector('#gaming .home-section-toggle')?.getAttribute('aria-expanded')).toBe('true')
    // personal-sites is the one section not opened by default or by the anchor
    expect(
      document.querySelector('#personal-sites .home-section-toggle')?.getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('no longer offers a Studying page', () => {
    renderAt('/')

    // `hidden: true` — otherwise a collapsed panel would satisfy these trivially.
    expect(screen.queryByRole('heading', { name: 'Studying', hidden: true })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Actuary Exams', hidden: true })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Pomodoro Timer', hidden: true })).toBeNull()
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
  it('lands the admin on the daily dashboard at /', async () => {
    renderAt('/', ADMIN_EMAIL)

    expect(await screen.findByRole('heading', { name: 'Tasks of the Day' })).toBeTruthy()
    // Ace floats over the page rather than taking a card on it.
    expect(screen.getByRole('button', { name: 'Open Ace' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Assistant Ace' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Month View' })).toBeTruthy()
  })

  it('hides the public sections from the admin home page', () => {
    renderAt('/', ADMIN_EMAIL)

    for (const id of ['experiences', 'personal-sites', 'gaming']) {
      expect(document.getElementById(id)).toBeNull()
    }

    expect(screen.queryByRole('heading', { name: 'Professional Experience', hidden: true })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Try it', hidden: true })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Server Status', hidden: true })).toBeNull()
  })

  it('replaces the hamburger menu with the icon nav', () => {
    renderAt('/', ADMIN_EMAIL)

    expect(document.querySelector('.menu-toggle')).toBeNull()
    expect(document.getElementById('site-menu')).toBeNull()

    const labels = [...document.querySelectorAll('.admin-nav-link')].map((link) =>
      link.textContent?.trim(),
    )
    // Derived, not hardcoded: adding a dashboard should not fail this test.
    expect(labels).toEqual(adminDashboards.map((dashboard) => dashboard.title))
  })

  it('points each nav item at its dashboard', () => {
    renderAt('/', ADMIN_EMAIL)

    const hrefs = [...document.querySelectorAll('.admin-nav-link')].map((link) =>
      link.getAttribute('href'),
    )
    expect(hrefs).toEqual(adminDashboards.map((dashboard) => dashboard.path))
  })

  it.each([
    ['/admin/personal', 'Personal'],
    ['/admin/health', 'Health'],
  ])('renders %s for the admin account', (path, title) => {
    renderAt(path, ADMIN_EMAIL)
    expect(pageTitle()).toBe(title)
  })

  it.each(['/admin/finance', '/admin/work', '/admin/system', '/finances', '/mrpasionfruit/finances'])(
    'sends the removed dashboard %s back to home',
    async (path) => {
      renderAt(path, ADMIN_EMAIL)
      expect(await screen.findByRole('heading', { name: 'Tasks of the Day' })).toBeTruthy()
    },
  )

  it('lists only the remaining dashboards in the nav', () => {
    renderAt('/', ADMIN_EMAIL)

    const labels = [...document.querySelectorAll('.admin-nav-link')].map((link) => link.textContent?.trim())
    // News sits to the right of Health.
    expect(labels).toEqual(['Home', 'Personal', 'Health', 'News'])
  })

  it.each([
    ['/admin/journal', 'Personal'],
    ['/admin/training', 'Health'],
  ])('redirects the renamed route %s to %s', (path, title) => {
    renderAt(path, ADMIN_EMAIL)
    expect(pageTitle()).toBe(title)
  })

  it.each(['/admin', '/admin/tasks', '/admin/calendar'])(
    'folds %s back into the home dashboard',
    async (path) => {
      renderAt(path, ADMIN_EMAIL)
      expect(await screen.findByRole('heading', { name: 'Tasks of the Day' })).toBeTruthy()
    },
  )

  it('sends the retired /training route to the Health dashboard', () => {
    renderAt('/training', ADMIN_EMAIL)
    expect(pageTitle()).toBe('Health')
  })

  it('links the full task manager and weekly reset from home', () => {
    renderAt('/', ADMIN_EMAIL)

    const hrefs = [...document.querySelectorAll('.admin-quick-link')].map((link) =>
      link.getAttribute('href'),
    )
    expect(hrefs).toEqual(['/tasks', '/weekly-reset'])
  })

  it('shows those links as icons in the top right of Tasks of the Day', async () => {
    renderAt('/', ADMIN_EMAIL)

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const header = heading.closest('.section-card-header')
    if (!header) {
      throw new Error('Tasks of the Day header not found')
    }

    const tasks = within(header as HTMLElement).getByRole('link', { name: 'Full task manager' })
    const reset = within(header as HTMLElement).getByRole('link', { name: 'Weekly reset' })

    expect(tasks.textContent).toBe('')
    expect(reset.textContent).toBe('')
    expect(tasks.getAttribute('title')).toBe('Full task manager')
  })

  it('drops Milestones from Health and folds sleep into Daily wellness', async () => {
    renderAt('/admin/health', ADMIN_EMAIL)

    expect(await screen.findByRole('heading', { name: 'Daily wellness' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Milestones' })).toBeNull()
  })

  it('drops the Breathe and Sleep & recovery cards from Personal', async () => {
    renderAt('/admin/personal', ADMIN_EMAIL)

    expect(await screen.findByRole('heading', { name: 'Entries' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Breathe' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Sleep & recovery' })).toBeNull()
  })
})
