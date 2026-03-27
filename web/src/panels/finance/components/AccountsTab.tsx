import { useEffect, useMemo, useState } from 'react'
import type { Account, AccountHealth, AccountType } from '../../../types/types'

interface AccountsTabProps {
  accounts: Account[]
  onUpdateAccount: (accountId: string, update: Partial<Account>) => void
  onAddAccount: (input: {
    name: string
    type: AccountType
    balance: number
    health: AccountHealth
  }) => void
  onDeleteAccount: (accountId: string) => void
}

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  investment: 'Investment',
  retirement: 'Retirement',
}

const HEALTH_LABELS: Record<AccountHealth, string> = {
  'on-track': 'On Track',
  watch: 'Watch',
  critical: 'Critical',
}

const LINE_COLORS = ['#0ea5e9', '#f97316', '#22c55e', '#8b5cf6', '#ef4444', '#14b8a6']

function normalizeHistory(account: Account) {
  const fallbackDate = account.updatedAt.slice(0, 10)
  const fallback = [{ date: fallbackDate, balance: account.balance }]
  return [...(account.history && account.history.length > 0 ? account.history : fallback)].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

function toPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return ''
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

export function AccountsTab(props: AccountsTabProps) {
  const { accounts, onUpdateAccount, onAddAccount, onDeleteAccount } = props
  const [visibleAccountIds, setVisibleAccountIds] = useState<string[]>(() => accounts.map((account) => account.id))
  const [draftsById, setDraftsById] = useState<
    Record<string, { name: string; type: AccountType; balance: number; health: AccountHealth }>
  >({})

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AccountType>('checking')
  const [newBalance, setNewBalance] = useState(0)
  const [newHealth, setNewHealth] = useState<AccountHealth>('on-track')

  useEffect(() => {
    setVisibleAccountIds((prev) => {
      const currentIds = new Set(accounts.map((account) => account.id))
      const next = prev.filter((id) => currentIds.has(id))
      accounts.forEach((account) => {
        if (!next.includes(account.id)) {
          next.push(account.id)
        }
      })
      return next
    })
  }, [accounts])

  useEffect(() => {
    setDraftsById((prev) => {
      const next: Record<string, { name: string; type: AccountType; balance: number; health: AccountHealth }> = {}
      accounts.forEach((account) => {
        next[account.id] = prev[account.id] ?? {
          name: account.name,
          type: account.type,
          balance: account.balance,
          health: account.health,
        }
      })
      return next
    })
  }, [accounts])

  const normalizedAccounts = useMemo(() => {
    return accounts.map((account) => ({
      ...account,
      history: normalizeHistory(account),
    }))
  }, [accounts])

  const axisDates = useMemo(() => {
    const set = new Set<string>()
    normalizedAccounts.forEach((account) => {
      account.history.forEach((point) => set.add(point.date))
    })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [normalizedAccounts])

  const chartSeries = useMemo(() => {
    if (axisDates.length === 0) {
      return [] as Array<{ account: Account; values: number[] }>
    }

    return normalizedAccounts.map((account) => {
      let last = account.balance
      const map = new Map(account.history.map((point) => [point.date, point.balance]))
      const values = axisDates.map((date) => {
        if (map.has(date)) {
          last = map.get(date) ?? last
        }
        return last
      })

      return { account, values }
    })
  }, [axisDates, normalizedAccounts])

  const visibleSeries = chartSeries.filter((series) => visibleAccountIds.includes(series.account.id))

  const { minY, maxY } = useMemo(() => {
    const values = visibleSeries.flatMap((series) => series.values)
    if (values.length === 0) {
      return { minY: 0, maxY: 1 }
    }

    const min = Math.min(...values)
    const max = Math.max(...values)
    if (Math.abs(max - min) < 0.0001) {
      return { minY: min - 1, maxY: max + 1 }
    }

    return { minY: min, maxY: max }
  }, [visibleSeries])

  function toggleSeries(accountId: string) {
    if (visibleAccountIds.includes(accountId)) {
      setVisibleAccountIds((prev) => prev.filter((id) => id !== accountId))
      return
    }

    setVisibleAccountIds((prev) => [...prev, accountId])
  }

  const chartWidth = 920
  const chartHeight = 280
  const leftPad = 42
  const rightPad = 16
  const topPad = 14
  const bottomPad = 36
  const innerWidth = chartWidth - leftPad - rightPad
  const innerHeight = chartHeight - topPad - bottomPad

  const xForIndex = (index: number) => {
    if (axisDates.length <= 1) {
      return leftPad + innerWidth / 2
    }
    return leftPad + (innerWidth * index) / (axisDates.length - 1)
  }

  const yForValue = (value: number) => {
    const normalized = (value - minY) / (maxY - minY)
    return topPad + (1 - normalized) * innerHeight
  }

  function updateDraft(
    accountId: string,
    field: 'name' | 'type' | 'balance' | 'health',
    value: string | number,
  ) {
    setDraftsById((prev) => {
      const current = prev[accountId]
      if (!current) {
        return prev
      }

      return {
        ...prev,
        [accountId]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  function saveAccount(account: Account) {
    const draft = draftsById[account.id]
    if (!draft) {
      return
    }

    const trimmedName = draft.name.trim()
    if (!trimmedName) {
      return
    }

    let nextHistory = normalizeHistory(account)
    if (Math.abs(draft.balance - account.balance) > 0.0001) {
      const today = new Date().toISOString().slice(0, 10)
      const last = nextHistory[nextHistory.length - 1]
      nextHistory =
        last && last.date === today
          ? [...nextHistory.slice(0, -1), { date: today, balance: draft.balance }]
          : [...nextHistory, { date: today, balance: draft.balance }]
    }

    onUpdateAccount(account.id, {
      name: trimmedName,
      type: draft.type,
      balance: draft.balance,
      health: draft.health,
      history: nextHistory,
      updatedAt: new Date().toISOString(),
    })
  }

  function addAccount() {
    const name = newName.trim()
    if (!name) {
      return
    }

    onAddAccount({
      name,
      type: newType,
      balance: newBalance,
      health: newHealth,
    })

    setNewName('')
    setNewType('checking')
    setNewBalance(0)
    setNewHealth('on-track')
  }

  return (
    <section className="tab-panel">
      <h2>Accounts</h2>
      <p className="muted">Track status for investments, checking, savings, and retirement accounts.</p>

      <div className="card">
        <h3>Add Account</h3>
        <div className="inline-form">
          <input
            type="text"
            placeholder="Account name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <select value={newType} onChange={(event) => setNewType(event.target.value as AccountType)}>
            <option value="checking">{TYPE_LABELS.checking}</option>
            <option value="savings">{TYPE_LABELS.savings}</option>
            <option value="investment">{TYPE_LABELS.investment}</option>
            <option value="retirement">{TYPE_LABELS.retirement}</option>
          </select>
          <input
            type="number"
            placeholder="Starting balance"
            value={newBalance}
            onChange={(event) => setNewBalance(Number(event.target.value))}
          />
          <select value={newHealth} onChange={(event) => setNewHealth(event.target.value as AccountHealth)}>
            <option value="on-track">{HEALTH_LABELS['on-track']}</option>
            <option value="watch">{HEALTH_LABELS.watch}</option>
            <option value="critical">{HEALTH_LABELS.critical}</option>
          </select>
          <button type="button" onClick={addAccount}>Add Account</button>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <input
                      type="text"
                      value={draftsById[account.id]?.name ?? account.name}
                      onChange={(event) => updateDraft(account.id, 'name', event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={draftsById[account.id]?.type ?? account.type}
                      onChange={(event) => updateDraft(account.id, 'type', event.target.value as AccountType)}
                    >
                      <option value="checking">{TYPE_LABELS.checking}</option>
                      <option value="savings">{TYPE_LABELS.savings}</option>
                      <option value="investment">{TYPE_LABELS.investment}</option>
                      <option value="retirement">{TYPE_LABELS.retirement}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={draftsById[account.id]?.balance ?? account.balance}
                      onChange={(event) => updateDraft(account.id, 'balance', Number(event.target.value))}
                    />
                  </td>
                  <td>
                    <select
                      value={draftsById[account.id]?.health ?? account.health}
                      onChange={(event) => updateDraft(account.id, 'health', event.target.value as AccountHealth)}
                    >
                      <option value="on-track">{HEALTH_LABELS['on-track']}</option>
                      <option value="watch">{HEALTH_LABELS.watch}</option>
                      <option value="critical">{HEALTH_LABELS.critical}</option>
                    </select>
                  </td>
                  <td>{account.updatedAt.slice(0, 10)}</td>
                  <td>
                    <div className="inline-form">
                      <button type="button" onClick={() => saveAccount(account)}>Save</button>
                      <button type="button" className="danger" onClick={() => onDeleteAccount(account.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6}><span className="muted">No accounts yet. Add your first account above.</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Account Balance Trend</h3>
        <p className="muted">Toggle each account line on or off in the graph.</p>

        <div className="line-toggle-row">
          {normalizedAccounts.map((account, index) => {
            const color = LINE_COLORS[index % LINE_COLORS.length]
            const checked = visibleAccountIds.includes(account.id)
            return (
              <label key={account.id} className="line-toggle-pill">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSeries(account.id)}
                />
                <span className="line-dot" style={{ background: color }} />
                <span>{account.name}</span>
              </label>
            )
          })}
        </div>

        <div className="line-chart-wrap">
          <svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Account line chart">
            <rect x={leftPad} y={topPad} width={innerWidth} height={innerHeight} fill="#f8fafc" stroke="#dbe4ee" />

            <text x={10} y={topPad + 10} className="axis-label">
              ${maxY.toFixed(2)}
            </text>
            <text x={10} y={topPad + innerHeight} className="axis-label">
              ${minY.toFixed(2)}
            </text>

            {axisDates.map((date, index) => {
              const x = xForIndex(index)
              return (
                <g key={date}>
                  <line x1={x} y1={topPad} x2={x} y2={topPad + innerHeight} stroke="#edf2f7" />
                  {index % Math.max(1, Math.ceil(axisDates.length / 6)) === 0 && (
                    <text x={x} y={chartHeight - 10} textAnchor="middle" className="axis-label">
                      {date.slice(5)}
                    </text>
                  )}
                </g>
              )
            })}

            {visibleSeries.map((series, seriesIndex) => {
              const color = LINE_COLORS[seriesIndex % LINE_COLORS.length]
              const points = series.values.map((value, index) => ({
                x: xForIndex(index),
                y: yForValue(value),
              }))

              return (
                <g key={series.account.id}>
                  <path d={toPath(points)} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
                  {points.map((point, index) => (
                    <circle key={`${series.account.id}-${index}`} cx={point.x} cy={point.y} r={2.8} fill={color} />
                  ))}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </section>
  )
}
