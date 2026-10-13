import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * A compact pill pager, ‹ label ›, used above the month calendar and the
 * training log. It replaces a pair of full-height buttons, so the controls stay
 * short and sit on one line with the range they page through.
 */
export function Pager({
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  variant = 'range',
  className = '',
}: {
  label: string
  prevLabel: string
  nextLabel: string
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  /** `range` sets the label as data (mono); `title` as a heading, for a month name. */
  variant?: 'range' | 'title'
  className?: string
}) {
  return (
    <div className={`pager pager--${variant} ${className}`.trim()}>
      <button type="button" className="pager-btn" aria-label={prevLabel} onClick={onPrev} disabled={prevDisabled}>
        <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span className="pager-label">{label}</span>
      <button type="button" className="pager-btn" aria-label={nextLabel} onClick={onNext} disabled={nextDisabled}>
        <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  )
}
