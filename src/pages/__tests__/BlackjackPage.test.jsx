import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BlackjackPage from '../BlackjackPage'

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

function cardRandom(rank, suitIndex = 0) {
  return [rankToRandom(rank), suitToRandom(suitIndex)]
}

describe('BlackjackPage', () => {
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

  it('pushes when both open with blackjack', () => {
    const randoms = [
      ...cardRandom(1, 0),
      ...cardRandom(13, 1),
      ...cardRandom(1, 2),
      ...cardRandom(12, 3),
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randoms[pointer]
      pointer += 1
      return value ?? 0
    })

    render(
      <MemoryRouter>
        <BlackjackPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(25)
    expect(screen.getByText('Push. Both hands opened with blackjack.')).toBeInTheDocument()
  })

  it('allows split when first two cards have matching value', () => {
    const randoms = [
      ...cardRandom(10, 0),
      ...cardRandom(13, 1),
      ...cardRandom(3, 2),
      ...cardRandom(4, 3),
      ...cardRandom(6, 0),
      ...cardRandom(7, 1),
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randoms[pointer]
      pointer += 1
      return value ?? 0
    })

    render(
      <MemoryRouter>
        <BlackjackPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Split' }))

    expect(placeBet).toHaveBeenCalledTimes(2)
    expect(placeBet).toHaveBeenNthCalledWith(1, 25)
    expect(placeBet).toHaveBeenNthCalledWith(2, 25)
    expect(screen.getByText('Hand split. Play Hand 1 first.')).toBeInTheDocument()
  })

  it('shows rejection when deal bet cannot be placed', () => {
    placeBet.mockReturnValue(false)

    render(
      <MemoryRouter>
        <BlackjackPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deal' }))

    expect(payout).not.toHaveBeenCalled()
    expect(screen.getByText('Bet rejected. Choose a valid amount within your bankroll.')).toBeInTheDocument()
  })
})
