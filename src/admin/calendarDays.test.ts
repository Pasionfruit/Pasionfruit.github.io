import { describe, expect, it } from 'vitest'
import type { CalendarEventRecord } from '../data/sheets/repositories'
import { eventDayKeys, eventTimeLabelForDay } from './calendarDays'

const event = (over: Partial<CalendarEventRecord>): CalendarEventRecord => ({
  id: 'e',
  source: 'google',
  title: 'Trip',
  start: '2026-11-08',
  end: '2026-11-09',
  allDay: true,
  location: '',
  calendarName: '',
  ...over,
})

describe('eventDayKeys', () => {
  it('puts a one-day all-day event on its own day only (end is exclusive)', () => {
    expect(eventDayKeys(event({}))).toEqual(['2026-11-08'])
  })

  it('spreads a multi-day all-day event over every day it covers', () => {
    expect(eventDayKeys(event({ start: '2026-11-08', end: '2026-11-11' }))).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ])
  })

  it('crosses month and year boundaries', () => {
    expect(eventDayKeys(event({ start: '2026-12-30', end: '2027-01-02' }))).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ])
  })

  it('crosses a daylight-saving change without skipping or repeating a day', () => {
    expect(eventDayKeys(event({ start: '2026-11-01', end: '2026-11-04' }))).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ])
  })

  it('treats a missing or bad end as a single day', () => {
    expect(eventDayKeys(event({ end: '' }))).toEqual(['2026-11-08'])
    expect(eventDayKeys(event({ end: '2026-11-08' }))).toEqual(['2026-11-08'])
  })

  it('keeps a timed event on one day, and spreads an overnight one over both', () => {
    const timed = { allDay: false }
    expect(eventDayKeys(event({ ...timed, start: '2026-11-08T10:00:00', end: '2026-11-08T11:00:00' }))).toEqual([
      '2026-11-08',
    ])
    expect(eventDayKeys(event({ ...timed, start: '2026-11-08T22:00:00', end: '2026-11-09T02:00:00' }))).toEqual([
      '2026-11-08',
      '2026-11-09',
    ])
  })

  it('does not spill onto the next day when a timed event ends exactly at midnight', () => {
    expect(
      eventDayKeys(event({ allDay: false, start: '2026-11-08T20:00:00', end: '2026-11-09T00:00:00' })),
    ).toEqual(['2026-11-08'])
  })
})

describe('eventTimeLabelForDay', () => {
  const trip = event({ start: '2026-11-08', end: '2026-11-11' })

  it('numbers the days of a long all-day event', () => {
    expect(eventTimeLabelForDay(trip, '2026-11-08')).toBe('All day · day 1 of 3')
    expect(eventTimeLabelForDay(trip, '2026-11-10')).toBe('All day · day 3 of 3')
  })

  it('says plain "All day" for a one-day event', () => {
    expect(eventTimeLabelForDay(event({}), '2026-11-08')).toBe('All day')
  })

  it('marks later days of an overnight timed event as continued', () => {
    const overnight = event({ allDay: false, start: '2026-11-08T22:00:00', end: '2026-11-09T02:00:00' })
    expect(eventTimeLabelForDay(overnight, '2026-11-09')).toBe('Continued')
  })
})
