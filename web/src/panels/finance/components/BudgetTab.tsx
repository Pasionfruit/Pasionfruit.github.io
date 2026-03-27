import { useMemo, useState } from 'react'
import { newId } from '../lib/finance'
import type { BudgetCategory, Transaction } from '../../../types/types'

interface BudgetTabProps {
  transactions: Transaction[]
  budgetCategories: BudgetCategory[]
  necessityCategories: string[]
  onUpdateTransactionCategory: (transactionId: string, category: string) => void
  onSetNecessityCategories: (categories: string[]) => void
  onAddBudgetCategory: (category: BudgetCategory) => void
  onUpdateBudgetCategory: (categoryId: string, update: Partial<BudgetCategory>) => void
  onDeleteBudgetCategory: (categoryId: string) => void
}

export function BudgetTab(props: BudgetTabProps) {
  const {
    transactions,
    budgetCategories,
    necessityCategories,
    onUpdateTransactionCategory,
    onSetNecessityCategories,
    onAddBudgetCategory,
    onUpdateBudgetCategory,
    onDeleteBudgetCategory,
  } = props

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryLimit, setNewCategoryLimit] = useState(0)

  const orderedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions])

  const knownCategories = useMemo(() => {
    const categories = new Set<string>()
    transactions.forEach((transaction) => {
      categories.add(transaction.category)
    })
    budgetCategories.forEach((item) => categories.add(item.name))
    return [...categories].sort((a, b) => a.localeCompare(b))
  }, [budgetCategories, transactions])

  function toggleNecessity(category: string) {
    const exists = necessityCategories.includes(category)
    if (exists) {
      onSetNecessityCategories(necessityCategories.filter((item) => item !== category))
      return
    }

    onSetNecessityCategories([...necessityCategories, category])
  }

  function addBudgetCategory() {
    const name = newCategoryName.trim()
    if (!name || newCategoryLimit <= 0) {
      return
    }

    const now = new Date().toISOString()
    onAddBudgetCategory({
      id: newId(),
      name,
      monthlyLimit: newCategoryLimit,
      createdAt: now,
      updatedAt: now,
    })

    setNewCategoryName('')
    setNewCategoryLimit(0)
  }

  return (
    <section className="tab-panel">
      <h2>Budget</h2>
      <p className="muted">Set category budgets, categorize transactions, and control necessity categories.</p>

      <div className="settings-grid">
        <div className="card">
          <h3>Category Budget CRUD</h3>
          <div className="inline-form">
            <input
              type="text"
              placeholder="Category name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <input
              type="number"
              placeholder="Monthly budget"
              value={newCategoryLimit}
              onChange={(event) => setNewCategoryLimit(Number(event.target.value))}
            />
            <button type="button" onClick={addBudgetCategory}>Add Budget</button>
          </div>

          <div className="table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Monthly Limit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgetCategories.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) =>
                          onUpdateBudgetCategory(item.id, {
                            name: event.target.value,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.monthlyLimit}
                        onChange={(event) =>
                          onUpdateBudgetCategory(item.id, {
                            monthlyLimit: Number(event.target.value),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <button type="button" className="danger" onClick={() => onDeleteBudgetCategory(item.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {budgetCategories.length === 0 && (
                  <tr>
                    <td colSpan={3}><span className="muted">No budget categories yet.</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Necessity Categories</h3>
          <p className="muted">Used by Calendar light-orange necessity highlighting.</p>
          <div className="chip-list">
            {knownCategories.map((category) => {
              const active = necessityCategories.includes(category)
              return (
                <button
                  key={category}
                  type="button"
                  className={`chip ${active ? 'active' : ''}`}
                  onClick={() => toggleNecessity(category)}
                >
                  {active ? 'On' : 'Off'} - {category}
                </button>
              )
            })}
          </div>
        </div>

        <div className="card table-card">
          <h3>Categorize Transactions</h3>
          {orderedTransactions.length > 0 && (
            <div className="table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td>{transaction.type}</td>
                      <td>${transaction.amount.toFixed(2)}</td>
                      <td>
                        <input
                          type="text"
                          value={transaction.category}
                          onChange={(event) =>
                            onUpdateTransactionCategory(transaction.id, event.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {orderedTransactions.length === 0 && <p className="muted">No transactions available.</p>}
        </div>
      </div>
    </section>
  )
}
