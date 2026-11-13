import { useMemo } from 'react'
import type { Challenge } from '../data/challenges/client'
import { SlotReel } from './SlotReel'

/**
 * The challenges as a slot-machine reel: every challenge in the pool, spun
 * until one stops in the middle. The parent re-keys it when the filter
 * changes, so marking one done does not reshuffle the reel mid-spin.
 */
export function ChallengeWheel({
  pool,
  onLanded,
}: {
  pool: Challenge[]
  onLanded: (id: number) => void
}) {
  const items = useMemo(
    () => pool.map((item) => ({ id: String(item.id), label: item.challenge, tag: `#${item.id}` })),
    [pool],
  )

  return <SlotReel items={items} ariaLabel="Challenge slot machine" onLanded={(id) => onLanded(Number(id))} />
}
