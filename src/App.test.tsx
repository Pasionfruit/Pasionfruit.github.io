// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => ({
  getBucketList: vi.fn(),
  getGroceryList: vi.fn(),
  getCountries: vi.fn(),
  getBackpackItems: vi.fn(),
  getEvents: vi.fn(),
  getMealPlan: vi.fn(),
  getPolls: vi.fn(),
  getTrainingRecords: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  setTrainingWorkoutCompleted: vi.fn(),
  setBucketCompleted: vi.fn(),
  setCountryVisited: vi.fn(),
  createBucketItem: vi.fn(),
  createGroceryListItem: vi.fn(),
  updateBucketItem: vi.fn(),
  updateGroceryListItem: vi.fn(),
  deleteBucketItem: vi.fn(),
  deleteGroceryListItem: vi.fn(),
  createCountry: vi.fn(),
  updateCountry: vi.fn(),
  deleteCountry: vi.fn(),
  updateBackpackItem: vi.fn(),
  updateMealPlan: vi.fn(),
  createPoll: vi.fn(),
  deletePoll: vi.fn(),
  getJournalEntries: vi.fn(),
  createJournalEntry: vi.fn(),
  updateJournalEntry: vi.fn(),
  deleteJournalEntry: vi.fn(),
  getGarminHealth: vi.fn(),
  getRingconnHealth: vi.fn(),
  getAppleHealth: vi.fn(),
  getPersonalTraining: vi.fn(),
  upsertTrainingRecord: vi.fn(),
}))

const todoistMocks = vi.hoisted(() => ({
  getTasksOfTheDay: vi.fn(),
  getActiveTasks: vi.fn(),
  getProjects: vi.fn(),
  getSections: vi.fn(),
  createTask: vi.fn(),
  createTaskDetailed: vi.fn(),
  updateTask: vi.fn(),
  rescheduleTask: vi.fn(),
  closeTask: vi.fn(),
  deleteTask: vi.fn(),
  getCompletedTasks: vi.fn(),
}))

vi.mock('./data/sheets/repositories', () => repoMocks)
vi.mock('./data/todoist/repositories', () => todoistMocks)
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Google Login</button>,
}))

import App from './App'

vi.stubEnv('VITE_TODOIST_API_TOKEN', 'test-todoist-token')

