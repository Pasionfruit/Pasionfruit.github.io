export type TransactionType = 'expense' | 'income' | 'transfer'

export interface Transaction {
  id: string
  date: string
  amount: number
  description: string
  category: string
  type: TransactionType
  sourceFile: string
  importedAt: string
}

export interface Payslip {
  id: string
  sourceFile: string
  payDate: string
  periodStart?: string
  periodEnd?: string
  grossAmount?: number
  netAmount: number
  notes?: string
  importedAt: string
}

export interface CalendarAnnotation {
  id: string
  date: string
  note: string
  linkedTransactionIds: string[]
  createdAt: string
  updatedAt: string
}

export interface CsvImportResult {
  transactions: Transaction[]
  errors: string[]
}

export interface DashboardData {
  transactions: Transaction[]
  payslips: Payslip[]
  annotations: CalendarAnnotation[]
}

export type AccountType = 'checking' | 'savings' | 'investment' | 'retirement'
export type AccountHealth = 'on-track' | 'watch' | 'critical'

export interface AccountHistoryPoint {
  date: string
  balance: number
}

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  health: AccountHealth
  updatedAt: string
  history?: AccountHistoryPoint[]
}

export interface VacationGoal {
  id: string
  destination: string
  targetAmount: number
  savedAmount: number
  targetDate: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CardPoints {
  id: string
  cardName: string
  points: number
  centsPerPoint: number
  updatedAt: string
}

export interface BudgetCategory {
  id: string
  name: string
  monthlyLimit: number
  createdAt: string
  updatedAt: string
}
