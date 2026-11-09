// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MealPlanCard } from './MealPlanCard'
import { parseDishes } from './mealPlan'
import { dayKey } from '../calendarDays'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('parseDishes', () => {
  it('splits on commas and drops blanks', () => {
    expect(parseDishes('turkey, ham,  mac and cheese,')).toEqual(['turkey', 'ham', 'mac and cheese'])
  })
})

describe('MealPlanCard', () => {
  it('lists a named plan with its dishes on a date, and keeps it after a remount', async () => {
    const user = userEvent.setup()
    const today = dayKey(new Date())
    const { unmount } = render(<MealPlanCard title="Meal plan" />)

    await user.click(screen.getByRole('button', { name: `Add a meal on ${today}` }))
    await user.type(screen.getByLabelText(`Meal name on ${today}`), 'Thanksgiving')
    await user.type(screen.getByLabelText(`Dishes on ${today}`), 'turkey, ham, mac and cheese')
    await user.tab()

    expect(screen.getByText('1 planned')).toBeTruthy()
    unmount()

    render(<MealPlanCard title="Meal plan" />)
    expect((screen.getByLabelText(`Meal name on ${today}`) as HTMLInputElement).value).toBe('Thanksgiving')
    expect((screen.getByLabelText(`Dishes on ${today}`) as HTMLInputElement).value).toBe('turkey, ham, mac and cheese')

    await user.click(screen.getByRole('button', { name: `Remove Thanksgiving on ${today}` }))
    expect(screen.getByText('0 planned')).toBeTruthy()
  })

  it('carries over a plan saved in the earlier breakfast/lunch/dinner shape', () => {
    const today = dayKey(new Date())
    window.localStorage.setItem('admin-meal-plan', JSON.stringify({ [today]: { dinner: 'Salmon' } }))

    render(<MealPlanCard title="Meal plan" />)

    expect((screen.getByLabelText(`Meal name on ${today}`) as HTMLInputElement).value).toBe('Dinner')
    expect((screen.getByLabelText(`Dishes on ${today}`) as HTMLInputElement).value).toBe('Salmon')
  })

  it('pages between weeks', async () => {
    const user = userEvent.setup()
    const today = dayKey(new Date())
    window.localStorage.setItem('admin-meal-plan', JSON.stringify({ [today]: [{ id: 'a', title: 'Lunch', dishes: [] }] }))
    render(<MealPlanCard title="Meal plan" />)

    expect(screen.getByLabelText(`Meal name on ${today}`)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.queryByLabelText(`Meal name on ${today}`)).toBeNull()
  })
})
