// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MealPlanCard } from './MealPlanCard'
import { dayKey } from '../calendarDays'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('MealPlanCard', () => {
  it('saves a meal when the field is left, and keeps it after a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<MealPlanCard title="Meal plan" />)
    const today = dayKey(new Date())

    await user.type(screen.getByLabelText(`Dinner on ${today}`), 'Salmon and rice')
    await user.tab()

    expect(screen.getByText('1 planned')).toBeTruthy()
    unmount()

    render(<MealPlanCard title="Meal plan" />)
    expect((screen.getByLabelText(`Dinner on ${today}`) as HTMLInputElement).value).toBe('Salmon and rice')
  })

  it('pages between weeks', async () => {
    const user = userEvent.setup()
    render(<MealPlanCard title="Meal plan" />)
    const before = screen.getByRole('button', { name: 'Next week' })

    await user.click(before)
    expect(screen.queryByLabelText(`Dinner on ${dayKey(new Date())}`)).toBeNull()
  })
})
