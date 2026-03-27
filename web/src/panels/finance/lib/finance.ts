import type { CsvImportResult, Payslip, Transaction, TransactionType } from '../../../types/types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function compactWhitespaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1
      }

      currentRow.push(currentValue)
      currentValue = ''

      const populated = currentRow.some((cell) => cell.trim().length > 0)
      if (populated) {
        rows.push(currentRow)
      }
      currentRow = []
      continue
    }

    currentValue += char
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)
    const populated = currentRow.some((cell) => cell.trim().length > 0)
    if (populated) {
      rows.push(currentRow)
    }
  }

  return rows
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

interface ColumnMapping {
  date: number
  amount: number
  description: number
  category?: number
  type?: number
}

function detectColumn(headers: string[], keys: string[]): number {
  return headers.findIndex((header) => keys.some((key) => header.includes(key)))
}

function detectMapping(headerRow: string[]): ColumnMapping | null {
  const headers = headerRow.map((header) => normalizeHeader(header))

  const date = detectColumn(headers, ['date', 'posted', 'transaction date'])
  const amount = detectColumn(headers, ['amount', 'debit', 'credit', 'value'])
  const description = detectColumn(headers, ['description', 'merchant', 'details', 'payee'])

  if (date < 0 || amount < 0 || description < 0) {
    return null
  }

  const category = detectColumn(headers, ['category', 'type'])
  const type = detectColumn(headers, ['transaction type', 'flow'])

  return {
    date,
    amount,
    description,
    category: category >= 0 ? category : undefined,
    type: type >= 0 ? type : undefined,
  }
}

function normalizeDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) {
    return null
  }

  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10)
  }

  const matched = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (!matched) {
    return null
  }

  const month = Number(matched[1])
  const day = Number(matched[2])
  let year = Number(matched[3])
  if (year < 100) {
    year += 2000
  }

  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function normalizeAmount(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const isNegative = trimmed.includes('(') || trimmed.startsWith('-')
  const normalized = trimmed.replace(/[$,()\s]/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const value = Math.abs(parsed)
  return isNegative ? -value : value
}

function inferCategory(description: string): string {
  const value = description.toLowerCase()

  if (/rent|landlord|mortgage/.test(value)) return 'Housing'
  if (/grocery|market|walmart|aldi|tesco|costco/.test(value)) return 'Groceries'
  if (/uber|lyft|train|fuel|gas|shell|chevron/.test(value)) return 'Transport'
  if (/netflix|spotify|cinema|steam|game/.test(value)) return 'Entertainment'
  if (/electric|water|utility|internet|phone/.test(value)) return 'Utilities'
  if (/salary|payroll|payslip|income|deposit/.test(value)) return 'Income'

  return 'Other'
}

function inferType(amount: number, description: string, explicitType?: string): TransactionType {
  const normalizedType = explicitType?.toLowerCase().trim() ?? ''

  if (normalizedType.includes('transfer')) {
    return 'transfer'
  }
  if (normalizedType.includes('income') || normalizedType.includes('credit')) {
    return 'income'
  }
  if (normalizedType.includes('expense') || normalizedType.includes('debit')) {
    return 'expense'
  }

  if (/transfer/.test(description.toLowerCase())) {
    return 'transfer'
  }

  return amount < 0 ? 'expense' : 'income'
}

function dedupeKey(tx: Pick<Transaction, 'date' | 'amount' | 'description'>): string {
  return `${tx.date}|${tx.amount.toFixed(2)}|${tx.description.toLowerCase()}`
}

export function importTransactionsFromCsv(fileName: string, csvText: string): CsvImportResult {
  const rows = parseCsvRows(csvText)
  if (rows.length < 2) {
    return { transactions: [], errors: [`${fileName}: no data rows found`] }
  }

  const mapping = detectMapping(rows[0])
  if (!mapping) {
    return {
      transactions: [],
      errors: [
        `${fileName}: unable to detect date, amount, and description columns from headers`,
      ],
    }
  }

  const transactions: Transaction[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  rows.slice(1).forEach((row, index) => {
    const line = index + 2
    const dateValue = row[mapping.date] ?? ''
    const amountValue = row[mapping.amount] ?? ''
    const descriptionValue = compactWhitespaces(row[mapping.description] ?? '')

    const date = normalizeDate(dateValue)
    const amount = normalizeAmount(amountValue)

    if (!date || amount === null || !descriptionValue) {
      errors.push(`${fileName}: line ${line} is invalid and was skipped`)
      return
    }

    const explicitCategory = mapping.category !== undefined ? compactWhitespaces(row[mapping.category] ?? '') : ''
    const explicitType = mapping.type !== undefined ? compactWhitespaces(row[mapping.type] ?? '') : ''

    const type = inferType(amount, descriptionValue, explicitType)
    const magnitude = Math.abs(amount)

    const candidate: Transaction = {
      id: newId(),
      date,
      amount: magnitude,
      description: descriptionValue,
      category: explicitCategory || inferCategory(descriptionValue),
      type,
      sourceFile: fileName,
      importedAt: new Date().toISOString(),
    }

    const key = dedupeKey(candidate)
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    transactions.push(candidate)
  })

  return { transactions, errors }
}

function parseAmountFromText(text: string, label: string): number | null {
  const pattern = new RegExp(`${label}[^0-9-]*(-?\\d[\\d,]*(?:\\.\\d{2})?)`, 'i')
  const match = text.match(pattern)
  if (!match) {
    return null
  }

  return normalizeAmount(match[1])
}

function parseDateFromText(text: string, label: string): string | null {
  const pattern = new RegExp(`${label}[^0-9]*(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`, 'i')
  const match = text.match(pattern)
  if (!match) {
    return null
  }

  return normalizeDate(match[1])
}

export function parsePayslipText(fileName: string, text: string): Payslip | null {
  const cleaned = compactWhitespaces(text)

  const payDate =
    parseDateFromText(cleaned, 'pay date') ??
    parseDateFromText(cleaned, 'payment date') ??
    parseDateFromText(cleaned, 'period end') ??
    new Date().toISOString().slice(0, 10)

  const netAmount =
    parseAmountFromText(cleaned, 'net pay') ??
    parseAmountFromText(cleaned, 'net amount') ??
    parseAmountFromText(cleaned, 'total pay')

  if (!netAmount || netAmount <= 0) {
    return null
  }

  const grossAmount =
    parseAmountFromText(cleaned, 'gross pay') ??
    parseAmountFromText(cleaned, 'gross amount') ??
    undefined

  const periodStart = parseDateFromText(cleaned, 'period start') ?? undefined
  const periodEnd = parseDateFromText(cleaned, 'period end') ?? undefined

  return {
    id: newId(),
    sourceFile: fileName,
    payDate,
    periodStart,
    periodEnd,
    grossAmount: grossAmount ? Math.abs(grossAmount) : undefined,
    netAmount: Math.abs(netAmount),
    importedAt: new Date().toISOString(),
  }
}

export function extractTextFallback(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('latin1')
  return decoder.decode(buffer)
}

export function toIncomeTransactionFromPayslip(payslip: Payslip): Transaction {
  return {
    id: newId(),
    date: payslip.payDate,
    amount: payslip.netAmount,
    description: `Payslip income (${payslip.sourceFile})`,
    category: 'Income',
    type: 'income',
    sourceFile: payslip.sourceFile,
    importedAt: payslip.importedAt,
  }
}

export function isSameTransaction(a: Transaction, b: Transaction): boolean {
  return (
    a.date === b.date &&
    Math.abs(a.amount - b.amount) < 0.005 &&
    a.description.trim().toLowerCase() === b.description.trim().toLowerCase()
  )
}
