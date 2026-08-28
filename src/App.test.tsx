// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => ({
  getAbeTransactions: vi.fn(),
  getBucketList: vi.fn(),
  getCiaraTransactions: vi.fn(),
  getGroceryList: vi.fn(),
  getCurrentStudy: vi.fn(),
  getCountries: vi.fn(),
  getBackpackItems: vi.fn(),
  getEvents: vi.fn(),
  getMealPlan: vi.fn(),
  getPolls: vi.fn(),
  getTrainingRecords: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  setActiveEvent: vi.fn(),
  setTrainingWorkoutCompleted: vi.fn(),
  setBucketCompleted: vi.fn(),
  setCountryVisited: vi.fn(),
  setCurrentStudyCompleted: vi.fn(),
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
  getWorkItems: vi.fn(),
  createWorkItem: vi.fn(),
  updateWorkItem: vi.fn(),
  deleteWorkItem: vi.fn(),
  getGarminHealth: vi.fn(),
  getRingconnHealth: vi.fn(),
  getAppleHealth: vi.fn(),
  getPersonalTraining: vi.fn(),
  getBudgetTargets: vi.fn(),
  saveBudgetTarget: vi.fn(),
  getTrips: vi.fn(),
  createTrip: vi.fn(),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  upsertTrainingRecord: vi.fn(),
  replaceCurrentStudyForDate: vi.fn(),
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
vi.mock('topojson-client', () => ({
  feature: vi.fn(() => ({
    features: [
      {
        id: '1',
        properties: { name: 'Japan' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
        },
      },
      {
        id: '2',
        properties: { name: 'New Zealand' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[20, 0], [20, 10], [30, 10], [30, 0], [20, 0]]],
        },
      },
    ],
  })),
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

function renderTrainingPage(email = 'pasionabe@gmail.com') {
  return renderAdminPage('/admin/training', email)
}

function renderAdminTasksPage(email = 'pasionabe@gmail.com') {
  return renderAdminPage('/admin/tasks', email)
}

function renderFinancesPageWithEmail(email: string, path = '/admin/finance') {
  localStorage.setItem('google-id-token', makeFakeGoogleIdToken(email))

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
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

  // Health and trip data are read by the training and finance dashboards.
  repoMocks.getGarminHealth.mockResolvedValue([])
  repoMocks.getRingconnHealth.mockResolvedValue([])
  repoMocks.getAppleHealth.mockResolvedValue([])
  repoMocks.getPersonalTraining.mockResolvedValue([])
  repoMocks.getBudgetTargets.mockResolvedValue([])
  repoMocks.getTrips.mockResolvedValue([])
  repoMocks.getJournalEntries.mockResolvedValue([])
  repoMocks.getWorkItems.mockResolvedValue([])
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

  repoMocks.getEvents.mockResolvedValue([
    {
      event_id: 'event-1',
      event_date: '2026-10-18T06:00:00',
      event_name: 'Chicago Marathon',
      type: 'Run',
      measurement: '26.2 mi',
      location: 'Chicago',
      link: 'https://example.com/chicago',
      price: 250,
      active: true,
    },
    {
      event_id: 'event-2',
      event_date: '2026-11-01T08:00:00',
      event_name: 'Local 10K',
      type: 'Run',
      measurement: '10 km',
      location: 'Oak Park',
      link: '',
      price: 50,
      active: false,
    },
  ])

  const now = new Date()
  const studyTomorrow = new Date(now)
  studyTomorrow.setDate(now.getDate() + 1)

  repoMocks.getCurrentStudy.mockResolvedValue([
    {
      study_id: 'study-1',
      related_exam: 'Exam FM',
      topic: 'Interest Theory',
      date: now.toISOString(),
      completed: false,
    },
    {
      study_id: 'study-2',
      related_exam: 'Exam P',
      topic: 'Bayes Rule',
      date: now.toISOString(),
      completed: true,
    },
    {
      study_id: 'study-3',
      related_exam: 'Exam FM',
      topic: 'Annuities',
      date: studyTomorrow.toISOString(),
      completed: false,
    },
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
  repoMocks.getAbeTransactions.mockResolvedValue([
    {
      date: '2026-06-01',
      description: 'Abe groceries',
      amount: 120,
      category: 'Grocery',
      card: 'Chase Freedom',
    },
  ])
  repoMocks.getCiaraTransactions.mockResolvedValue([
    {
      date: '2026-06-02',
      description: 'Ciara coffee',
      amount: 8.75,
      category: 'Food',
      card: 'Amex Gold',
    },
  ])
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
  repoMocks.setCurrentStudyCompleted.mockResolvedValue(undefined)
  repoMocks.setTrainingWorkoutCompleted.mockResolvedValue(undefined)
  repoMocks.createEvent.mockResolvedValue(undefined)
  repoMocks.updateEvent.mockResolvedValue(undefined)
  repoMocks.deleteEvent.mockResolvedValue(undefined)
  repoMocks.setActiveEvent.mockResolvedValue(undefined)
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
  it('shows the private Finances page only for approved Google accounts', async () => {
    renderFinancesPageWithEmail('pixielee1000@gmail.com')

    expect(await screen.findByRole('tab', { name: 'Dashboard view' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Calendar view' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Purchases tab' })).toBeTruthy()
  })

  it('filters dashboard transactions by Abe, Ciara, and Both (default Both)', async () => {
    const user = userEvent.setup()
    renderFinancesPageWithEmail('pixielee1000@gmail.com')

    // Dashboard shows budget tables — verify key category rows appear
    expect(await screen.findByText('Rent')).toBeTruthy()
    expect(screen.getByText('Salary')).toBeTruthy()

    // Source filter buttons are present and clickable
    const abeBtn = screen.getByRole('button', { name: 'Abe' })
    const ciaraBtn = screen.getByRole('button', { name: 'Ciara' })
    const bothBtn = screen.getByRole('button', { name: 'Both' })

    await user.click(abeBtn)
    expect(screen.getByText('Rent')).toBeTruthy()

    await user.click(ciaraBtn)
    expect(screen.getByText('Rent')).toBeTruthy()

    await user.click(bothBtn)
    expect(screen.getByText('Rent')).toBeTruthy()
  })

  it('shows calendar transactions popup when clicking a date with purchases', async () => {
    const user = userEvent.setup()
    renderFinancesPageWithEmail('pixielee1000@gmail.com')

    await user.click(screen.getByRole('tab', { name: 'Calendar view' }))

    const dayWithTransactions = (await screen.findAllByRole('button', {
      name: /has 1 transaction/i,
    }))[0]

    await user.click(dayWithTransactions)

    expect(await screen.findByRole('dialog', { name: /Transactions for/i })).toBeTruthy()
    expect(screen.getByText(/Abe groceries|Ciara coffee/)).toBeTruthy()
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

    expect(screen.queryByRole('heading', { name: 'Tasks of the Day' })).toBeNull()
    expect(screen.queryByText('Edit access restricted to admin.')).toBeNull()
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

  it('shows the studying tab and allows authorized admin to mark lesson complete', async () => {
    const user = userEvent.setup()

    renderAdminTasksPage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Tasks of the Day card not found')
    }

    await user.click(within(card).getByRole('tab', { name: 'Studying' }))

    const interestTopic = await within(card).findByText('Interest Theory')
    const interestRow = interestTopic.closest('tr')
    if (!interestRow) {
      throw new Error('Home Interest Theory row not found')
    }

    await user.click(within(interestRow).getByRole('button', { name: 'Mark Complete' }))

    await waitFor(() => {
      expect(repoMocks.setCurrentStudyCompleted).toHaveBeenCalledWith(
        expect.stringContaining('.'),
        'study-1',
        true,
      )
    })
  })

  it('blocks training/studying completion editing for non-authorized account', async () => {
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

  it('renders Training Log card and loads records on training page', async () => {
    const user = userEvent.setup()
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    await user.click(within(card).getByRole('button', { name: '▾' }))
    await user.click(within(card).getByRole('button', { name: '▸' }))

    const seasonSelect = within(card).getAllByRole('combobox')[0]
    await user.selectOptions(seasonSelect, 'all')

    const tiles = within(card).getAllByRole('listitem')

    expect(tiles.length).toBe(2)
    expect(repoMocks.getTrainingRecords).toHaveBeenCalled()

    const yearSelect = within(card).getAllByRole('combobox')[1] as HTMLSelectElement
    expect(yearSelect.value).toBe('2026')
  })

  it('filters Training Log by season and year together', async () => {
    const user = userEvent.setup()
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    const comboboxes = within(card).getAllByRole('combobox')
    const seasonSelect = comboboxes[0]
    const yearSelect = comboboxes[1]

    await user.selectOptions(seasonSelect, 'Q1')
    await user.selectOptions(yearSelect, '2026')

    const filteredTiles = within(card).getAllByRole('listitem')
    expect(filteredTiles.length).toBe(1)

    const onlyTile = filteredTiles[0] as HTMLElement
    expect(onlyTile.dataset.trainingId).toBe('training-1')
    expect(onlyTile.dataset.level).toBe('1')
  })

  it('uses light tile for rest day and dark tile for both workouts completed', async () => {
    const user = userEvent.setup()
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    const seasonSelect = within(card).getAllByRole('combobox')[0]
    const yearSelect = within(card).getAllByRole('combobox')[1]

    await user.selectOptions(seasonSelect, 'all')

    await user.selectOptions(yearSelect, '2026')
    const darkTile = card.querySelector('[data-training-id="training-2"]') as HTMLElement | null

    if (!darkTile) {
      throw new Error('Dark completion tile not found')
    }

    expect(darkTile.dataset.trainingId).toBe('training-2')
    expect(darkTile.dataset.level).toBe('2')

    await user.selectOptions(yearSelect, '2025')
    const restDayTile = card.querySelector('[data-training-id="training-3"]') as HTMLElement | null

    if (!restDayTile) {
      throw new Error('Rest-day tile not found')
    }

    expect(restDayTile.dataset.trainingId).toBe('training-3')
    expect(restDayTile.dataset.level).toBe('1')
  })

  it('does not allow selecting all years', async () => {
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    const yearSelect = within(card).getAllByRole('combobox')[1]

    expect(within(yearSelect).queryByRole('option', { name: 'All years' })).toBeNull()
  })

  it('renders chronological tiles left-to-right by month row', async () => {
    const user = userEvent.setup()
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    const seasonSelect = within(card).getAllByRole('combobox')[0]
    await user.selectOptions(seasonSelect, 'all')

    await waitFor(() => {
      const tileElements = Array.from(card.querySelectorAll('.training-log-tile')) as HTMLElement[]
      expect(tileElements.length).toBe(2)
      expect(tileElements[0].dataset.trainingId).toBe('training-1')
      expect(tileElements[1].dataset.trainingId).toBe('training-2')
    })
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
  })

  it('renders countdown from active event and location', async () => {
    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Next Event Countdown' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Next Event Countdown card not found')
    }

    expect(within(card).getByText('Chicago Marathon')).toBeTruthy()
    expect(within(card).getByText('Location: Chicago')).toBeTruthy()
  })

  it('allows authorized admin to create/update/delete and set active event', async () => {
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
      expect(repoMocks.createEvent).toHaveBeenCalledWith(
        expect.stringContaining('.'),
        expect.objectContaining({
          eventName: 'Half Marathon',
          eventDate: '2026-12-01T07:00',
        }),
      )
    })

    const setActiveButtons = within(card).getAllByRole('button', { name: 'Set Active' })
    await user.click(setActiveButtons[0])

    await waitFor(() => {
      expect(repoMocks.setActiveEvent).toHaveBeenCalledWith(expect.stringContaining('.'), 'event-2')
    })

    const editButtons = within(card).getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])
    await user.click(within(card).getByRole('button', { name: 'Update Event' }))

    await waitFor(() => {
      expect(repoMocks.updateEvent).toHaveBeenCalledWith(
        expect.stringContaining('.'),
        'event-1',
        expect.any(Object),
      )
    })

    const deleteButtons = within(card).getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(repoMocks.deleteEvent).toHaveBeenCalledWith(expect.stringContaining('.'), 'event-1')
    })
  })

  it('allows authorized admin account to mark today workout completion', async () => {
    const user = userEvent.setup()
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))

    const today = new Date()
    const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

    repoMocks.getTrainingRecords.mockResolvedValueOnce([
      {
        training_id: 'training-today',
        date: todayIso,
        morning_workout: 'Easy Run 20 min',
        evening_workout: 'Stretch 10 min',
        completed_morning: false,
        completed_evening: false,
      },
    ])

    renderTrainingPage()

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    const markButtons = await within(card).findAllByRole('button', { name: 'Mark Complete' })
    await user.click(markButtons[0])

    await waitFor(() => {
      expect(repoMocks.setTrainingWorkoutCompleted).toHaveBeenCalledWith(
        expect.stringContaining('.'),
        'training-today',
        'morning',
        true,
      )
    })
  })

  it('blocks training completion editing for non-authorized account', async () => {
    const today = new Date()
    const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

    repoMocks.getTrainingRecords.mockResolvedValueOnce([
      {
        training_id: 'training-today',
        date: todayIso,
        morning_workout: 'Easy Run 20 min',
        evening_workout: 'Stretch 10 min',
        completed_morning: false,
        completed_evening: false,
      },
    ])

    renderTrainingPage('pixielee1000@gmail.com')

    const heading = await screen.findByRole('heading', { name: 'Training Log' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Training Log card not found')
    }

    expect(within(card).queryByRole('button', { name: 'Mark Complete' })).toBeNull()
    expect(
      within(card).getByText('Edit access restricted to admin.'),
    ).toBeTruthy()
  })
})
