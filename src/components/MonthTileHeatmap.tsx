import { useState } from 'react'
import { Pager } from './Pager'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type HeatmapDay = {
  /** 0 is an empty day; higher levels shade darker (the training log uses 0–2, GitHub 0–4). */
  level: number
  /** Read by screen readers and shown as the tile's tooltip. */
  label: string
  /** Extra data-* attributes for the tile, e.g. the record it stands for. */
  data?: Record<`data-${string}`, string>
}

function dayKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * A year of days as a contribution calendar: one column of week rows per month,
 * paged by half-year (or by quarter when the grid is narrow), with the years on
 * the side. Shared by the Training Log and the GitHub activity in Education, so
 * the two read the same way. The class names are the Training Log's, where it
 * started.
 */
export function MonthTileHeatmap({
  year,
  years,
  onYearChange,
  dayInfo,
  label,
  tileNoun,
  className = '',
}: {
  year: number
  years: number[]
  onYearChange: (year: number) => void
  /** What to show for a YYYY-MM-DD day. */
  dayInfo: (dateKey: string) => HeatmapDay
  /** Accessible name for the grid, e.g. "Training activity tiles by month". */
  label: string
  /** Noun for each month's tile list, e.g. "training activity". */
  tileNoun: string
  className?: string
}) {
  const now = new Date()
  const [desktopPage, setDesktopPage] = useState(() => (now.getMonth() >= 6 ? 1 : 0))
  const [mobilePage, setMobilePage] = useState(() => Math.floor(now.getMonth() / 3))
  const isCurrentYear = year === now.getFullYear()

  return (
    <div className={`training-log-grid ${className}`.trim()} aria-label={label}>
      <Pager
        className="training-log-desktop-page-nav"
        label={desktopPage === 0 ? 'Jan – Jun' : 'Jul – Dec'}
        prevLabel="First half of the year"
        nextLabel="Second half of the year"
        onPrev={() => setDesktopPage(0)}
        onNext={() => setDesktopPage(1)}
        prevDisabled={desktopPage === 0}
        nextDisabled={desktopPage === 1}
      />

      <Pager
        className="training-log-page-nav"
        label={['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'][mobilePage]}
        prevLabel="Previous quarter"
        nextLabel="Next quarter"
        onPrev={() => setMobilePage((page) => Math.max(0, page - 1))}
        onNext={() => setMobilePage((page) => Math.min(3, page + 1))}
        prevDisabled={mobilePage === 0}
        nextDisabled={mobilePage === 3}
      />

      <div className="training-log-tiles-row">
        <div className="training-log-grid-panel">
          {MONTH_LABELS.map((monthLabel, monthIndex) => {
            // How many empty Mon-anchored cells precede day 1 (Mon=0 … Sun=6)
            const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
            // Days beyond today have not happened yet, so they get no tile at all.
            const lastDay =
              isCurrentYear && monthIndex > now.getMonth()
                ? 0
                : isCurrentYear && monthIndex === now.getMonth()
                  ? now.getDate()
                  : daysInMonth

            return (
              <div
                /*
                 * Keyed by year as well as month so switching years remounts
                 * the column. Keyed by month alone, React reconciled the new
                 * year's days against the old ones and left the previous
                 * year's tiles behind.
                 */
                key={`${year}-${monthIndex}`}
                className={[
                  'training-log-month-col',
                  Math.floor(monthIndex / 3) !== mobilePage ? 'training-log-month-col--hidden' : '',
                  Math.floor(monthIndex / 6) !== desktopPage ? 'training-log-month-col--desktop-hidden' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="training-log-month-label" aria-label={`Month ${monthLabel}`}>{monthLabel}</div>
                <div className="training-log-row-tiles" role="list" aria-label={`${monthLabel} ${tileNoun}`}>
                  {Array.from({ length: lastDay }, (_, index) => {
                    const day = index + 1
                    const key = dayKey(year, monthIndex, day)
                    const info = dayInfo(key)
                    const date = new Date(year, monthIndex, day)
                    return (
                      <div
                        // One fixed slot per day of the month.
                        key={day}
                        role="listitem"
                        className={`training-log-tile level-${info.level}`}
                        style={{
                          gridColumn: ((date.getDay() + 6) % 7) + 1,
                          gridRow: Math.floor((day - 1 + firstDayOffset) / 7) + 1,
                        }}
                        aria-label={info.label}
                        title={info.label}
                        data-level={String(info.level)}
                        {...info.data}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="training-log-year-picker" role="listbox" aria-label="Select year">
          {years.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={year === option}
              className={`training-log-year-btn${year === option ? ' active' : ''}`}
              onClick={() => onYearChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
