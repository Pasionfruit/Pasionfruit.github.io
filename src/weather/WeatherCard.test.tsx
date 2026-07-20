// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Geolocation is absent in jsdom, so the card settles into its error state —
// enough to exercise the always-present header and the collapse toggle.
import { WeatherCard } from './WeatherCard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('WeatherCard collapse toggle', () => {
  it('toggles the collapsed state (mobile affordance)', async () => {
    const user = userEvent.setup()
    render(<WeatherCard />)

    const toggle = screen.getByRole('button', { name: 'Collapse weather' })
    const card = toggle.closest('article')
    if (!card) throw new Error('weather card not found')

    expect(toggle).toHaveProperty('ariaExpanded', 'true')
    expect(card.className).not.toContain('is-collapsed')

    await user.click(toggle)

    const expandToggle = screen.getByRole('button', { name: 'Expand weather' })
    expect(expandToggle).toHaveProperty('ariaExpanded', 'false')
    expect(card.className).toContain('is-collapsed')

    await user.click(expandToggle)
    expect(screen.getByRole('button', { name: 'Collapse weather' })).toBeTruthy()
    expect(card.className).not.toContain('is-collapsed')
  })
})
