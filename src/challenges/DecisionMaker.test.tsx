// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DecisionMaker } from './DecisionMaker'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function addOptions(user: ReturnType<typeof userEvent.setup>, ...labels: string[]) {
  for (const label of labels) {
    await user.type(screen.getByLabelText('New option'), `${label}{Enter}`)
  }
}

describe('DecisionMaker', () => {
  it('starts empty, with nothing to spin', () => {
    render(<DecisionMaker />)

    expect(screen.getByText(/Add a few options/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Decide for me' })).toBeNull()
  })

  it('adds and removes your own options, and remembers them on this device', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<DecisionMaker />)

    await addOptions(user, 'Pizza', 'Tacos', 'Sushi')
    const list = screen.getByRole('list', { name: 'Options' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Pizza', 'Tacos', 'Sushi'])

    await user.click(screen.getByRole('button', { name: 'Remove Tacos' }))
    expect(within(list).queryByText('Tacos')).toBeNull()

    unmount()
    render(<DecisionMaker />)
    expect(within(screen.getByRole('list', { name: 'Options' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('needs two options before it will spin', async () => {
    const user = userEvent.setup()
    render(<DecisionMaker />)

    await addOptions(user, 'Only one')
    expect(screen.getByText(/Add at least one more option/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decide for me' })).toHaveProperty('disabled', true)

    await addOptions(user, 'Another')
    expect(screen.getByRole('button', { name: 'Decide for me' })).toHaveProperty('disabled', false)
  })

  it('spins the reel and lands on one of your options, locking edits while it runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DecisionMaker />)
    await addOptions(user, 'Pizza', 'Tacos', 'Sushi')

    await user.click(screen.getByRole('button', { name: 'Decide for me' }))
    expect(screen.getByLabelText('New option')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Remove Pizza' })).toHaveProperty('disabled', true)
    // Mid-spin the strip carries well over the three options, repeated.
    expect(document.querySelectorAll('.challenge-reel-row').length).toBeGreaterThan(40)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    const decision = within(screen.getByRole('region', { name: 'Decision' })).getByText(/Pizza|Tacos|Sushi/)
    expect(document.querySelector('.challenge-reel-row.is-middle')?.textContent).toBe(decision.textContent)
    expect(screen.getByLabelText('New option')).toHaveProperty('disabled', false)
  })

  it('clears the decision when the options change, and can clear everything', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DecisionMaker />)
    await addOptions(user, 'Pizza', 'Tacos')
    await user.click(screen.getByRole('button', { name: 'Decide for me' }))
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByRole('region', { name: 'Decision' })).toBeTruthy()

    await addOptions(user, 'Sushi')
    expect(screen.queryByRole('region', { name: 'Decision' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('list', { name: 'Options' })).toBeNull()
    expect(localStorage.getItem('decision-maker-options')).toBe('[]')
  })
})
