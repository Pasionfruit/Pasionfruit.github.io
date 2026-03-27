import { useEffect, useMemo, useState } from 'react'
import { AccountsTab } from './components/AccountsTab'
import { AnalyticsTab } from './components/AnalyticsTab'
import { BudgetTab } from './components/BudgetTab'
import { CalendarTab } from './components/CalendarTab'
import { GoalsVacationTab } from './components/GoalsVacationTab'
import { ImportTab } from './components/ImportTab'
import { TransactionsTab } from './components/TransactionsTab'
import { newId } from './lib/finance'
import {
  loadAccounts,
  loadBudgetCategories,
  loadCardPoints,
  loadNecessityCategories,
  loadPayslips,
  loadTransactions,
  loadVacationGoals,
  saveAccounts,
  saveBudgetCategories,
  saveCardPoints,
  saveNecessityCategories,
  savePayslips,
  saveTransactions,
  saveVacationGoals,
} from './lib/storage'
import type {
  Account,
  AccountHealth,
  AccountType,
  BudgetCategory,
  CardPoints,
  Payslip,
  Transaction,
  VacationGoal,
} from '../../types/types'
import './App.css'

interface FinanceAppProps {
  onBackToHub?: () => void
  onSignOut?: () => void
}

type Tab =
  | 'import'
  | 'calendar'
  | 'transactions'
  | 'accounts'
  | 'goals-vacation'
  | 'analytics'
  | 'budget'

type Section = 'calendar' | 'overview' | 'analysis'
type DateFilterMode = 'month' | 'year' | 'all-time'

function currentMonthValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

function sectionFromTab(tab: Tab): Section {
  if (tab === 'calendar') {
    return 'calendar'
  }
  if (tab === 'accounts' || tab === 'goals-vacation' || tab === 'budget') {
    return 'overview'
  }
  return 'analysis'
}

