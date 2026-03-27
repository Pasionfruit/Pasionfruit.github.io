import type {
  Account,
  BudgetCategory,
  CalendarAnnotation,
  CardPoints,
  Payslip,
  Transaction,
  VacationGoal,
} from '../../../types/types'

const TRANSACTIONS_KEY = 'fd.transactions'
const PAYSLIPS_KEY = 'fd.payslips'
const ANNOTATIONS_KEY = 'fd.annotations'
const NECESSITY_CATEGORIES_KEY = 'fd.necessityCategories'
const ACCOUNTS_KEY = 'fd.accounts'
const VACATION_GOALS_KEY = 'fd.vacationGoals'
const CARD_POINTS_KEY = 'fd.cardPoints'
const BUDGET_CATEGORIES_KEY = 'fd.budgetCategories'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadTransactions(): Transaction[] {
  const seed: Transaction[] = [
    {
      id: 'tx-2026-03-01-rent',
      date: '2026-03-01',
      amount: 1850,
      description: 'Monthly Rent',
      category: 'Housing',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-01T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-03-grocery',
      date: '2026-03-03',
      amount: 124.37,
      description: 'Groceries',
      category: 'Groceries',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-03T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-05-gas',
      date: '2026-03-05',
      amount: 56.12,
      description: 'Gas Station',
      category: 'Transport',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-05T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-06-subscription',
      date: '2026-03-06',
      amount: 17.99,
      description: 'Streaming Subscription',
      category: 'Entertainment',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-06T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-08-transfer',
      date: '2026-03-08',
      amount: 500,
      description: 'Transfer to Savings',
      category: 'Savings',
      type: 'transfer',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-08T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-14-dining',
      date: '2026-03-14',
      amount: 78.44,
      description: 'Dinner Out',
      category: 'Dining',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-14T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-20-salary',
      date: '2026-03-20',
      amount: 5200,
      description: 'Biweekly Salary',
      category: 'Payroll',
      type: 'income',
      sourceFile: 'seed-payslip.pdf',
      importedAt: '2026-03-20T09:00:00.000Z',
    },
    {
      id: 'tx-2026-03-22-utilities',
      date: '2026-03-22',
      amount: 143.28,
      description: 'Electric + Water Bill',
      category: 'Utilities',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-03-22T09:00:00.000Z',
    },
    {
      id: 'tx-2026-02-15-salary',
      date: '2026-02-15',
      amount: 5100,
      description: 'Biweekly Salary',
      category: 'Payroll',
      type: 'income',
      sourceFile: 'seed-payslip.pdf',
      importedAt: '2026-02-15T09:00:00.000Z',
    },
    {
      id: 'tx-2026-02-17-grocery',
      date: '2026-02-17',
      amount: 98.53,
      description: 'Groceries',
      category: 'Groceries',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-02-17T09:00:00.000Z',
    },
    {
      id: 'tx-2026-01-10-flight',
      date: '2026-01-10',
      amount: 640,
      description: 'Flight Booking',
      category: 'Travel',
      type: 'expense',
      sourceFile: 'seed.csv',
      importedAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'tx-2025-12-20-bonus',
      date: '2025-12-20',
      amount: 2500,
      description: 'Year-End Bonus',
      category: 'Payroll',
      type: 'income',
      sourceFile: 'seed-payslip.pdf',
      importedAt: '2025-12-20T09:00:00.000Z',
    },
  ]

  return safeParse<Transaction[]>(localStorage.getItem(TRANSACTIONS_KEY), seed)
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions))
}

export function loadPayslips(): Payslip[] {
  const seed: Payslip[] = [
    {
      id: 'pay-2026-03-20',
      sourceFile: 'seed-payslip-mar.pdf',
      payDate: '2026-03-20',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-15',
      grossAmount: 6500,
      netAmount: 5200,
      notes: 'Seed payslip data',
      importedAt: '2026-03-20T09:00:00.000Z',
    },
    {
      id: 'pay-2026-02-15',
      sourceFile: 'seed-payslip-feb.pdf',
      payDate: '2026-02-15',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-14',
      grossAmount: 6350,
      netAmount: 5100,
      notes: 'Seed payslip data',
      importedAt: '2026-02-15T09:00:00.000Z',
    },
  ]

  return safeParse<Payslip[]>(localStorage.getItem(PAYSLIPS_KEY), seed)
}

export function savePayslips(payslips: Payslip[]): void {
  localStorage.setItem(PAYSLIPS_KEY, JSON.stringify(payslips))
}

export function loadAnnotations(): CalendarAnnotation[] {
  return safeParse<CalendarAnnotation[]>(localStorage.getItem(ANNOTATIONS_KEY), [])
}

export function saveAnnotations(annotations: CalendarAnnotation[]): void {
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations))
}

export function loadNecessityCategories(): string[] {
  return safeParse<string[]>(localStorage.getItem(NECESSITY_CATEGORIES_KEY), [
    'Groceries',
    'Housing',
    'Utilities',
    'Transport',
  ])
}

