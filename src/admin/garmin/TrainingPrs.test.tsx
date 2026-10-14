// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { GarminPrRecord } from '../../data/sheets/types'

const repoMocks = vi.hoisted(() => ({ getGarminPrs: vi.fn() }))
vi.mock('../../data/sheets/repositories', () => repoMocks)

import { TrainingPrs } from './TrainingPrs'

function dayKey(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function pr(type_id: number, value: number, daysAgo: number): GarminPrRecord {
  return {
    type_id: String(type_id),
    value: String(value),
    activity_type: 'running',
    activity_id: '1',
    activity_name: '',
    date: dayKey(daysAgo),
    pool_unit: '',
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TrainingPrs', () => {
  it('shows race times with a target to beat, flags new ones, and tracks races not run yet', async () => {
    repoMocks.getGarminPrs.mockResolvedValue([pr(3, 1957.699, 120), pr(4, 3846.879, 10), pr(7, 11072.29, 80)])
    render(<TrainingPrs />)

    const races = await screen.findByRole('region', { name: 'Race times' })
    const fiveK = within(races).getByText('5K').closest('li')!
    expect(within(fiveK).getByText('32:38')).toBeTruthy()
    expect(within(fiveK).getByText('Sub-32:00 · 38 s to cut')).toBeTruthy()
    expect(within(fiveK).queryByText('New')).toBeNull()

    const tenK = within(races).getByText('10K').closest('li')!
    expect(within(tenK).getByText('New')).toBeTruthy()

    const half = within(races).getByText('Half marathon').closest('li')!
    expect(within(half).getByText('Not yet')).toBeTruthy()
    expect(within(half).getByRole('progressbar', { name: 'Half marathon progress' })).toBeTruthy()

    expect(within(screen.getByRole('region', { name: 'Distance' })).getByText('6.88 mi')).toBeTruthy()
  })

  it('says when to expect records before the first sync has written them', async () => {
    repoMocks.getGarminPrs.mockRejectedValue(new Error('Unable to parse range: garmin_prs!A1:G200'))
    render(<TrainingPrs />)

    expect(await screen.findByText('Personal records arrive with the next Garmin sync.')).toBeTruthy()
  })
})
