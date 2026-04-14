import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { BankrollProvider, useBankroll } from '../BankrollContext'

function Harness() {
  const { balance, placeBet, payout, resetBankroll } = useBankroll()

  return (
    <div>
      <p data-testid="balance">{balance.toFixed(2)}</p>
      <button type="button" onClick={() => placeBet(25)}>bet</button>
      <button type="button" onClick={() => payout(12.349)}>payout</button>
      <button type="button" onClick={resetBankroll}>reset</button>
    </div>
  )
}

describe('BankrollContext', () => {
  it('places bets, pays out, and sanitizes cents correctly', () => {
    localStorage.clear()
    localStorage.setItem('casino-shared-bankroll', '1000')

    render(
      <BankrollProvider>
        <Harness />
      </BankrollProvider>,
    )

    expect(screen.getByTestId('balance')).toHaveTextContent('5000.00')

    fireEvent.click(screen.getByRole('button', { name: 'bet' }))
    expect(screen.getByTestId('balance')).toHaveTextContent('4975.00')

    fireEvent.click(screen.getByRole('button', { name: 'payout' }))
    expect(screen.getByTestId('balance')).toHaveTextContent('4987.34')

    fireEvent.click(screen.getByRole('button', { name: 'reset' }))
    expect(screen.getByTestId('balance')).toHaveTextContent('5000.00')
  })

  it('rejects bets above bankroll', () => {
    localStorage.clear()
    localStorage.setItem('casino-shared-bankroll', '1000')

    function RejectHarness() {
      const { placeBet, balance } = useBankroll()
      const [accepted, setAccepted] = useState(null)

      return (
        <div>
          <button type="button" onClick={() => setAccepted(placeBet(6000))}>reject</button>
          <p>
            {String(accepted)}|{balance.toFixed(2)}
          </p>
        </div>
      )
    }

    render(
      <BankrollProvider>
        <RejectHarness />
      </BankrollProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'reject' }))
    expect(screen.getByText('false|5000.00')).toBeInTheDocument()
  })
})
