// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const repoMocks = vi.hoisted(() => ({
  getBucketList: vi.fn(),
  getCountries: vi.fn(),
  getPolls: vi.fn(),
  setBucketCompleted: vi.fn(),
  setCountryVisited: vi.fn(),
  createBucketItem: vi.fn(),
  updateBucketItem: vi.fn(),
  deleteBucketItem: vi.fn(),
  createCountry: vi.fn(),
  updateCountry: vi.fn(),
  deleteCountry: vi.fn(),
  createPoll: vi.fn(),
  deletePoll: vi.fn(),
}))

vi.mock('./data/sheets/repositories', () => repoMocks)
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

function renderAdminAboutMePage() {
  return render(
    <MemoryRouter initialEntries={['/mrpasionfruit']}>
      <App />
    </MemoryRouter>,
  )
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

  repoMocks.setBucketCompleted.mockResolvedValue(undefined)
  repoMocks.setCountryVisited.mockResolvedValue(undefined)
  repoMocks.createBucketItem.mockResolvedValue(undefined)
  repoMocks.updateBucketItem.mockResolvedValue(undefined)
  repoMocks.deleteBucketItem.mockResolvedValue(undefined)
  repoMocks.createCountry.mockResolvedValue(undefined)
  repoMocks.updateCountry.mockResolvedValue(undefined)
  repoMocks.deleteCountry.mockResolvedValue(undefined)
  repoMocks.createPoll.mockResolvedValue(undefined)
  repoMocks.deletePoll.mockResolvedValue(undefined)
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

  it('uses Add New Poll and creates a poll from the admin edit form', async () => {
    const user = userEvent.setup()
    renderAdminAboutMePage()

    const pollHeading = (await screen.findAllByRole('heading', { name: 'Personal interests/questions' }))[0]
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
})
