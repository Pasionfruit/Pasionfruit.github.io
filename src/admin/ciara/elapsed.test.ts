import { describe, expect, it } from 'vitest'

import { elapsedSince, monthiversaryOn, TOGETHER_SINCE } from './elapsed'

describe('elapsedSince', () => {
  it('starts at 11:00 PM on 19 November 2022', () => {
    expect(TOGETHER_SINCE.getFullYear()).toBe(2022)
    expect(TOGETHER_SINCE.getMonth()).toBe(10)
    expect(TOGETHER_SINCE.getDate()).toBe(19)
    expect(TOGETHER_SINCE.getHours()).toBe(23)
    expect(TOGETHER_SINCE.getMinutes()).toBe(0)
  })

  it('is zero at the start', () => {
    expect(elapsedSince(TOGETHER_SINCE, new Date(2022, 10, 19, 23, 0, 0))).toEqual({
      years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
    })
  })

  it('counts whole years on the anniversary', () => {
    expect(elapsedSince(TOGETHER_SINCE, new Date(2023, 10, 19, 23, 0, 0))).toEqual({
      years: 1, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
    })
  })

  it('borrows across the month before now', () => {
    // 19 Nov 2025 23:00 to 19 Oct 2026 10:00 is 10 months, 29 days, 11 hours.
    expect(elapsedSince(TOGETHER_SINCE, new Date(2026, 9, 19, 10, 0, 0))).toEqual({
      years: 3, months: 10, days: 29, hours: 11, minutes: 0, seconds: 0,
    })
  })

  it('breaks a day into hours, minutes and seconds', () => {
    expect(elapsedSince(TOGETHER_SINCE, new Date(2022, 10, 20, 22, 59, 59))).toEqual({
      years: 0, months: 0, days: 0, hours: 23, minutes: 59, seconds: 59,
    })
  })

  it('clamps a start on the 31st to the end of a shorter month', () => {
    // 31 Jan 2024 plus one month is 29 Feb 2024 (leap year), so 1 March is one month and a day on.
    expect(elapsedSince(new Date(2024, 0, 31, 0, 0, 0), new Date(2024, 2, 1, 0, 0, 0))).toEqual({
      years: 0, months: 1, days: 1, hours: 0, minutes: 0, seconds: 0,
    })
  })
})

describe('monthiversaryOn', () => {
  it('is a monthiversary within half a day of the 11:00 PM anniversary', () => {
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2022, 11, 19, 23, 0, 0))).toBe(1)
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2026, 9, 19, 23, 0, 0))).toBe(47)
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2026, 9, 19, 12, 0, 0))).toBe(47)
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2026, 9, 20, 10, 0, 0))).toBe(47)
  })

  it('is not a monthiversary more than half a day away', () => {
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2026, 9, 19, 10, 43, 0))).toBeNull()
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2026, 9, 18, 23, 0, 0))).toBeNull()
    expect(monthiversaryOn(TOGETHER_SINCE, new Date(2022, 10, 19, 23, 0, 0))).toBeNull()
  })
})
