import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CrapsPage from '../CrapsPage'

const mockUseBankroll = vi.fn()

vi.mock('../../context/BankrollContext', () => ({
  useBankroll: () => mockUseBankroll(),
}))

function dieToRandom(die) {
  return (die - 0.5) / 6
}

describe('CrapsPage', () => {
  const placeBet = vi.fn()
  const payout = vi.fn()

  beforeEach(() => {
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

  it('wins on natural 7 on come-out roll', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(dieToRandom(3))
      .mockReturnValueOnce(dieToRandom(4))

    render(
      <MemoryRouter>
        <CrapsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Round' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roll Dice' }))

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(50)
    expect(screen.getByText('Natural 7. Pass Line wins.')).toBeInTheDocument()
  })

  it('sets point and then loses on seven-out', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(dieToRandom(2))
      .mockReturnValueOnce(dieToRandom(3))
      .mockReturnValueOnce(dieToRandom(5))
      .mockReturnValueOnce(dieToRandom(2))

    render(
      <MemoryRouter>
        <CrapsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Round' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roll Dice' }))
    expect(screen.getByText('Point is 5. Roll it again before a 7.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Roll Dice' }))

    expect(payout).not.toHaveBeenCalled()
    expect(screen.getByText('Seven-out. Pass Line loses.')).toBeInTheDocument()
  })

  it('shows rejection message when start bet is invalid', () => {
    placeBet.mockReturnValue(false)

    render(
      <MemoryRouter>
        <CrapsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Round' }))

    expect(screen.getByText('Bet rejected. Choose a valid amount within your bankroll.')).toBeInTheDocument()
  })
})
