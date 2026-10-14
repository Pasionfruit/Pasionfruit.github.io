import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { getGarminPrs } from '../../data/sheets/repositories'
import type { GarminPrRecord } from '../../data/sheets/types'
import { buildPrBoard, type PrGroup, type PrTile } from './prs'

const GROUP_TITLES: Record<PrGroup, string> = {
  race: 'Race times',
  distance: 'Distance',
  more: 'More bests',
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Garmin's personal records, the PR side of the Training Log: race times with
 * the next round number to beat, distance bests, and the rest. Read from the
 * garmin_prs tab the daily sync writes.
 */
export function TrainingPrs() {
  const [records, setRecords] = useState<GarminPrRecord[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await getGarminPrs()
        if (!cancelled) {
          setRecords(rows)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const board = useMemo(() => buildPrBoard(records), [records])

  if (status === 'loading') {
    return <p className="sheets-meta">Loading personal records…</p>
  }

  // A missing tab reads as an error from the Sheets API; both mean the sync has not written PRs yet.
  if (status === 'error' || records.length === 0) {
    return <p className="sheets-meta">Personal records arrive with the next Garmin sync.</p>
  }

  return (
    <div className="training-prs">
      {(Object.keys(GROUP_TITLES) as PrGroup[])
        .filter((group) => board[group].length > 0)
        .map((group) => (
          <section key={group} className="training-prs-group" aria-label={GROUP_TITLES[group]}>
            <h4 className="training-prs-title">{GROUP_TITLES[group]}</h4>
            <ul className="training-prs-grid">
              {board[group].map((tile) => (
                <PrTileView key={tile.typeId} tile={tile} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

function PrTileView({ tile }: { tile: PrTile }) {
  const isSet = tile.value !== ''
  const when = formatDate(tile.date)

  return (
    <li className={`pr-tile${isSet ? '' : ' is-unset'}${tile.isNew ? ' is-new' : ''}`}>
      <span className="pr-tile-head">
        <span className="pr-label">{tile.label}</span>
        {tile.isNew ? (
          <span className="pr-new">
            <Trophy size={11} strokeWidth={2} aria-hidden="true" />
            New
          </span>
        ) : null}
      </span>
      <span className="pr-value">{isSet ? tile.value : 'Not yet'}</span>
      {isSet ? (
        <span className="pr-detail">{[tile.detail, when].filter(Boolean).join(' · ')}</span>
      ) : null}
      {tile.progress !== null ? (
        <span className="pr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tile.progress * 100)} aria-label={`${tile.label} progress`}>
          <span style={{ width: `${Math.round(tile.progress * 100)}%` }} />
        </span>
      ) : null}
      <span className="pr-goal">{tile.goal}</span>
    </li>
  )
}
