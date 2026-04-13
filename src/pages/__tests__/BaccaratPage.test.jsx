import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BaccaratPage from '../BaccaratPage'

const mockUseBankroll = vi.fn()

vi.mock('../../context/BankrollContext', () => ({
  useBankroll: () => mockUseBankroll(),
}))

function rankToRandom(rank) {
  return (rank - 0.5) / 13
}

describe('BaccaratPage', () => {
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pays 1:1 when player side wins', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(rankToRandom(4))
      .mockReturnValueOnce(rankToRandom(4))
      .mockReturnValueOnce(rankToRandom(3))
      .mockReturnValueOnce(rankToRandom(3))

    render(
      <MemoryRouter>
        <BaccaratPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(50)
    expect(screen.getByText('Player wins. Paid 1:1.')).toBeInTheDocument()
  })

  it('pays tie odds when tie side wins', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(rankToRandom(4))
      .mockReturnValueOnce(rankToRandom(4))
      .mockReturnValueOnce(rankToRandom(8))
      .mockReturnValueOnce(rankToRandom(10))

    render(
      <MemoryRouter>
        <BaccaratPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Side'), { target: { value: 'tie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(payout).toHaveBeenCalledWith(225)
    expect(screen.getByText('Tie wins. Paid 8:1.')).toBeInTheDocument()
  })

  it('shows rejected message when bankroll bet fails', () => {
    placeBet.mockReturnValue(false)

    render(
      <MemoryRouter>
        <BaccaratPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(payout).not.toHaveBeenCalled()
    expect(screen.getByText('Bet rejected. Choose a valid amount within your bankroll.')).toBeInTheDocument()
  })
})
