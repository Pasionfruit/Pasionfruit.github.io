import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoulettePage from '../RoulettePage'

const mockUseBankroll = vi.fn()

vi.mock('../../context/BankrollContext', () => ({
  useBankroll: () => mockUseBankroll(),
}))

describe('RoulettePage', () => {
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

  it('pays straight-up win on 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <MemoryRouter>
        <RoulettePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spin ($25.00)' }))
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(900)
  })

  it('reports losing spin when no bet hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <MemoryRouter>
        <RoulettePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spin ($25.00)' }))
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(payout).not.toHaveBeenCalled()
  })

  it('shows bankroll rejection when total stake cannot be placed', () => {
    placeBet.mockReturnValue(false)

    render(
      <MemoryRouter>
        <RoulettePage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Spin ($25.00)' }))

    expect(screen.getByText('Unable to place bets. Check bankroll and try again.')).toBeInTheDocument()
  })
})
