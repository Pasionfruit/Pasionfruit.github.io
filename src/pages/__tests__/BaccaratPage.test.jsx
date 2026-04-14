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

function suitToRandom(suitIndex) {
  return (suitIndex + 0.25) / 4
}

function cardRandom(rank, suitIndex) {
  return [rankToRandom(rank), suitToRandom(suitIndex)]
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
    const randoms = [
      ...cardRandom(4, 0),
      ...cardRandom(4, 1),
      ...cardRandom(3, 2),
      ...cardRandom(3, 3),
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randoms[pointer]
      pointer += 1
      return value ?? 0
    })

    render(
      <MemoryRouter>
        <BaccaratPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(50)
    expect(screen.getByText('Player won $50.00.')).toBeInTheDocument()
  })

  it('pays tie odds when tie side wins', () => {
    const randoms = [
      ...cardRandom(4, 0),
      ...cardRandom(4, 1),
      ...cardRandom(8, 2),
      ...cardRandom(10, 3),
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randoms[pointer]
      pointer += 1
      return value ?? 0
    })

    render(
      <MemoryRouter>
        <BaccaratPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /tie\s*8:1/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(payout).toHaveBeenCalledWith(225)
    expect(screen.getByText('Tie won $225.00.')).toBeInTheDocument()
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
