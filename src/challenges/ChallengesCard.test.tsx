// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const clientMocks = vi.hoisted(() => ({ rows: [] as unknown[], save: vi.fn() }))

vi.mock('../data/challenges/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../data/challenges/client')>()
  return {
    ...original,
    listChallengeRows: vi.fn(async () => clientMocks.rows),
    saveChallenge: clientMocks.save,
  }
})

import { ChallengesCard } from './ChallengesCard'
import { safeVideoUrl } from '../data/challenges/client'

beforeEach(() => {
  clientMocks.rows = []
  clientMocks.save.mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('safeVideoUrl', () => {
  it('keeps web links, adds https to bare hosts, and drops anything else', () => {
    expect(safeVideoUrl('https://youtu.be/abc')).toBe('https://youtu.be/abc')
    expect(safeVideoUrl('youtube.com/watch?v=1')).toBe('https://youtube.com/watch?v=1')
    expect(safeVideoUrl('javascript:alert(1)')).toBe('')
    expect(safeVideoUrl('  ')).toBe('')
  })
})

describe('ChallengesCard', () => {
  it('shows saved progress and video links over the bundled list, read-only for guests', async () => {
    clientMocks.rows = [
      { challenge_id: '1', category: '', challenge: '', duration: '', difficulty: '', status: 'Done', video_url: 'https://youtu.be/xyz' },
    ]
    render(<ChallengesCard title="365 Challenges" />)

    expect(await screen.findByText('1 / 365 done')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Watch/ }).getAttribute('href')).toBe('https://youtu.be/xyz')
    expect(screen.queryByLabelText('Status of challenge 1')).toBeNull()
    expect(screen.queryByLabelText('Edit challenge 1')).toBeNull()
  })

  it('picks a challenge at random', async () => {
    const user = userEvent.setup()
    render(<ChallengesCard title="365 Challenges" />)
    await screen.findByText('0 / 365 done')

    await user.click(screen.getByRole('button', { name: /Surprise me/ }))

    const picked = screen.getByRole('region', { name: 'Picked challenge' })
    expect(within(picked).getByText(/^#\d+$/)).toBeTruthy()
  })

  it('lets the admin mark a challenge and add a video link without leaving the page', async () => {
    const user = userEvent.setup()
    render(<ChallengesCard title="365 Challenges" canEdit idToken="token" />)
    await screen.findByText('0 / 365 done')

    await user.selectOptions(screen.getByLabelText('Status of challenge 4'), 'Done')
    expect(await screen.findByText('1 / 365 done')).toBeTruthy()
    expect(clientMocks.save).toHaveBeenCalledWith('token', expect.objectContaining({ id: 4, status: 'Done' }))

    await user.click(screen.getByLabelText('Edit challenge 4'))
    await user.type(screen.getByPlaceholderText('https://youtube.com/…'), 'https://youtu.be/run')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(clientMocks.save).toHaveBeenLastCalledWith(
      'token',
      expect.objectContaining({ id: 4, videoUrl: 'https://youtu.be/run' }),
    )
    expect(screen.getAllByRole('link', { name: /Watch/ })).toHaveLength(1)
  })

  it('puts the old status back when a save fails', async () => {
    const user = userEvent.setup()
    clientMocks.save.mockRejectedValue(new Error('Nope'))
    render(<ChallengesCard title="365 Challenges" canEdit idToken="token" />)
    await screen.findByText('0 / 365 done')

    await user.selectOptions(screen.getByLabelText('Status of challenge 4'), 'Done')

    expect(await screen.findByText('Nope')).toBeTruthy()
    expect(screen.getByText('0 / 365 done')).toBeTruthy()
  })
})
