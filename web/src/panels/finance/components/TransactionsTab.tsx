import { useMemo } from 'react'
import type { Transaction } from '../../../types/types'

interface TransactionsTabProps {
  transactions: Transaction[]
}

function toSignedPrice(transaction: Transaction): number {
  if (transaction.type === 'income') {
    return transaction.amount
  }
  if (transaction.type === 'expense') {
    return -transaction.amount
  }
  return 0
}

export function TransactionsTab(props: TransactionsTabProps) {
  const { transactions } = props

  const orderedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions])

  return (
    <section className="tab-panel">
      <h2>Transactions</h2>
      <p className="muted">All imported and generated transactions are listed below.</p>

      <div className="card table-card">
        {orderedTransactions.length === 0 && <p className="muted">No transactions yet. Import CSV or PDF files first.</p>}

        {orderedTransactions.length > 0 && (
          <div className="table-wrap">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Price</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {orderedTransactions.map((transaction) => {
                  const signedPrice = toSignedPrice(transaction)
                  return (
                    <tr key={transaction.id}>
                      <td>
                        <span className={`type-pill ${transaction.type}`}>{transaction.type}</span>
                      </td>
                      <td>${transaction.amount.toFixed(2)}</td>
                      <td className={signedPrice < 0 ? 'negative' : 'positive'}>
                        {signedPrice < 0 ? '-' : '+'}${Math.abs(signedPrice).toFixed(2)}
                      </td>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td>{transaction.category}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
