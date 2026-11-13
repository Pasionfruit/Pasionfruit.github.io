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
    getGarminWellness: empty(),
    getGarminPrs: empty(),
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
    // An Experiences tab that is not selected still ships its content.
    expect(screen.getByText('Florida State University, Tallahassee, FL')).toBeTruthy()
  })

  it('opens Experiences straight to work history, with education and skills as tabs', async () => {
    const user = userEvent.setup()
    renderAt('/')

    const section = document.getElementById('experiences')!
    expect(within(section).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Experience',
      'Education',
      'Skills',
    ])
    // No second layer of collapse: the roles are on screen as soon as the section is.
    expect(section.querySelector('.section-collapse-btn')).toBeNull()
    const work = within(section).getByRole('tabpanel', { name: 'Experience' })
    expect(within(work).getByText('Data Analyst - State Farm')).toBeTruthy()

    await user.click(within(section).getByRole('tab', { name: 'Education' }))

    expect(within(section).getByRole('tab', { name: 'Education' }).getAttribute('aria-selected')).toBe('true')
    const education = within(section).getByRole('tabpanel')
    expect(within(education).getByText('Florida State University, Tallahassee, FL')).toBeTruthy()
    expect(within(education).queryByText('Data Analyst - State Farm')).toBeNull()
  })

  it('lays Experiences out side by side on desktop, with no tabs or collapse buttons', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(min-width: 900px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    renderAt('/')

    const section = document.getElementById('experiences')!
    expect(within(section).queryAllByRole('tab')).toHaveLength(0)
    expect(section.querySelector('.section-collapse-btn')).toBeNull()
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Professional Experience', 'Education', 'Technical Skills'])
    // Skill details lose the content's "-   -" marker.
    expect(within(section).getByText(/^Excel\/Google Sheets/)).toBeTruthy()
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

  it('shows at most five tags per project', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(document.querySelector<HTMLButtonElement>('#personal-sites .home-section-toggle')!)

    const cards = document.querySelectorAll('#personal-sites .project-card')
    expect(cards.length).toBe(personalSiteEntries.length)
    for (const card of cards) {
      expect(card.querySelectorAll('.project-chip').length).toBeLessThanOrEqual(5)
    }
  })

  it('puts Training directly under Experiences', () => {
    renderAt('/')

    const order = [...document.querySelectorAll('.home-section')].map((section) => section.id)
    expect(order).toEqual(['experiences', 'training', 'personal-sites', 'gaming', 'challenges'])
  })

  it('opens Experiences with its summary as a short bullet list', () => {
    renderAt('/')

    const panel = document.getElementById('experiences-panel')!
    const points = within(panel).getAllByRole('listitem').filter((item) => item.closest('.page-summary-list'))
    expect(points.length).toBeGreaterThanOrEqual(2)
    expect(points.length).toBeLessThanOrEqual(3)
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
  it('lands the admin on Tasks at /', async () => {
    renderAt('/', ADMIN_EMAIL)

    expect(await screen.findByRole('heading', { name: 'Tasks of the Day' })).toBeTruthy()
    // Ace floats over the page rather than taking a card on it.
    expect(screen.getByRole('button', { name: 'Open Ace' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Assistant Ace' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Inbox' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Verse of the day' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calendar and Weather' })).toBeNull()
  })

  it('puts Tasks in the middle of the nav', () => {
    renderAt('/', ADMIN_EMAIL)

    const labels = [...document.querySelectorAll('.admin-nav-link')].map((link) => link.textContent?.trim())
    expect(labels[Math.floor(labels.length / 2)]).toBe('Tasks')
  })

  it.each([
    ['/admin/tasks', 'Tasks of the Day'],
    ['/admin/calendar', 'Calendar and Weather'],
  ])('renders %s as a bare page holding just %s', async (path, heading) => {
    renderAt(path, ADMIN_EMAIL)

    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
    expect(document.querySelector('.admin-bare')).toBeTruthy()
    // No page title block: the nav already names the page.
    expect(document.querySelector('.admin-page-head')).toBeNull()
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

  it('renders /admin/training for the admin account', () => {
    renderAt('/admin/training', ADMIN_EMAIL)
    expect(pageTitle()).toBe('Training')
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
    // Tasks is in the middle; wellness and WW + TG live on Boredom, the headlines on News.
    expect(labels).toEqual(['Calendar', 'Boredom', 'Tasks', 'Training', 'News'])
  })

  it.each(['/admin/journal', '/admin/personal'])('sends the removed Journal page %s to Tasks', async (path) => {
    renderAt(path, ADMIN_EMAIL)
    expect(await screen.findByRole('heading', { name: 'Tasks of the Day' })).toBeTruthy()
  })

  it('folds /admin into Tasks', async () => {
    renderAt('/admin', ADMIN_EMAIL)
    expect(await screen.findByRole('heading', { name: 'Tasks of the Day' })).toBeTruthy()
  })

  it('sends the retired /training route to the Training page', () => {
    renderAt('/training', ADMIN_EMAIL)
    expect(pageTitle()).toBe('Training')
  })

  it('links the weekly reset from Training and the full task manager from the Tasks page', async () => {
    renderAt('/admin/training', ADMIN_EMAIL)
    await screen.findByRole('heading', { name: 'Training of the Day' })
    const trainingHrefs = [...document.querySelectorAll('.admin-quick-link')].map((link) => link.getAttribute('href'))
    expect(trainingHrefs).toEqual(['/weekly-reset'])
    cleanup()

    renderAt('/admin/tasks', ADMIN_EMAIL)
    await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const taskHrefs = [...document.querySelectorAll('.admin-quick-link')].map((link) => link.getAttribute('href'))
    expect(taskHrefs).toEqual(['/tasks'])
  })

  it('shows the task manager link on Tasks of the Day, and the weekly reset on Training of the Day', async () => {
    const headerOf = async (name: string) => {
      const heading = await screen.findByRole('heading', { name })
      const header = heading.closest('.section-card-header')
      if (!header) {
        throw new Error(`${name} header not found`)
      }
      return header as HTMLElement
    }

    renderAt('/admin/tasks', ADMIN_EMAIL)
    const tasksHeader = await headerOf('Tasks of the Day')
    const tasks = within(tasksHeader).getByRole('link', { name: 'Full task manager' })
    expect(tasks.textContent).toBe('')
    expect(tasks.getAttribute('title')).toBe('Full task manager')
    expect(within(tasksHeader).queryByRole('link', { name: 'Weekly reset' })).toBeNull()

    cleanup()
    renderAt('/admin/training', ADMIN_EMAIL)
    const trainingHeader = await headerOf('Training of the Day')
    const reset = within(trainingHeader).getByRole('link', { name: 'Weekly reset' })
    expect(reset.textContent).toBe('')
    expect(reset.getAttribute('href')).toBe('/weekly-reset')
  })

  it('puts Training of the Day at the top of the Training page, above the workouts: no Milestones', async () => {
    renderAt('/admin/training', ADMIN_EMAIL)

    const today = await screen.findByRole('heading', { name: 'Training of the Day' })
    const workouts = await screen.findByRole('tab', { name: 'Workouts' })
    expect(today.compareDocumentPosition(workouts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(expect.arrayContaining(['Workouts', 'Runs', 'Swims', 'Bikes']))
    expect(tabs).not.toContain('Health')
    expect(tabs).not.toContain('News')
    expect(screen.queryByRole('heading', { name: 'Milestones' })).toBeNull()
    // Sleep & recovery lives on Overview's Health tab, not here.
    expect(screen.queryByRole('heading', { name: 'Daily wellness', level: 3 })).toBeNull()
  })

  it('switches the Training Log between its tiles and the PR board', async () => {
    const user = userEvent.setup()
    renderAt('/admin/training', ADMIN_EMAIL)

    const tiles = await screen.findByRole('button', { name: 'Tiles' })
    const prs = screen.getByRole('button', { name: 'PRs' })
    expect(tiles.getAttribute('aria-pressed')).toBe('true')

    await user.click(prs)

    expect(prs.getAttribute('aria-pressed')).toBe('true')
    // No PR tab yet in this fixture, which is what a site sees before the first sync.
    expect(await screen.findByText('Personal records arrive with the next Garmin sync.')).toBeTruthy()
  })

  it('brings Overview back as News, with the headlines', async () => {
    renderAt('/admin/news', ADMIN_EMAIL)
    expect(pageTitle()).toBe('News')
    expect(await screen.findByRole('heading', { name: 'Local' })).toBeTruthy()
    cleanup()

    renderAt('/admin/overview', ADMIN_EMAIL)
    expect(pageTitle()).toBe('News')
  })

  it.each(['/admin/health', '/admin/content', '/admin/ciara'])(
    'sends the retired %s to Boredom',
    async (path) => {
      renderAt(path, ADMIN_EMAIL)
      expect(await screen.findByRole('heading', { name: 'Verse of the day' })).toBeTruthy()
    },
  )

  it('shows WW + TG below the challenges on Boredom and sends /admin/ciara there', async () => {
    renderAt('/admin/ciara', ADMIN_EMAIL)

    const ciara = await screen.findByRole('heading', { name: 'WW + TG' })
    const challenges = screen.getByRole('heading', { name: '365 Challenges' })
    expect(challenges.compareDocumentPosition(ciara) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Chores' })).toBeNull()
  })

  it('puts the verse, daily wellness, the challenges and WW + TG on Boredom, with no news and no training', async () => {
    renderAt('/admin/boredom', ADMIN_EMAIL)

    expect(await screen.findByRole('heading', { name: 'Verse of the day' })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Daily wellness', level: 3 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '365 Challenges' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'WW + TG' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Local' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Training of the Day' })).toBeNull()
  })
})
