import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RideTheBusPage from '../RideTheBusPage'

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

describe('RideTheBusPage', () => {
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

  it('pays when all four guesses are correct', () => {
    const randoms = [
      ...cardRandom(7, 1),
      ...cardRandom(10, 0),
      ...cardRandom(9, 2),
      ...cardRandom(13, 2),
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randoms[pointer]
      pointer += 1
      return value ?? 0
    })

    render(
      <MemoryRouter>
        <RideTheBusPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Ante'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Red' }))
    fireEvent.click(screen.getByRole('button', { name: 'Above' }))
    fireEvent.click(screen.getByRole('button', { name: 'In' }))
    fireEvent.click(screen.getByRole('button', { name: '♣ Clubs' }))

    expect(placeBet).toHaveBeenCalledWith(25)
    expect(payout).toHaveBeenCalledWith(250)
    expect(screen.getByText('Bus cleared! You won $250.00 on a 10x payout.')).toBeInTheDocument()
  })

  it('allows a no-ante run without placing or paying bankroll', () => {
    const randoms = [
      ...cardRandom(7, 1),
      ...cardRandom(10, 0),
      ...cardRandom(9, 2),
      ...cardRandom(13, 2),
    ]

    let pointer = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const value = randoms[pointer]
      pointer += 1
      return value ?? 0
    })

    render(
      <MemoryRouter>
        <RideTheBusPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Ante'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Red' }))
    fireEvent.click(screen.getByRole('button', { name: 'Above' }))
    fireEvent.click(screen.getByRole('button', { name: 'In' }))
    fireEvent.click(screen.getByRole('button', { name: '♣ Clubs' }))

    expect(placeBet).not.toHaveBeenCalled()
    expect(payout).not.toHaveBeenCalled()
    expect(screen.getByText('Bus cleared! Perfect run with no ante placed.')).toBeInTheDocument()
  })
})