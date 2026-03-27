import { useMemo, useState } from 'react'
import {
  extractTextFallback,
  importTransactionsFromCsv,
  isSameTransaction,
  parsePayslipText,
  toIncomeTransactionFromPayslip,
} from '../lib/finance'
import type { Payslip, Transaction } from '../../../types/types'

interface ImportTabProps {
  existingTransactions: Transaction[]
  onImportTransactions: (transactions: Transaction[]) => void
  onImportPayslips: (payslips: Payslip[]) => void
}

interface ImportSummary {
  importedTransactions: number
  importedPayslips: number
  skippedDuplicates: number
  errors: string[]
}

const INITIAL_SUMMARY: ImportSummary = {
  importedTransactions: 0,
  importedPayslips: 0,
  skippedDuplicates: 0,
  errors: [],
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error(`Invalid data for ${file.name}`))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function ImportTab(props: ImportTabProps) {
  const { existingTransactions, onImportTransactions, onImportPayslips } = props

  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<ImportSummary>(INITIAL_SUMMARY)

  const hasSummary = useMemo(() => {
    return (
      summary.importedTransactions > 0 ||
      summary.importedPayslips > 0 ||
      summary.skippedDuplicates > 0 ||
      summary.errors.length > 0
    )
  }, [summary])

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setBusy(true)

    const collected: Transaction[] = []
    const errors: string[] = []
    let skippedDuplicates = 0

    for (const file of files) {
      try {
        const text = await readFileText(file)
        const result = importTransactionsFromCsv(file.name, text)
        errors.push(...result.errors)

        result.transactions.forEach((candidate) => {
          const alreadyExists = existingTransactions.some((existing) => isSameTransaction(existing, candidate))
          const alreadyCollected = collected.some((existing) => isSameTransaction(existing, candidate))

          if (alreadyExists || alreadyCollected) {
            skippedDuplicates += 1
            return
          }

          collected.push(candidate)
        })
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Failed to import ${file.name}`)
      }
    }

    if (collected.length > 0) {
      onImportTransactions(collected)
    }

    setSummary({
      importedTransactions: collected.length,
      importedPayslips: 0,
      skippedDuplicates,
      errors,
    })
    setBusy(false)
    event.target.value = ''
  }

  async function handlePdfImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setBusy(true)

    const payslips: Payslip[] = []
    const incomeTransactions: Transaction[] = []
    const errors: string[] = []

    for (const file of files) {
      try {
        const buffer = await readFileBuffer(file)
        const text = extractTextFallback(buffer)
        const payslip = parsePayslipText(file.name, text)

        if (!payslip) {
          errors.push(`${file.name}: no recognizable net pay value found. Add manually in this MVP.`)
          continue
        }

        payslips.push(payslip)
        incomeTransactions.push(toIncomeTransactionFromPayslip(payslip))
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Failed to import ${file.name}`)
      }
    }

    if (payslips.length > 0) {
      onImportPayslips(payslips)
      onImportTransactions(incomeTransactions)
    }

    setSummary({
      importedTransactions: incomeTransactions.length,
      importedPayslips: payslips.length,
      skippedDuplicates: 0,
      errors,
    })
    setBusy(false)
    event.target.value = ''
  }

  return (
    <section className="tab-panel">
      <h2>Import Data</h2>
      <p className="muted">
        Upload monthly bank CSV files and payslip PDFs. Transactions are stored locally in your browser.
      </p>

      <div className="import-grid">
        <div className="card">
          <h3>CSV Transactions</h3>
          <p>Supports files that contain date, amount, and description columns.</p>
          <label className="file-button">
            <input type="file" accept=".csv,text/csv" multiple onChange={handleCsvImport} disabled={busy} />
            <span>{busy ? 'Importing...' : 'Upload CSV Files'}</span>
          </label>
        </div>

        <div className="card">
          <h3>PDF Payslips</h3>
          <p>
            This MVP uses basic text extraction. If parsing fails for scanned PDFs, manual entry can be added later.
          </p>
          <label className="file-button">
            <input type="file" accept=".pdf,application/pdf" multiple onChange={handlePdfImport} disabled={busy} />
            <span>{busy ? 'Importing...' : 'Upload PDF Payslips'}</span>
          </label>
        </div>
      </div>

      {hasSummary && (
        <div className="card summary">
          <h3>Last Import</h3>
          <ul>
            <li>Transactions imported: {summary.importedTransactions}</li>
            <li>Payslips imported: {summary.importedPayslips}</li>
            <li>Duplicates skipped: {summary.skippedDuplicates}</li>
          </ul>
          {summary.errors.length > 0 && (
            <div>
              <h4>Issues</h4>
              <ul className="error-list">
                {summary.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
