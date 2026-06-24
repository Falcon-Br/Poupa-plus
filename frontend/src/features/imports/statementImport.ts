import type { Category, Transaction, TransactionKind } from '../../domain/types'

export interface StatementImportRow {
  occurredAt: string
  description: string
  amount: number
  rawAmount: number
  kind: TransactionKind
}

export interface StatementImportCandidate extends StatementImportRow {
  categoryId?: string
  duplicate: boolean
  duplicateReason?: string
}

export function parseStatementCsv(csv: string): StatementImportRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const delimiter = lines[0].includes(';') ? ';' : ','

  return lines.slice(1).flatMap((line) => {
    const columns = splitStatementLine(line, delimiter)
    const [date, description, rawAmountText] = columns
    const rawAmount = parseAmount(rawAmountText)

    if (!date || !description || !Number.isFinite(rawAmount)) {
      return []
    }

    return [
      {
        occurredAt: normalizeDate(date),
        description: description.trim(),
        amount: Math.abs(rawAmount),
        rawAmount,
        kind: rawAmount >= 0 ? 'income' : 'variable_expense',
      },
    ]
  })
}

export function buildImportCandidates(
  rows: StatementImportRow[],
  categories: Category[],
  existingTransactions: Transaction[],
): StatementImportCandidate[] {
  return rows.map((row) => {
    const categoryId = classifyCategory(row.description, categories)
    const duplicate = existingTransactions.some((transaction) => isSameTransaction(transaction, row))

    return {
      ...row,
      categoryId,
      duplicate,
      duplicateReason: duplicate ? 'Mesmo dia, descricao e valor ja existem.' : undefined,
    }
  })
}

function splitStatementLine(line: string, delimiter: string) {
  const columns = line.split(delimiter).map((column) => column.trim())

  if (delimiter === ',' && columns.length > 3) {
    return [columns[0], columns[1], columns.slice(2).join(',')]
  }

  return columns
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  return Number(normalized)
}

function normalizeDate(value: string) {
  const trimmed = value.trim()
  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)

  if (brDate) {
    const [, day, month, year] = brDate
    return `${year}-${month}-${day}`
  }

  return trimmed.slice(0, 10)
}

function classifyCategory(description: string, categories: Category[]) {
  const normalizedDescription = normalizeText(description)
  const match = categories.find((category) => normalizedDescription.includes(normalizeText(category.name)))
  return match?.id
}

function isSameTransaction(transaction: Transaction, row: StatementImportRow) {
  return (
    transaction.occurredAt === row.occurredAt &&
    normalizeText(transaction.description) === normalizeText(row.description) &&
    Math.abs(transaction.amount - row.amount) < 0.01
  )
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}