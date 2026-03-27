import { useMemo, useState } from 'react'
import type { Transaction } from '../../../types/types'

interface CalendarTabProps {
  transactions: Transaction[]
  necessityCategories: string[]
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function dateNumber(dateKey: string): number {
  return Number(dateKey.slice(8, 10))
}

export function CalendarTab(props: CalendarTabProps) {
  const { transactions, necessityCategories } = props
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showNecessities, setShowNecessities] = useState(false)

  const firstWeekday = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const dayCells = useMemo(() => {
    const cells: Array<string | null> = []

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day)
      cells.push(toDateKey(date))
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    return cells
  }, [daysInMonth, firstWeekday, month])

  const expenseTotalsByDate = useMemo(() => {
    const totals = new Map<string, number>()

    transactions.forEach((tx) => {
      if (tx.type !== 'expense') {
        return
      }

      totals.set(tx.date, (totals.get(tx.date) ?? 0) + tx.amount)
    })

    return totals
  }, [transactions])

  const necessityTotalsByDate = useMemo(() => {
    const totals = new Map<string, number>()

    transactions.forEach((tx) => {
      if (tx.type !== 'expense') {
        return
      }
      if (!necessityCategories.includes(tx.category)) {
        return
      }

      totals.set(tx.date, (totals.get(tx.date) ?? 0) + tx.amount)
    })

    return totals
  }, [necessityCategories, transactions])

  const selectedTransactions = useMemo(() => {
    if (!selectedDate) {
      return []
    }

    return transactions.filter((tx) => tx.date === selectedDate)
  }, [selectedDate, transactions])

  function changeMonth(direction: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1))
  }

  function handleSelectDate(dateKey: string | null) {
    if (!dateKey) {
      return
    }

    setSelectedDate(dateKey)
  }

  return (
    <section className="tab-panel">
      <h2>Calendar</h2>
      <p className="muted">Green means no expense spending, red means money was spent that day.</p>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showNecessities}
          onChange={(event) => setShowNecessities(event.target.checked)}
        />
        <span>Enable necessities filter highlight (light orange)</span>
      </label>

      <div className="calendar-wrap">
        <div className="calendar-board card">
          <header className="calendar-header">
            <button type="button" onClick={() => changeMonth(-1)}>
              Previous
            </button>
            <h3>{monthLabel(month)}</h3>
            <button type="button" onClick={() => changeMonth(1)}>
              Next
            </button>
          </header>

          <div className="calendar-grid weekday-row">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="weekday">
                {label}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {dayCells.map((dateKey, index) => {
              if (!dateKey) {
                return <div key={`empty-${index}`} className="day-cell empty" />
              }

              const expenseTotal = expenseTotalsByDate.get(dateKey) ?? 0
              const necessityTotal = necessityTotalsByDate.get(dateKey) ?? 0
              const hasSpend = expenseTotal > 0
              const hasNecessitySpend = necessityTotal > 0
              const selected = selectedDate === dateKey

              const colorClass = showNecessities && hasNecessitySpend
                ? 'necessity'
                : hasSpend
                  ? 'spent'
                  : 'saved'

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={`day-cell ${colorClass} ${selected ? 'selected' : ''}`}
                  onClick={() => handleSelectDate(dateKey)}
                >
                  <span>{dateNumber(dateKey)}</span>
                  <small>
                    {showNecessities
                      ? `$${necessityTotal.toFixed(2)}`
                      : hasSpend
                        ? `$${expenseTotal.toFixed(2)}`
                        : '$0.00'}
                  </small>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="card detail-panel">
          <h3>{selectedDate ? `Details for ${selectedDate}` : 'Select a day'}</h3>
          {selectedDate && (
            <>
              <p>
                Expense total: ${(expenseTotalsByDate.get(selectedDate) ?? 0).toFixed(2)}
              </p>
              <p>
                Necessity total: ${(necessityTotalsByDate.get(selectedDate) ?? 0).toFixed(2)}
              </p>

              <h4>Transactions</h4>
              {selectedTransactions.length === 0 && <p className="muted">No transactions on this date.</p>}
              {selectedTransactions.length > 0 && (
                <ul className="transaction-list">
                  {selectedTransactions.map((tx) => (
                    <li key={tx.id}>
                      <strong>{tx.description}</strong>
                      <span>{tx.type}</span>
                      <span>${tx.amount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
