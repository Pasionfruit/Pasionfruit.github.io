import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SlotsPage from '../SlotsPage'

const mockUseBankroll = vi.fn()

vi.mock('../../context/BankrollContext', () => ({
  useBankroll: () => mockUseBankroll(),
}))

describe('SlotsPage', () => {
  const placeBet = vi.fn()
  const payout = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.restoreAllMocks()
    placeBet.mockReset()
    payout.mockReset()
    placeBet.mockReturnValue(true)
    mockUseBankroll.mockReturnValue({
      balance: 1000,
      placeBet,
      payout,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pays jackpot for 5 matching sevens', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.55)

    render(
      <MemoryRouter>
        <SlotsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pull slot lever' }))
    act(() => {
      vi.runAllTimers()
    })

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(275)
    expect(screen.getByText('Seven x5 won $275.00.')).toBeInTheDocument()
  })

  it('shows miss when no symbol repeats 3 or more times', () => {
    const randomValues = [
      ...Array.from({ length: 15 }, (_, index) => index / 20),
      0.02,
      0.22,
      0.42,
      0.62,
      0.82,
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randomValues[pointer]
      pointer += 1
      return value ?? 0.1
    })

    render(
      <MemoryRouter>
        <SlotsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pull slot lever' }))
    act(() => {
      vi.runAllTimers()
    })

    expect(payout).not.toHaveBeenCalled()
    expect(screen.getByText('No line win this spin. Try again.')).toBeInTheDocument()
  })

  it('disables lever when bankroll is below bet', () => {
    mockUseBankroll.mockReturnValue({
      balance: 10,
      placeBet,
      payout,
    })

    render(
      <MemoryRouter>
        <SlotsPage />
      </MemoryRouter>,
    )

    const leverButton = screen.getByRole('button', { name: 'Pull slot lever' })
    expect(leverButton).toBeDisabled()
    expect(payout).not.toHaveBeenCalled()
  })
})
