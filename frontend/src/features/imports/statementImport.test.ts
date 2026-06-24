import { describe, expect, it } from 'vitest'
import {
  buildImportCandidates,
  parseStatementCsv,
} from './statementImport'
import type { Category, Transaction } from '../../domain/types'

const categories: Category[] = [
  { id: 'food', userId: 'u1', name: 'Alimentação', color: '#f97316' },
  { id: 'transport', userId: 'u1', name: 'Transporte', color: '#2563eb' },
]

const existingTransactions: Transaction[] = [
  {
    id: 't1',
    userId: 'u1',
    kind: 'variable_expense',
    description: 'Uber centro',
    amount: 18.5,
    categoryId: 'transport',
    occurredAt: '2026-06-10',
    createdAt: '2026-06-10T10:00:00.000Z',
  },
]

describe('statement import', () => {
  it('parses csv rows with signed amounts into import rows', () => {
    const csv = `data,descricao,valor\n2026-06-10,Uber centro,-18.50\n2026-06-11,Salario,5000`

    expect(parseStatementCsv(csv)).toEqual([
      {
        occurredAt: '2026-06-10',
        description: 'Uber centro',
        amount: 18.5,
        kind: 'variable_expense',
        rawAmount: -18.5,
      },
      {
        occurredAt: '2026-06-11',
        description: 'Salario',
        amount: 5000,
        kind: 'income',
        rawAmount: 5000,
      },
    ])
  })

  it('classifies rows by matching category names in the description', () => {
    const rows = parseStatementCsv('data,descricao,valor\n2026-06-10,Transporte aplicativo,-22')

    expect(buildImportCandidates(rows, categories, [])).toEqual([
      expect.objectContaining({
        categoryId: 'transport',
        duplicate: false,
      }),
    ])
  })

  it('marks duplicates by same date, normalized description, and amount', () => {
    const rows = parseStatementCsv('data,descricao,valor\n2026-06-10, uber   centro ,-18,50')

    expect(buildImportCandidates(rows, categories, existingTransactions)).toEqual([
      expect.objectContaining({
        duplicate: true,
        duplicateReason: 'Mesmo dia, descricao e valor ja existem.',
      }),
    ])
  })
})