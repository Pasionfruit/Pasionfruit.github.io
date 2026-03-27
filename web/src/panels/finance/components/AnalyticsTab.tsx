import { useMemo, useState } from 'react'
import type { Transaction } from '../../../types/types'

interface AnalyticsTabProps {
  transactions: Transaction[]
}

type Mode = 'category' | 'time' | 'percent'

function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function AnalyticsTab(props: AnalyticsTabProps) {
  const { transactions } = props
  const [mode, setMode] = useState<Mode>('category')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const expenses = useMemo(() => transactions.filter((tx) => tx.type === 'expense'), [transactions])

  const allCategories = useMemo(() => {
    const set = new Set<string>()
    expenses.forEach((tx) => set.add(tx.category))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [expenses])

  const rangedExpenses = useMemo(() => {
    return expenses.filter((tx) => {
      if (startDate && tx.date < startDate) {
        return false
      }
      if (endDate && tx.date > endDate) {
        return false
      }
      return true
    })
  }, [endDate, expenses, startDate])

  const analyticsExpenses = mode === 'time' ? rangedExpenses : expenses
  const total = useMemo(() => analyticsExpenses.reduce((sum, tx) => sum + tx.amount, 0), [analyticsExpenses])

  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    analyticsExpenses.forEach((tx) => {
      map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount)
    })

    return allCategories
      .map((category) => {
        const amount = map.get(category) ?? 0
        return { category, amount, percent: total > 0 ? (amount / total) * 100 : 0 }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [allCategories, analyticsExpenses, total])

  const timeData = useMemo(() => {
    const map = new Map<string, number>()
    rangedExpenses.forEach((tx) => {
      const key = monthKey(tx.date)
      map.set(key, (map.get(key) ?? 0) + tx.amount)
    })

    return [...map.entries()]
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [rangedExpenses])

  const maxCategory = categoryData[0]?.amount ?? 0
  const maxTime = Math.max(...timeData.map((entry) => entry.amount), 0)

  const pieSegments = useMemo(() => {
    const palette = ['#0ea5e9', '#f97316', '#22c55e', '#ef4444', '#8b5cf6', '#14b8a6', '#f59e0b']
    const withValues = categoryData.filter((entry) => entry.amount > 0)
    let accumulator = 0

    return withValues.map((entry, index) => {
      const start = accumulator
      const sweep = total > 0 ? (entry.amount / total) * 360 : 0
      accumulator += sweep
      return {
        ...entry,
        color: palette[index % palette.length],
        start,
        end: accumulator,
      }
    })
  }, [categoryData, total])

  const pieGradient =
    pieSegments.length > 0
      ? `conic-gradient(${pieSegments
          .map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`)
          .join(', ')})`
      : 'conic-gradient(#e2e8f0 0deg 360deg)'

  return (
    <section className="tab-panel">
      <h2>Analytics</h2>
      <p className="muted">Switch between categorical, time, and percent views of your spending.</p>

      <div className="mode-tabs">
        <button type="button" className={mode === 'category' ? 'active' : ''} onClick={() => setMode('category')}>
          Category
        </button>
        <button type="button" className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}>
          Time
        </button>
        <button type="button" className={mode === 'percent' ? 'active' : ''} onClick={() => setMode('percent')}>
          Percent
        </button>
      </div>

      {mode === 'category' && (
        <div className="card">
          <h3>Categorical Spend (All Categories)</h3>
          {categoryData.length === 0 && <p className="muted">No expense data yet.</p>}
          {categoryData.map((entry) => {
            const width = maxCategory > 0 ? (entry.amount / maxCategory) * 100 : 0
            return (
              <div key={entry.category} className="metric-row">
                <div className="metric-head">
                  <strong>{entry.category}</strong>
                  <span>${entry.amount.toFixed(2)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'time' && (
        <div className="card">
          <h3>Spend Over Time</h3>
          <div className="inline-form">
            <label>
              <span>Start</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              <span>End</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
          {timeData.length === 0 && <p className="muted">No expense data yet.</p>}
          {timeData.map((entry) => {
            const width = maxTime > 0 ? (entry.amount / maxTime) * 100 : 0
            return (
              <div key={entry.month} className="metric-row">
                <div className="metric-head">
                  <strong>{entry.month}</strong>
                  <span>${entry.amount.toFixed(2)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill alt" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'percent' && (
        <div className="card">
          <h3>Percent Allocation Pie Chart</h3>
          <p className="muted">Total spend considered: ${total.toFixed(2)}</p>
          {categoryData.length === 0 && <p className="muted">No expense data yet.</p>}
          <div className="pie-wrap">
            <div className="pie-chart" style={{ background: pieGradient }} aria-label="Spending pie chart" />
          </div>
          <div className="amounts-list">
            {categoryData.map((entry, index) => (
              <div key={`${entry.category}-pct`} className="metric-head percent-row">
                <strong>
                  <span
                    className="legend-dot"
                    style={{
                      background:
                        pieSegments[index]?.color ?? '#cbd5e1',
                    }}
                  />
                  {entry.category}
                </strong>
                <span>
                  {entry.percent.toFixed(1)}% (${entry.amount.toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
