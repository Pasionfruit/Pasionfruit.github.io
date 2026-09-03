// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinancePinGate } from './FinancePinGate'

const BALANCES = 'balances'

function renderGate() {
  return render(
    <FinancePinGate>
      <p>{BALANCES}</p>
    </FinancePinGate>,
  )
}

function pinField() {
  return screen.getByLabelText('Finance PIN')
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('FinancePinGate', () => {
  it('lets the page through when no PIN is configured', () => {
    vi.stubEnv('VITE_FINANCE_PIN', '')
    renderGate()

    // Failing closed here would lock the page with no way to open it.
    expect(screen.getByText(BALANCES)).toBeTruthy()
  })

  it('hides the page behind the prompt when a PIN is set', () => {
    vi.stubEnv('VITE_FINANCE_PIN', '4821')
    renderGate()

    expect(screen.queryByText(BALANCES)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Finances are locked' })).toBeTruthy()
  })

  it('unlocks on the fourth correct digit, with nothing to press', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_FINANCE_PIN', '4821')
    renderGate()

    await user.type(pinField(), '482')
    expect(screen.queryByText(BALANCES)).toBeNull()

    await user.type(pinField(), '1')
    expect(screen.getByText(BALANCES)).toBeTruthy()
  })

  it('rejects a wrong PIN, clears it, and counts down the tries', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_FINANCE_PIN', '4821')
    renderGate()

    await user.type(pinField(), '1111')

    expect(screen.queryByText(BALANCES)).toBeNull()
    expect(screen.getByText(/4 tries left/)).toBeTruthy()
    // Cleared, so the next attempt starts from an empty field.
    expect((pinField() as HTMLInputElement).value).toBe('')
  })

  it('stops accepting input after five wrong attempts', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_FINANCE_PIN', '4821')
    renderGate()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await user.type(pinField(), '1111')
    }

    expect(screen.getByText(/Too many attempts/)).toBeTruthy()
    expect((pinField() as HTMLInputElement).disabled).toBe(true)

    // Even the right PIN does nothing while it is cooling down.
    await user.type(pinField(), '4821')
    expect(screen.queryByText(BALANCES)).toBeNull()
  })

  it('ignores non-digits rather than counting them towards the PIN', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_FINANCE_PIN', '4821')
    renderGate()

    await user.type(pinField(), '4a8b2c1')
    expect(screen.getByText(BALANCES)).toBeTruthy()
  })
})