export function saveNecessityCategories(categories: string[]): void {
  localStorage.setItem(NECESSITY_CATEGORIES_KEY, JSON.stringify(categories))
}

export function loadAccounts(): Account[] {
  const now = '2026-03-25T08:00:00.000Z'
  const seed: Account[] = [
    {
      id: 'acct-checking',
      name: 'Primary Checking',
      type: 'checking',
      balance: 4275.21,
      health: 'on-track',
      updatedAt: now,
      history: [
        { date: '2026-01-31', balance: 3650.45 },
        { date: '2026-02-28', balance: 4025.73 },
        { date: '2026-03-25', balance: 4275.21 },
      ],
    },
    {
      id: 'acct-savings',
      name: 'Emergency Savings',
      type: 'savings',
      balance: 12840.66,
      health: 'on-track',
      updatedAt: now,
      history: [
        { date: '2026-01-31', balance: 11840.66 },
        { date: '2026-02-28', balance: 12340.66 },
        { date: '2026-03-25', balance: 12840.66 },
      ],
    },
    {
      id: 'acct-investment',
      name: 'Investment Portfolio',
      type: 'investment',
      balance: 24120.19,
      health: 'watch',
      updatedAt: now,
      history: [
        { date: '2026-01-31', balance: 23680.42 },
        { date: '2026-02-28', balance: 24515.03 },
        { date: '2026-03-25', balance: 24120.19 },
      ],
    },
    {
      id: 'acct-retirement',
      name: 'Retirement Fund',
      type: 'retirement',
      balance: 58210.48,
      health: 'on-track',
      updatedAt: now,
      history: [
        { date: '2026-01-31', balance: 56630.11 },
        { date: '2026-02-28', balance: 57490.22 },
        { date: '2026-03-25', balance: 58210.48 },
      ],
    },
  ]

  const parsed = safeParse<Account[]>(localStorage.getItem(ACCOUNTS_KEY), seed)

  return parsed.map((account) => {
    const history =
      account.history && account.history.length > 0
        ? account.history
        : [{ date: account.updatedAt.slice(0, 10), balance: account.balance }]

    return {
      ...account,
      history,
    }
  })
}

export function saveAccounts(accounts: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function loadVacationGoals(): VacationGoal[] {
  const seed: VacationGoal[] = [
    {
      id: 'goal-japan-2026',
      destination: 'Tokyo, Japan',
      targetAmount: 6500,
      savedAmount: 2400,
      targetDate: '2026-11-15',
      notes: 'Flights and hotels',
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-03-18T10:00:00.000Z',
    },
    {
      id: 'goal-roadtrip-2026',
      destination: 'California Road Trip',
      targetAmount: 2200,
      savedAmount: 980,
      targetDate: '2026-07-01',
      notes: 'Gas and stays',
      createdAt: '2026-02-02T10:00:00.000Z',
      updatedAt: '2026-03-12T10:00:00.000Z',
    },
  ]

  return safeParse<VacationGoal[]>(localStorage.getItem(VACATION_GOALS_KEY), seed)
}

export function saveVacationGoals(goals: VacationGoal[]): void {
  localStorage.setItem(VACATION_GOALS_KEY, JSON.stringify(goals))
}

export function loadCardPoints(): CardPoints[] {
  const seed: CardPoints[] = [
    {
      id: 'cp-chase-sapphire',
      cardName: 'Chase Sapphire',
      points: 84210,
      centsPerPoint: 1.5,
      updatedAt: '2026-03-23T10:00:00.000Z',
    },
    {
      id: 'cp-amex-gold',
      cardName: 'Amex Gold',
      points: 65220,
      centsPerPoint: 1.2,
      updatedAt: '2026-03-22T10:00:00.000Z',
    },
    {
      id: 'cp-capitalone-venture',
      cardName: 'Capital One Venture',
      points: 47550,
      centsPerPoint: 1,
      updatedAt: '2026-03-21T10:00:00.000Z',
    },
  ]

  return safeParse<CardPoints[]>(localStorage.getItem(CARD_POINTS_KEY), seed)
}

export function saveCardPoints(points: CardPoints[]): void {
  localStorage.setItem(CARD_POINTS_KEY, JSON.stringify(points))
}

export function loadBudgetCategories(): BudgetCategory[] {
  const seed: BudgetCategory[] = [
    {
      id: 'budget-housing',
      name: 'Housing',
      monthlyLimit: 1900,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    },
    {
      id: 'budget-groceries',
      name: 'Groceries',
      monthlyLimit: 600,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    },
    {
      id: 'budget-transport',
      name: 'Transport',
      monthlyLimit: 300,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    },
    {
      id: 'budget-entertainment',
      name: 'Entertainment',
      monthlyLimit: 250,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    },
  ]

  return safeParse<BudgetCategory[]>(localStorage.getItem(BUDGET_CATEGORIES_KEY), seed)
}

export function saveBudgetCategories(categories: BudgetCategory[]): void {
  localStorage.setItem(BUDGET_CATEGORIES_KEY, JSON.stringify(categories))
}