function App({ onBackToHub, onSignOut }: FinanceAppProps = {}) {
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('calendar')
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('month')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthValue())
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()))
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions())
  const [payslips, setPayslips] = useState<Payslip[]>(() => loadPayslips())
  const [necessityCategories, setNecessityCategories] = useState<string[]>(() =>
    loadNecessityCategories(),
  )
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts())
  const [vacationGoals, setVacationGoals] = useState<VacationGoal[]>(() => loadVacationGoals())
  const [cardPoints, setCardPoints] = useState<CardPoints[]>(() => loadCardPoints())
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() =>
    loadBudgetCategories(),
  )

  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  useEffect(() => {
    savePayslips(payslips)
  }, [payslips])

  useEffect(() => {
    saveNecessityCategories(necessityCategories)
  }, [necessityCategories])

  useEffect(() => {
    saveAccounts(accounts)
  }, [accounts])

  useEffect(() => {
    saveVacationGoals(vacationGoals)
  }, [vacationGoals])

  useEffect(() => {
    saveCardPoints(cardPoints)
  }, [cardPoints])

  useEffect(() => {
    saveBudgetCategories(budgetCategories)
  }, [budgetCategories])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (dateFilterMode === 'all-time') {
        return true
      }
      if (dateFilterMode === 'month') {
        return transaction.date.slice(0, 7) === selectedMonth
      }
      return transaction.date.slice(0, 4) === selectedYear
    })
  }, [dateFilterMode, selectedMonth, selectedYear, transactions])

  const overview = useMemo(() => {
    const totalExpenses = filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const totalIncome = filteredTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0)

    return {
      totalExpenses,
      totalIncome,
      netCashFlow: totalIncome - totalExpenses,
    }
  }, [filteredTransactions])

  function mergeTransactions(incoming: Transaction[]) {
    setTransactions((prev) => [...prev, ...incoming])
  }

  function mergePayslips(incoming: Payslip[]) {
    setPayslips((prev) => [...prev, ...incoming])
  }

  function updateTransactionCategory(transactionId: string, nextCategory: string) {
    setTransactions((prev) =>
      prev.map((transaction) => {
        if (transaction.id !== transactionId) {
          return transaction
        }

        return {
          ...transaction,
          category: nextCategory,
        }
      }),
    )
  }

  function updateAccount(accountId: string, update: Partial<Account>) {
    setAccounts((prev) =>
      prev.map((account) => (account.id === accountId ? { ...account, ...update } : account)),
    )
  }

  function addAccount(input: {
    name: string
    type: AccountType
    balance: number
    health: AccountHealth
  }) {
    const now = new Date().toISOString()
    setAccounts((prev) => [
      ...prev,
      {
        id: newId(),
        name: input.name,
        type: input.type,
        balance: input.balance,
        health: input.health,
        updatedAt: now,
        history: [{ date: now.slice(0, 10), balance: input.balance }],
      },
    ])
  }

  function deleteAccount(accountId: string) {
    setAccounts((prev) => prev.filter((account) => account.id !== accountId))
  }

  function addGoal(goal: VacationGoal) {
    setVacationGoals((prev) => [...prev, goal])
  }

  function updateGoal(goalId: string, update: Partial<VacationGoal>) {
    setVacationGoals((prev) => prev.map((goal) => (goal.id === goalId ? { ...goal, ...update } : goal)))
  }

  function deleteGoal(goalId: string) {
    setVacationGoals((prev) => prev.filter((goal) => goal.id !== goalId))
  }

  function addCardPointsEntry(entry: CardPoints) {
    setCardPoints((prev) => [...prev, entry])
  }

  function updateCardPointsEntry(entryId: string, update: Partial<CardPoints>) {
    setCardPoints((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, ...update } : entry)))
  }

  function deleteCardPointsEntry(entryId: string) {
    setCardPoints((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  function addBudgetCategory(category: BudgetCategory) {
    setBudgetCategories((prev) => [...prev, category])
  }

  function updateBudgetCategory(categoryId: string, update: Partial<BudgetCategory>) {
    setBudgetCategories((prev) =>
      prev.map((category) => (category.id === categoryId ? { ...category, ...update } : category)),
    )
  }

  function deleteBudgetCategory(categoryId: string) {
    setBudgetCategories((prev) => prev.filter((category) => category.id !== categoryId))
  }

  const activeSection = sectionFromTab(activeTab)

  function setSection(section: Section) {
    if (section === 'calendar') {
      setActiveTab('calendar')
      return
    }

    if (section === 'overview') {
      setActiveTab('accounts')
      return
    }

    setActiveTab('import')
  }

  return (
    <div className="app-shell">
      <header className={`hero ${headerCollapsed ? 'collapsed' : ''}`}>
        <div className="hero-top-row">
          <div>
            <h1>Financial Dashboard</h1>
            {!headerCollapsed && (
              <p>
                Import monthly CSV transactions and payslip PDFs, then review spending in calendar and analytics views.
              </p>
            )}
          </div>
          <div className="hero-actions">
            {onBackToHub && (
              <button
                type="button"
                className="hero-toggle"
                onClick={onBackToHub}
              >
                Back to Hub
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                className="hero-toggle"
                onClick={onSignOut}
              >
                Sign Out
              </button>
            )}
            <button
              type="button"
              className="hero-toggle"
              onClick={() => setHeaderCollapsed((prev) => !prev)}
              aria-expanded={!headerCollapsed}
              aria-label={headerCollapsed ? 'Expand dashboard header' : 'Collapse dashboard header'}
            >
              {headerCollapsed ? 'Expand Header' : 'Collapse Header'}
            </button>
          </div>
        </div>

        <div className="hero-controls">
          <div className="filter-tabs" role="group" aria-label="Date range mode">
            <button
              type="button"
              className={dateFilterMode === 'month' ? 'active' : ''}
              onClick={() => setDateFilterMode('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={dateFilterMode === 'year' ? 'active' : ''}
              onClick={() => setDateFilterMode('year')}
            >
              Year
            </button>
            <button
              type="button"
              className={dateFilterMode === 'all-time' ? 'active' : ''}
              onClick={() => setDateFilterMode('all-time')}
            >
              All Time
            </button>
          </div>

          {dateFilterMode === 'month' && (
            <label className="range-input">
              <span>Select month</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
          )}

          {dateFilterMode === 'year' && (
            <label className="range-input">
              <span>Select year</span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
              />
            </label>
          )}
        </div>

        {!headerCollapsed && (
        <div className="summary-grid">
          <article className="summary-card">
            <small>Total expenses</small>
            <strong>${overview.totalExpenses.toFixed(2)}</strong>
          </article>
          <article className="summary-card">
            <small>Total income</small>
            <strong>${overview.totalIncome.toFixed(2)}</strong>
          </article>
          <article className="summary-card">
            <small>Net cash flow</small>
            <strong>${overview.netCashFlow.toFixed(2)}</strong>
          </article>
        </div>
        )}
      </header>

      <nav className="section-nav" aria-label="Dashboard categories">
        <button
          type="button"
          className={activeSection === 'calendar' ? 'active' : ''}
          onClick={() => setSection('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          className={activeSection === 'overview' ? 'active' : ''}
          onClick={() => setSection('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={activeSection === 'analysis' ? 'active' : ''}
          onClick={() => setSection('analysis')}
        >
          Analysis
        </button>
      </nav>

      {activeSection === 'overview' && (
        <nav className="subtab-nav" aria-label="Overview subtabs">
          <button
            type="button"
            className={activeTab === 'accounts' ? 'active' : ''}
            onClick={() => setActiveTab('accounts')}
          >
            Accounts
          </button>
          <button
            type="button"
            className={activeTab === 'goals-vacation' ? 'active' : ''}
            onClick={() => setActiveTab('goals-vacation')}
          >
            Milestones
          </button>
          <button
            type="button"
            className={activeTab === 'budget' ? 'active' : ''}
            onClick={() => setActiveTab('budget')}
          >
            Budget
          </button>
        </nav>
      )}

      {activeSection === 'analysis' && (
        <nav className="subtab-nav" aria-label="Analysis subtabs">
          <button
            type="button"
            className={activeTab === 'import' ? 'active' : ''}
            onClick={() => setActiveTab('import')}
          >
            Import
          </button>
          <button
            type="button"
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button
            type="button"
            className={activeTab === 'transactions' ? 'active' : ''}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
        </nav>
      )}

      <main>
        {activeTab === 'import' && (
          <ImportTab
            existingTransactions={transactions}
            onImportTransactions={mergeTransactions}
            onImportPayslips={mergePayslips}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarTab
            transactions={filteredTransactions}
            necessityCategories={necessityCategories}
          />
        )}

        {activeTab === 'transactions' && <TransactionsTab transactions={filteredTransactions} />}

        {activeTab === 'accounts' && (
          <AccountsTab
            accounts={accounts}
            onUpdateAccount={updateAccount}
            onAddAccount={addAccount}
            onDeleteAccount={deleteAccount}
          />
        )}

        {activeTab === 'goals-vacation' && (
          <GoalsVacationTab
            goals={vacationGoals}
            cardPoints={cardPoints}
            onAddGoal={addGoal}
            onUpdateGoal={updateGoal}
            onDeleteGoal={deleteGoal}
            onAddCardPoints={addCardPointsEntry}
            onUpdateCardPoints={updateCardPointsEntry}
            onDeleteCardPoints={deleteCardPointsEntry}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsTab transactions={filteredTransactions} />}

        {activeTab === 'budget' && (
          <BudgetTab
            transactions={filteredTransactions}
            budgetCategories={budgetCategories}
            necessityCategories={necessityCategories}
            onUpdateTransactionCategory={updateTransactionCategory}
            onSetNecessityCategories={setNecessityCategories}
            onAddBudgetCategory={addBudgetCategory}
            onUpdateBudgetCategory={updateBudgetCategory}
            onDeleteBudgetCategory={deleteBudgetCategory}
          />
        )}
      </main>
    </div>
  )
}

export default App
