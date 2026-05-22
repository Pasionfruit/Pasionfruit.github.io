// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => ({
  getBucketList: vi.fn(),
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
  updateBucketItem: vi.fn(),
  deleteBucketItem: vi.fn(),
  createCountry: vi.fn(),
  updateCountry: vi.fn(),
  deleteCountry: vi.fn(),
  updateBackpackItem: vi.fn(),
  updateMealPlan: vi.fn(),
  createPoll: vi.fn(),
  deletePoll: vi.fn(),
}))

const todoistMocks = vi.hoisted(() => ({
  getTasksOfTheDay: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  closeTask: vi.fn(),
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

function renderAdminAboutMePage() {
  return render(
    <MemoryRouter initialEntries={['/mrpasionfruit']}>
      <App />
    </MemoryRouter>,
  )
}

function renderAdminStudyingPage() {
  return render(
    <MemoryRouter initialEntries={['/experiences/studying']}>
      <App />
    </MemoryRouter>,
  )
}

function renderHomePage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

function renderTrainingPage() {
  return render(
    <MemoryRouter initialEntries={['/training']}>
      <App />
    </MemoryRouter>,
  )
}

function renderCookingPage() {
  return render(
    <MemoryRouter initialEntries={['/cooking']}>
      <App />
    </MemoryRouter>,
  )
}

function renderCookingPlanPage() {
  return render(
    <MemoryRouter initialEntries={['/cooking/plan']}>
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

async function openPlacesVisitedEditor() {
  const user = userEvent.setup()
  renderAdminAboutMePage()

  const placesCards = await screen.findAllByRole('heading', { name: 'Places visited' })
  const placesCard = placesCards[0]
  const card = placesCard.closest('article')
  if (!card) {
    throw new Error('Places visited card not found')
  }

  await user.click(within(card).getByTitle('Edit values'))
  return { user, card }
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
      own_terms: 'Rates and discounting',
      problems_solved: 3,
      problems_worked: 6,
      completed: false,
    },
    {
      study_id: 'study-2',
      related_exam: 'Exam P',
      topic: 'Bayes Rule',
      date: now.toISOString(),
      own_terms: 'Conditional probability',
      problems_solved: 4,
      problems_worked: 5,
      completed: true,
    },
    {
      study_id: 'study-3',
      related_exam: 'Exam FM',
      topic: 'Annuities',
      date: studyTomorrow.toISOString(),
      own_terms: 'Present value',
      problems_solved: 8,
      problems_worked: 10,
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
  repoMocks.setCountryVisited.mockResolvedValue(undefined)
  repoMocks.setCurrentStudyCompleted.mockResolvedValue(undefined)
  repoMocks.setTrainingWorkoutCompleted.mockResolvedValue(undefined)
  repoMocks.createEvent.mockResolvedValue(undefined)
  repoMocks.updateEvent.mockResolvedValue(undefined)
  repoMocks.deleteEvent.mockResolvedValue(undefined)
  repoMocks.setActiveEvent.mockResolvedValue(undefined)
  repoMocks.createBucketItem.mockResolvedValue(undefined)
  repoMocks.updateBucketItem.mockResolvedValue(undefined)
  repoMocks.deleteBucketItem.mockResolvedValue(undefined)
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
  todoistMocks.createTask.mockResolvedValue(undefined)
  todoistMocks.updateTask.mockResolvedValue(undefined)
  todoistMocks.closeTask.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('admin about me page', () => {
  it('shows the guest-style Places visited card and opens the contained edit table', async () => {
    const { card, user } = await openPlacesVisitedEditor()
    const table = within(card).getByRole('table')

    expect(within(card).getByText('1 place visited')).toBeTruthy()
    expect(within(card).getByPlaceholderText('Filter by name')).toBeTruthy()
    expect(table).toBeTruthy()

    await user.type(within(card).getByPlaceholderText('Filter by name'), 'Japan')

    expect(within(table).getByDisplayValue('Japan')).toBeTruthy()
    expect(within(table).queryByDisplayValue('New Zealand')).toBeNull()
  })

  it('creates, updates, and deletes places from the contained admin table', async () => {
    const { card, user } = await openPlacesVisitedEditor()
    const table = within(card).getByRole('table')

    await user.clear(within(card).getByPlaceholderText('Filter by name'))

    await user.type(within(card).getByPlaceholderText('New place'), 'Portugal')
    await user.click(within(card).getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(repoMocks.createCountry).toHaveBeenCalledWith('valid-token', 'Portugal', false)
    })

    const japanInput = within(table).getByDisplayValue('Japan') as HTMLInputElement
    const japanRow = japanInput.closest('tr')
    if (!japanRow) {
      throw new Error('Japan row not found')
    }

    await user.clear(japanInput)
    await user.type(japanInput, 'Japan Updated')
    await user.click(within(japanRow).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(repoMocks.updateCountry).toHaveBeenCalledWith('valid-token', 'country-1', 'Japan Updated')
    })

    await user.click(within(japanRow).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(repoMocks.deleteCountry).toHaveBeenCalledWith('valid-token', 'country-1')
    })
  })

  it('shows Backpack table and filters by storage and type', async () => {
    const user = userEvent.setup()
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))
    renderAdminAboutMePage()

    const heading = await screen.findByRole('heading', { name: 'Backpack' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Backpack card not found')
    }

    expect(within(card).getByText('Socks')).toBeTruthy()
    expect(within(card).getByText('Toothbrush')).toBeTruthy()

    await user.selectOptions(within(card).getByLabelText('Filter by storage'), 'Carry-on')
    await user.selectOptions(within(card).getByLabelText('Filter by type'), 'Tech')

    expect(within(card).getByText('Charger')).toBeTruthy()
    expect(within(card).queryByText('Socks')).toBeNull()
    expect(within(card).queryByText('Toothbrush')).toBeNull()
  })

  it('allows authorized admin to edit Backpack fields except item', async () => {
    const user = userEvent.setup()
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))
    renderAdminAboutMePage()

    const heading = await screen.findByRole('heading', { name: 'Backpack' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Backpack card not found')
    }

    await user.click(within(card).getByTitle('Edit values'))

    const socksCell = within(card).getByText('Socks')
    const socksRow = socksCell.closest('tr')
    if (!socksRow) {
      throw new Error('Socks row not found')
    }

    const storageInput = within(socksRow).getByDisplayValue('Carry-on') as HTMLInputElement
    const typeInput = within(socksRow).getByDisplayValue('Clothing') as HTMLInputElement
    const quantityInput = within(socksRow).getByDisplayValue('4') as HTMLInputElement

    await user.clear(storageInput)
    await user.type(storageInput, 'Weekender')
    await user.clear(typeInput)
    await user.type(typeInput, 'Essentials')
    await user.clear(quantityInput)
    await user.type(quantityInput, '5')
    await user.click(within(socksRow).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(repoMocks.updateBackpackItem).toHaveBeenCalledWith(expect.stringContaining('.'), {
        originalStorage: 'Carry-on',
        originalType: 'Clothing',
        originalItem: 'Socks',
        storage: 'Weekender',
        type: 'Essentials',
        quantity: '5',
      })
    })
  })

  it('blocks Backpack edit mode for non-authorized account', async () => {
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('someoneelse@gmail.com'))
    renderAdminAboutMePage()

    const heading = await screen.findByRole('heading', { name: 'Backpack' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Backpack card not found')
    }

    expect(within(card).queryByTitle('Edit values')).toBeNull()
    expect(
      within(card).getByText('Edit access restricted to Admin profile signed in as pasionabe@gmail.com.'),
    ).toBeTruthy()
  })

  it('uses Add New Poll and creates a poll from the admin edit form', async () => {
    const user = userEvent.setup()
    renderAdminAboutMePage()

    const pollHeading = (await screen.findAllByRole('heading', { name: 'Question of the Day' }))[0]
    const card = pollHeading.closest('article')
    if (!card) {
      throw new Error('Poll card not found')
    }

    await user.click(within(card).getByTitle('Edit values'))

    expect(within(card).getByRole('button', { name: 'Add New Poll' })).toBeTruthy()

    await user.clear(within(card).getByLabelText('Question'))
    await user.type(within(card).getByLabelText('Question'), 'What should I build next?')
    await user.clear(within(card).getByLabelText('Option A'))
    await user.type(within(card).getByLabelText('Option A'), 'Garden')
    await user.clear(within(card).getByLabelText('Option B'))
    await user.type(within(card).getByLabelText('Option B'), 'NAS')

    await user.click(within(card).getByRole('button', { name: 'Add New Poll' }))

    await waitFor(() => {
      expect(repoMocks.createPoll).toHaveBeenCalledWith(
        'valid-token',
        'What should I build next?',
        'Garden',
        'NAS',
      )
    })
  })

  it('shows today meal plan on the cooking section and not another day by default', async () => {
    renderCookingPage()

    const heading = await screen.findByRole('heading', { name: 'Meal Plan for the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Meal Plan for the Day card not found')
    }

    expect(within(card).getByText('Greek yogurt bowl')).toBeTruthy()
    expect(within(card).getByText('Chicken wrap')).toBeTruthy()
    expect(within(card).getByText('Salmon rice bowl')).toBeTruthy()
    expect(within(card).getByText('Protein bar')).toBeTruthy()
    expect(within(card).queryByText('Overnight oats')).toBeNull()
    expect(within(card).queryByRole('button', { name: 'Show Weekly Plan' })).toBeNull()
    expect(within(card).queryByTitle('Edit values')).toBeNull()
  })

  it('shows expandable weekly meal plan table and allows authorized admin edits', async () => {
    const user = userEvent.setup()
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))
    renderCookingPlanPage()

    const heading = await screen.findByRole('heading', { name: 'Meal Plan for the Week' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Meal Plan for the Week card not found')
    }

    expect(within(card).getByTitle('Edit values')).toBeTruthy()

    await user.click(within(card).getByRole('button', { name: 'Show Weekly Plan' }))

    expect(within(card).getByText('Greek yogurt bowl')).toBeTruthy()
    expect(within(card).getByText('Overnight oats')).toBeTruthy()

    await user.click(within(card).getByTitle('Edit values'))

    const breakfastInput = within(card).getByDisplayValue('Greek yogurt bowl') as HTMLInputElement
    const row = breakfastInput.closest('tr')
    if (!row) {
      throw new Error('Meal plan row not found')
    }

    await user.clear(breakfastInput)
    await user.type(breakfastInput, 'Protein pancakes')
    await user.click(within(row).getByRole('button', { name: 'Save' }))

    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' })

    await waitFor(() => {
      expect(repoMocks.updateMealPlan).toHaveBeenCalledWith(expect.stringContaining('.'), {
        originalDayOfTheWeek: todayDay,
        dayOfTheWeek: todayDay,
        breakfast: 'Protein pancakes',
        lunch: 'Chicken wrap',
        dinner: 'Salmon rice bowl',
        snack: 'Protein bar',
      })
    })
  })

  it('blocks weekly meal plan editing for non-authorized account', async () => {
    const user = userEvent.setup()
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('someoneelse@gmail.com'))
    renderCookingPlanPage()

    const heading = await screen.findByRole('heading', { name: 'Meal Plan for the Week' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Meal Plan for the Week card not found')
    }

    await user.click(within(card).getByRole('button', { name: 'Show Weekly Plan' }))

    expect(within(card).queryByTitle('Edit values')).toBeNull()
    expect(
      within(card).getByText('Edit access restricted to Admin profile signed in as pasionabe@gmail.com.'),
    ).toBeTruthy()
  })

  it('filters Current Study Plan rows by related exam', async () => {
    const user = userEvent.setup()
    renderAdminStudyingPage()

    const heading = await screen.findByRole('heading', { name: 'Current Study Plan' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Current Study Plan card not found')
    }

    await user.click(within(card).getByRole('button', { name: 'Show Study Table' }))

    const combo = within(card).getByRole('combobox')
    await user.selectOptions(combo, 'Exam FM')

    const tables = within(card).getAllByRole('table')
    const studyTable = tables[1]

    expect(within(studyTable).getByText('Interest Theory')).toBeTruthy()
    expect(within(studyTable).getByText('Annuities')).toBeTruthy()
    expect(within(studyTable).queryByText('Bayes Rule')).toBeNull()
  })

  it('allows admin to mark today lesson completed or not completed', async () => {
    const user = userEvent.setup()
    renderAdminStudyingPage()

    const heading = await screen.findByRole('heading', { name: 'Current Study Plan' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Current Study Plan card not found')
    }

    const interestTopic = within(card).getByText('Interest Theory')
    const interestRow = interestTopic.closest('tr')
    if (!interestRow) {
      throw new Error('Interest Theory row not found')
    }

    const markCompleteButton = within(interestRow).getByRole('button', { name: 'Mark Complete' })
    await user.click(markCompleteButton)

    await waitFor(() => {
      expect(repoMocks.setCurrentStudyCompleted).toHaveBeenCalledWith('valid-token', 'study-1', true)
    })

    const bayesTopic = within(card).getByText('Bayes Rule')
    const bayesRow = bayesTopic.closest('tr')
    if (!bayesRow) {
      throw new Error('Bayes Rule row not found')
    }

    const markIncompleteButton = within(bayesRow).getByRole('button', { name: '✓ Completed' })
    await user.click(markIncompleteButton)

    await waitFor(() => {
      expect(repoMocks.setCurrentStudyCompleted).toHaveBeenCalledWith('valid-token', 'study-2', false)
    })
  })

  it('shows Home Todoist tasks and supports add, edit, and complete', async () => {
    const user = userEvent.setup()
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))
    renderHomePage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Todoist card not found')
    }

    await user.click(within(card).getByRole('button', { name: 'Show' }))

    expect(within(card).getByText('Submit dashboard update')).toBeTruthy()
    expect(within(card).getByText('Include KPI updates and rollout notes')).toBeTruthy()

    await user.click(within(card).getByTitle('Edit values'))

    expect(within(card).getByDisplayValue('Submit dashboard update')).toBeTruthy()

    await user.type(within(card).getByPlaceholderText('New task'), 'Plan weekend run')
    await user.selectOptions(within(card).getAllByRole('combobox')[0], '3')
    await user.click(within(card).getByRole('button', { name: 'Add Task' }))

    await waitFor(() => {
      expect(todoistMocks.createTask).toHaveBeenCalledWith('Plan weekend run', undefined, 3)
    })

    const firstTaskInput = within(card).getByDisplayValue('Submit dashboard update') as HTMLInputElement
    await user.clear(firstTaskInput)
    await user.type(firstTaskInput, 'Submit dashboard update v2')

    const descriptionInput = within(card).getByDisplayValue('Include KPI updates and rollout notes') as HTMLTextAreaElement
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Include KPI updates, rollout notes, and blockers')

    const row = firstTaskInput.closest('tr')
    if (!row) {
      throw new Error('Task row not found')
    }

    const dateInput = within(row).getByDisplayValue('2026-05-21')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-05-22')
    await user.click(within(row).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(todoistMocks.updateTask).toHaveBeenCalledWith('todo-1', {
        content: 'Submit dashboard update v2',
        description: 'Include KPI updates, rollout notes, and blockers',
        dueDate: '2026-05-22',
        priority: 2,
      })
    })

    await user.click(within(row).getByRole('button', { name: 'Complete' }))

    await waitFor(() => {
      expect(todoistMocks.closeTask).toHaveBeenCalledWith('todo-1')
    })
  })

  it('blocks Todoist editing for non-authorized account', async () => {
    const user = userEvent.setup()
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('someoneelse@gmail.com'))
    renderHomePage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Todoist card not found')
    }

    await user.click(within(card).getByRole('button', { name: 'Show' }))

    expect(
      within(card).getByText('Edit access restricted to Admin profile signed in as pasionabe@gmail.com.'),
    ).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Add Task' })).toBeNull()
  })

  it('shows missing token guidance when Todoist env token is not set', async () => {
    const user = userEvent.setup()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_TODOIST_API_TOKEN', '')

    renderHomePage()

    const heading = await screen.findByRole('heading', { name: 'Tasks of the Day' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Todoist card not found')
    }

    await user.click(within(card).getByRole('button', { name: 'Show' }))

    expect(
      await screen.findByText('Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.'),
    ).toBeTruthy()

    vi.stubEnv('VITE_TODOIST_API_TOKEN', 'test-todoist-token')
  })

  it('shows Home training table and allows authorized admin to mark workout complete', async () => {
    const user = userEvent.setup()
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))

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

    renderHomePage()

    const heading = await screen.findByRole('heading', { name: 'Training and Studying' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Home training/studying card not found')
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

  it('shows Home studying table and allows authorized admin to mark lesson complete', async () => {
    const user = userEvent.setup()
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))

    renderHomePage()

    const heading = await screen.findByRole('heading', { name: 'Training and Studying' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Home training/studying card not found')
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

  it('blocks Home training/studying completion editing for non-authorized account', async () => {
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('someoneelse@gmail.com'))

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

    renderHomePage()

    const heading = await screen.findByRole('heading', { name: 'Training and Studying' })
    const card = heading.closest('article')
    if (!card) {
      throw new Error('Home training/studying card not found')
    }

    expect(within(card).queryByRole('button', { name: 'Mark Complete' })).toBeNull()
    expect(
      within(card).getByText('Edit access restricted to Admin profile signed in as pasionabe@gmail.com.'),
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

    await user.click(within(card).getByRole('button', { name: 'Hide' }))
    await user.click(within(card).getByRole('button', { name: 'Show' }))

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
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))
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
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('pasionabe@gmail.com'))
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
    localStorage.setItem('demo-profile', 'admin')
    localStorage.setItem('google-id-token', makeFakeGoogleIdToken('someoneelse@gmail.com'))

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

    expect(within(card).queryByRole('button', { name: 'Mark Complete' })).toBeNull()
    expect(
      within(card).getByText('Edit access restricted to Admin profile signed in as pasionabe@gmail.com.'),
    ).toBeTruthy()
  })
})