/** /admin/* is admin-gated, so every dashboard render has to sign in first. */
function renderAdminPage(path: string, email = 'pasionabe@gmail.com') {
  localStorage.setItem('demo-profile', 'admin')
  localStorage.setItem('google-id-token', makeFakeGoogleIdToken(email))

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** A datetime-local string `days` from now at 7am, the format the countdown stores. */
function eventDateInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T07:00`
}

function renderTrainingPage(email = 'pasionabe@gmail.com') {
  return renderAdminPage('/admin/health', email)
}

function renderAdminTasksPage(email = 'pasionabe@gmail.com') {
  return renderAdminPage('/admin/tasks', email)
}

function makeFakeGoogleIdToken(email: string) {
  const header = { alg: 'none', typ: 'JWT' }
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  }

  const toBase64Url = (value: object) =>
    window
      .btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')

  return `${toBase64Url(header)}.${toBase64Url(payload)}.signature`
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('demo-profile', 'admin')
  localStorage.setItem('google-id-token', 'valid-token')

  vi.stubGlobal('matchMedia',
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

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch,
  )

  // Health data is read by the training dashboard.
  repoMocks.getGarminHealth.mockResolvedValue([])
  repoMocks.getRingconnHealth.mockResolvedValue([])
  repoMocks.getAppleHealth.mockResolvedValue([])
  repoMocks.getPersonalTraining.mockResolvedValue([])
  repoMocks.getJournalEntries.mockResolvedValue([])
  todoistMocks.getCompletedTasks.mockResolvedValue([])

  repoMocks.getBucketList.mockResolvedValue([
    {
      bucket_id: 'bucket-1',
      item: 'Build a terrarium',
      completed_date: '',
      completed: false,
    },
    {
      bucket_id: 'bucket-2',
      item: 'Visit New Zealand',
      completed_date: '2026-01-02T00:00:00.000Z',
      completed: true,
    },
  ])

  repoMocks.getCountries.mockResolvedValue([
    {
      country_id: 'country-1',
      country_state_name: 'Japan',
      visited_date: '2026-01-02T00:00:00.000Z',
      visited: true,
    },
    {
      country_id: 'country-2',
      country_state_name: 'New Zealand',
      visited_date: '',
      visited: false,
    },
  ])

  repoMocks.getBackpackItems.mockResolvedValue([
    {
      storage: 'Carry-on',
      type: 'Clothing',
      item: 'Socks',
      quantity: '4',
    },
    {
      storage: 'Checked bag',
      type: 'Toiletries',
      item: 'Toothbrush',
      quantity: '1',
    },
    {
      storage: 'Carry-on',
      type: 'Tech',
      item: 'Charger',
      quantity: '2',
    },
  ])

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  repoMocks.getMealPlan.mockResolvedValue([
    {
      day_of_the_week: today.toLocaleDateString('en-US', { weekday: 'long' }),
      breakfast: 'Greek yogurt bowl',
      lunch: 'Chicken wrap',
      dinner: 'Salmon rice bowl',
      snack: 'Protein bar',
    },
    {
      day_of_the_week: tomorrow.toLocaleDateString('en-US', { weekday: 'long' }),
      breakfast: 'Overnight oats',
      lunch: 'Turkey sandwich',
      dinner: 'Pasta night',
      snack: 'Trail mix',
    },
    {
      day_of_the_week: yesterday.toLocaleDateString('en-US', { weekday: 'long' }),
      breakfast: 'Egg tacos',
      lunch: 'Burrito bowl',
      dinner: 'Soup and toast',
      snack: 'Fruit cup',
    },
  ])

  repoMocks.getPolls.mockResolvedValue([
    {
      poll_id: 'poll-1',
      created_date: '2026-01-01T00:00:00.000Z',
      question: 'What should I build next?',
      option_a: 'Garden',
      option_b: 'NAS',
      option_a_votes: 2,
      option_b_votes: 5,
      total_votes: 7,
      winning_option: 'B',
    },
  ])

  // Relative to today, so "upcoming" stays true whenever the suite runs.
  repoMocks.getEvents.mockResolvedValue([
    { event_id: 'event-2', event_name: 'Turkey Trot', event_date: eventDateInDays(50) },
    { event_id: 'event-1', event_name: 'Chicago Marathon', event_date: eventDateInDays(12) },
    { event_id: 'event-0', event_name: 'Spring 10K', event_date: eventDateInDays(-30) },
  ])

  repoMocks.getTrainingRecords.mockResolvedValue([
    {
      training_id: 'training-1',
      date: '2026-01-15',
      morning_workout: 'Easy Run 5k',
      evening_workout: 'Mobility',
      completed_morning: true,
      completed_evening: false,
    },
    {
      training_id: 'training-2',
      date: '2026-08-06',
      morning_workout: 'Intervals',
      evening_workout: 'Core',
      completed_morning: true,
      completed_evening: true,
    },
    {
      training_id: 'training-3',
      date: '2025-11-10',
      morning_workout: 'Rest Day',
      evening_workout: 'Stretching',
      completed_morning: false,
      completed_evening: false,
    },
  ])

  repoMocks.setBucketCompleted.mockResolvedValue(undefined)
  repoMocks.getGroceryList.mockResolvedValue([
    {
      type: 'MEAT',
      item: 'Chicken breast',
      completed: true,
      include: true,
    },
    {
      type: 'DAIRY',
      item: 'Greek yogurt',
      completed: false,
      include: false,
    },
  ])
  repoMocks.setCountryVisited.mockResolvedValue(undefined)
  repoMocks.setTrainingWorkoutCompleted.mockResolvedValue(undefined)
  repoMocks.createEvent.mockResolvedValue(undefined)
  repoMocks.updateEvent.mockResolvedValue(undefined)
  repoMocks.deleteEvent.mockResolvedValue(undefined)
  repoMocks.createBucketItem.mockResolvedValue(undefined)
  repoMocks.createGroceryListItem.mockResolvedValue(undefined)
  repoMocks.updateBucketItem.mockResolvedValue(undefined)
  repoMocks.updateGroceryListItem.mockResolvedValue(undefined)
  repoMocks.deleteBucketItem.mockResolvedValue(undefined)
  repoMocks.deleteGroceryListItem.mockResolvedValue(undefined)
  repoMocks.createCountry.mockResolvedValue(undefined)
  repoMocks.updateCountry.mockResolvedValue(undefined)
  repoMocks.deleteCountry.mockResolvedValue(undefined)
  repoMocks.updateBackpackItem.mockResolvedValue(undefined)
  repoMocks.updateMealPlan.mockResolvedValue(undefined)
  repoMocks.createPoll.mockResolvedValue(undefined)
  repoMocks.deletePoll.mockResolvedValue(undefined)

  todoistMocks.getTasksOfTheDay.mockResolvedValue([
    {
      id: 'todo-1',
      content: 'Submit dashboard update',
      description: 'Include KPI updates and rollout notes',
      priority: 2,
      is_completed: false,
      due: { date: '2026-05-21' },
    },
    {
      id: 'todo-2',
      content: 'Review overdue notes',
      description: '',
      priority: 4,
      is_completed: false,
      due: { date: '2026-05-20' },
    },
  ])
  todoistMocks.getActiveTasks.mockResolvedValue([])
  todoistMocks.getProjects.mockResolvedValue([])
  todoistMocks.getSections.mockResolvedValue([])
  todoistMocks.createTask.mockResolvedValue(undefined)
  todoistMocks.createTaskDetailed.mockResolvedValue(undefined)
  todoistMocks.updateTask.mockResolvedValue(undefined)
  todoistMocks.rescheduleTask.mockResolvedValue(undefined)
  todoistMocks.closeTask.mockResolvedValue(undefined)
  todoistMocks.deleteTask.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('site sections and dashboards', () => {
  it('floats the Ace launcher over admin pages, and nowhere for guests', async () => {
    renderAdminPage('/admin/health')
    expect(await screen.findByRole('button', { name: 'Open Ace' })).toBeTruthy()
    // Ace is no longer a card on the home dashboard.
    expect(screen.queryByRole('heading', { name: 'Assistant Ace' })).toBeNull()
    cleanup()

    // Signed in, but not as the admin.
    renderAdminPage('/', 'someoneelse@gmail.com')
    expect(screen.queryByRole('button', { name: 'Open Ace' })).toBeNull()
  })

  it('shows the Home Todoist summary with overdue counts and supports completing a task', async () => {
    const user = userEvent.setup()
    renderAdminTasksPage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Todoist card not found')
    }

    expect(await within(card).findByText('Submit dashboard update')).toBeTruthy()
    expect(within(card).getByText('Review overdue notes')).toBeTruthy()

    // The summary is read-and-complete only; editing lives on /tasks now.
    expect(within(card).queryByPlaceholderText('Task name')).toBeNull()
    expect(within(card).getByRole('link', { name: /Open all tasks/ })).toBeTruthy()

    await user.click(within(card).getByRole('button', { name: 'Complete: Submit dashboard update' }))

    await waitFor(() => {
      expect(todoistMocks.closeTask).toHaveBeenCalledWith('todo-1')
    })
  })

  it('blocks Todoist editing for non-authorized account', async () => {
    renderAdminTasksPage('pixielee1000@gmail.com')

    /*
     * The admin shell is gated on the stored profile, so a non-editor account
     * still reaches the dashboard — it is the write path that is closed. The
     * card renders, and says so in place of the editing controls.
     */
    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Tasks of the Day card not found')
    }

    expect(within(card).getByText('Edit access restricted to admin.')).toBeTruthy()
  })

  it('shows missing token guidance when Todoist env token is not set', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_TODOIST_API_TOKEN', '')
    renderAdminTasksPage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Todoist card not found')
    }

    // The card opens on the Todoist tab for admins; the guidance shows without interaction.
    expect(
      await within(card).findByText('Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.'),
    ).toBeTruthy()

    vi.stubEnv('VITE_TODOIST_API_TOKEN', 'test-todoist-token')
  })

  it('shows the training tab and allows authorized admin to mark workout complete', async () => {
    const user = userEvent.setup()

    const today = new Date()
    const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

    repoMocks.getTrainingRecords.mockResolvedValueOnce([
      {
        training_id: 'home-training-today',
        date: todayIso,
        morning_workout: 'Easy Run 20 min',
        evening_workout: 'Stretch 10 min',
        completed_morning: false,
        completed_evening: false,
      },
    ])

    renderAdminTasksPage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Tasks of the Day card not found')
    }

    // Todoist is the default view; training sits behind its own tab.
    await user.click(within(card).getByRole('tab', { name: 'Training' }))

    const markButtons = await within(card).findAllByRole('button', { name: 'Mark Complete' })
    await user.click(markButtons[0])

    await waitFor(() => {
      expect(repoMocks.setTrainingWorkoutCompleted).toHaveBeenCalledWith(
        expect.stringContaining('.'),
        'home-training-today',
        'morning',
        true,
      )
    })
  })

  it('no longer offers a Studying tab on Tasks of the Day', async () => {
    renderAdminTasksPage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Tasks of the Day card not found')
    }

    expect(within(card).getByRole('tab', { name: 'Training' })).toBeTruthy()
    expect(within(card).queryByRole('tab', { name: 'Studying' })).toBeNull()
  })

  it('blocks training completion editing for non-authorized account', async () => {
    const today = new Date()
    const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

    repoMocks.getTrainingRecords.mockResolvedValueOnce([
      {
        training_id: 'home-training-today',
        date: todayIso,
        morning_workout: 'Easy Run 20 min',
        evening_workout: 'Stretch 10 min',
        completed_morning: false,
        completed_evening: false,
      },
    ])

    renderAdminTasksPage('pixielee1000@gmail.com')

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Tasks of the Day card not found')
    }

    expect(within(card).queryByRole('button', { name: 'Mark Complete' })).toBeNull()
    expect(
      within(card).getByText('Edit access restricted to admin.'),
    ).toBeTruthy()
  })

  /*
   * The log is a contribution calendar built from Garmin *activities*, one tile
   * per day of the selected year whether or not anything was recorded. A day's
   * tile id is its date key, and its level is how many activities it holds.
   *
   * Fixtures sit in past years so they are never in the future — the grid stops
   * at today, so a current-year date would only exist for part of the year.
   */
  const LAST_YEAR = new Date().getFullYear() - 1
  const TWO_YEARS_AGO = LAST_YEAR - 1
  const TWO_ACTIVITY_DAY = `${LAST_YEAR}-01-15`
  const ONE_ACTIVITY_DAY = `${LAST_YEAR}-03-03`
  const EARLIER_YEAR_DAY = `${TWO_YEARS_AGO}-11-10`

  function seedGarminActivities() {
    const activity = (date: string, title: string) => ({
      date,
      activity_type: 'running',
      title,
      distance_mi: '3.1',
      duration_min: '30',
      avg_hr: '145',
      max_hr: '170',
      calories: '300',
      tss: '40',
    })

    repoMocks.getGarminHealth.mockResolvedValue([
      activity(TWO_ACTIVITY_DAY, 'Morning Run'),
      activity(TWO_ACTIVITY_DAY, 'Evening Shakeout'),
      activity(ONE_ACTIVITY_DAY, 'Tempo Run'),
      activity(EARLIER_YEAR_DAY, 'Long Run'),
    ])
  }

  function findTrainingLogCard() {
    const heading = screen.getByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }
    return card as HTMLElement
  }

  function tile(card: HTMLElement, dateKey: string) {
    return card.querySelector(`[data-training-id="${dateKey}"]`) as HTMLElement | null
  }

  async function openTrainingLogAtYear(year: number) {
    const user = userEvent.setup()
    seedGarminActivities()
    renderTrainingPage()

    await screen.findByRole('heading', { name: 'Training Log' })
    const card = findTrainingLogCard()
    await waitFor(() => expect(repoMocks.getGarminHealth).toHaveBeenCalled())

    const yearPicker = within(card).getByRole('listbox', { name: 'Select year' })
    await user.click(await within(yearPicker).findByRole('option', { name: String(year) }))

    return { card, user }
  }

  it('renders Training Log card and loads records on training page', async () => {
    seedGarminActivities()
    renderTrainingPage()

    await screen.findByRole('heading', { name: 'Training Log' })
    const card = findTrainingLogCard()

    await waitFor(() => expect(repoMocks.getGarminHealth).toHaveBeenCalled())

    // Opens on the current year even when every activity is older.
    const yearPicker = within(card).getByRole('listbox', { name: 'Select year' })
    const selected = within(yearPicker).getAllByRole('option', { selected: true })
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toBe(String(new Date().getFullYear()))

    // The years that do have activity are offered alongside it.
    await waitFor(() =>
      expect(within(yearPicker).getByRole('option', { name: String(LAST_YEAR) })).toBeTruthy(),
    )
  })

  it('filters Training Log tiles by the selected year', async () => {
    const { card, user } = await openTrainingLogAtYear(LAST_YEAR)

    await waitFor(() => expect(tile(card, TWO_ACTIVITY_DAY)).toBeTruthy())
    expect(tile(card, ONE_ACTIVITY_DAY)).toBeTruthy()
    // A day from another year is not in this year's grid.
    expect(tile(card, EARLIER_YEAR_DAY)).toBeNull()

    const yearPicker = within(card).getByRole('listbox', { name: 'Select year' })
    await user.click(within(yearPicker).getByRole('option', { name: String(TWO_YEARS_AGO) }))

    await waitFor(() => expect(tile(card, EARLIER_YEAR_DAY)).toBeTruthy())
    await waitFor(() => expect(tile(card, TWO_ACTIVITY_DAY)).toBeNull(), { timeout: 2000 })
    expect(tile(card, ONE_ACTIVITY_DAY)).toBeNull()
  })

  it('uses light tile for one activity and dark tile for two in a day', async () => {
    const { card } = await openTrainingLogAtYear(LAST_YEAR)

    // Two activities in a day reads as the darkest level.
    await waitFor(() => expect(tile(card, TWO_ACTIVITY_DAY)?.dataset.level).toBe('2'))
    // One activity is the lighter level.
    expect(tile(card, ONE_ACTIVITY_DAY)?.dataset.level).toBe('1')
    // A day with nothing recorded still gets a tile, at the empty level.
    expect(tile(card, `${LAST_YEAR}-03-04`)?.dataset.level).toBe('0')
  })

  it('does not allow selecting all years', async () => {
    seedGarminActivities()
    renderTrainingPage()

    await screen.findByRole('heading', { name: 'Training Log' })
    const card = findTrainingLogCard()

    const yearPicker = within(card).getByRole('listbox', { name: 'Select year' })
    expect(within(yearPicker).queryByRole('option', { name: /all years/i })).toBeNull()
    for (const option of within(yearPicker).getAllByRole('option')) {
      expect(option.textContent).toMatch(/^\d{4}$/)
    }
  })

  it('renders chronological tiles left-to-right by month row', async () => {
    const { card } = await openTrainingLogAtYear(LAST_YEAR)

    await waitFor(() => expect(tile(card, TWO_ACTIVITY_DAY)).toBeTruthy())

    // January's day has to precede March's in document order, and each day
    // must appear exactly once.
    const ids = Array.from(card.querySelectorAll('.training-log-tile'))
      .map((el) => (el as HTMLElement).dataset.trainingId)
      .filter((id): id is string => id === TWO_ACTIVITY_DAY || id === ONE_ACTIVITY_DAY)

    expect(ids).toEqual([TWO_ACTIVITY_DAY, ONE_ACTIVITY_DAY])
  })

  it('shows countdown edit fields only after pressing pencil in admin view', async () => {
    const user = userEvent.setup()
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Next Event Countdown' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Next Event Countdown card not found')
    }

    expect(within(card).queryByLabelText('Event title')).toBeNull()
    expect(within(card).queryByLabelText('Event date')).toBeNull()

    await user.click(within(card).getByTitle('Edit values'))

    expect(within(card).getByLabelText('Event title')).toBeTruthy()
    expect(within(card).getByLabelText('Event date')).toBeTruthy()
    // Title and date are the whole event now.
    expect(within(card).queryByLabelText('Location')).toBeNull()
    expect(within(card).queryByLabelText('Type')).toBeNull()
  })

  it('counts down to the soonest event still ahead', async () => {
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Next Event Countdown' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Next Event Countdown card not found')
    }

    // Not the past Spring 10K, and not the later Turkey Trot.
    expect(await within(card).findByText('Chicago Marathon')).toBeTruthy()
    expect(within(card).queryByText('Spring 10K')).toBeNull()
    expect(within(card).queryByText('Turkey Trot')).toBeNull()
  })

  it('says so when no event is ahead', async () => {
    repoMocks.getEvents.mockResolvedValueOnce([
      { event_id: 'event-0', event_name: 'Spring 10K', event_date: eventDateInDays(-30) },
    ])
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Next Event Countdown' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Next Event Countdown card not found')
    }

    expect(await within(card).findByText(/^No upcoming event\./)).toBeTruthy()
  })

  it('lets the admin add, edit, and delete events by title and date', async () => {
    const user = userEvent.setup()
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Next Event Countdown' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Next Event Countdown card not found')
    }

    await user.click(within(card).getByTitle('Edit values'))

    await user.type(within(card).getByLabelText('Event title'), 'Half Marathon')
    await user.type(within(card).getByLabelText('Event date'), '2026-12-01T07:00')
    await user.click(within(card).getByRole('button', { name: 'Add Event' }))

    await waitFor(() => {
      expect(repoMocks.createEvent).toHaveBeenCalledWith(expect.stringContaining('.'), {
        eventName: 'Half Marathon',
        eventDate: '2026-12-01T07:00',
      })
    })

    await user.click(within(card).getByRole('button', { name: 'Edit Chicago Marathon' }))
    expect((within(card).getByLabelText('Event title') as HTMLInputElement).value).toBe('Chicago Marathon')
    await user.click(within(card).getByRole('button', { name: 'Update Event' }))

    await waitFor(() => {
      expect(repoMocks.updateEvent).toHaveBeenCalledWith(expect.stringContaining('.'), 'event-1', {
        eventName: 'Chicago Marathon',
        eventDate: eventDateInDays(12),
      })
    })

    await user.click(within(card).getByRole('button', { name: 'Delete Spring 10K' }))

    await waitFor(() => {
      expect(repoMocks.deleteEvent).toHaveBeenCalledWith(expect.stringContaining('.'), 'event-0')
    })
  })

  it('fills the week from a pasted Markdown plan, then saves the filled days', async () => {
    const user = userEvent.setup()
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    // Relative to today, so both rows always land inside the seven days shown.
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    const sheetDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`

    renderAdminPage('/weekly-reset')

    const heading = await screen.findByRole('heading', { name: 'Workouts for the Week' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Workouts for the Week card not found')
    }

    await user.click(within(card).getByTitle('Edit values'))
    await user.click(within(card).getByRole('button', { name: 'Paste plan' }))
    await user.click(within(card).getByLabelText(/Paste a/))
    await user.paste(
      [
        '| Day | Morning | Evening |',
        '|---|---|---|',
        `| ${names[tomorrow.getDay()]} | **Easy swim**<br>• 100m breast<br>• 4×50m free | Legs |`,
        `| ${names[dayAfter.getDay()]} | **Quality run**<br>• 10min easy | Chest & Back |`,
      ].join('\n'),
    )
    await user.click(within(card).getByRole('button', { name: 'Fill table' }))

    expect(within(card).getByRole('status').textContent).toMatch(/^Filled .+ – .+\. Review, then Save workouts\.$/)
    const tomorrowName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' })
    expect(
      (within(card).getByLabelText(`${tomorrowName} morning workout`) as HTMLTextAreaElement).value,
    ).toBe('**Easy swim**\n• 100m breast\n• 4×50m free')

    await user.click(within(card).getByRole('button', { name: 'Save workouts' }))

    await waitFor(() => {
      expect(repoMocks.upsertTrainingRecord).toHaveBeenCalledWith(expect.stringContaining('.'), {
        date: sheetDate(tomorrow),
        morningWorkout: '**Easy swim**\n• 100m breast\n• 4×50m free',
        eveningWorkout: 'Legs',
      })
      expect(repoMocks.upsertTrainingRecord).toHaveBeenCalledWith(expect.stringContaining('.'), {
        date: sheetDate(dayAfter),
        morningWorkout: '**Quality run**\n• 10min easy',
        eveningWorkout: 'Chest & Back',
      })
    })
  })

})
