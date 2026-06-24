import { describe, expect, it } from 'vitest'
import {
  createFinancialInsights,
  getGoalProgress,
  projectNextMonth,
  summarizeExpensesByCategory,
  summarizeMonth,
} from './finance'
import type { Category, Goal, PredictableIncome, Transaction } from './types'

const categories: Category[] = [
  { id: 'food', userId: 'u1', name: 'Alimentação', color: '#f97316' },
  { id: 'home', userId: 'u1', name: 'Casa', color: '#176b5b' },
]

const transactions: Transaction[] = [
  {
    id: 't1',
    userId: 'u1',
    kind: 'income',
    description: 'Salario',
    amount: 5000,
    occurredAt: '2026-06-03',
    createdAt: '2026-06-03T10:00:00.000Z',
  },
  {
    id: 't2',
    userId: 'u1',
    kind: 'fixed_expense',
    description: 'Aluguel',
    amount: 1400,
    categoryId: 'home',
    occurredAt: '2026-06-05',
    createdAt: '2026-06-05T10:00:00.000Z',
  },
  {
    id: 't3',
    userId: 'u1',
    kind: 'variable_expense',
    description: 'Mercado',
    amount: 420,
    categoryId: 'food',
    occurredAt: '2026-06-08',
    createdAt: '2026-06-08T10:00:00.000Z',
  },
  {
    id: 't4',
    userId: 'u1',
    kind: 'variable_expense',
    description: 'Lanche',
    amount: 80,
    categoryId: 'food',
    occurredAt: '2026-06-10',
    createdAt: '2026-06-10T10:00:00.000Z',
  },
  {
    id: 't5',
    userId: 'u1',
    kind: 'income',
    description: 'Freela antigo',
    amount: 700,
    occurredAt: '2026-05-29',
    createdAt: '2026-05-29T10:00:00.000Z',
  },
  {
    id: 't6',
    userId: 'u1',
    kind: 'variable_expense',
    description: 'Mercado maio',
    amount: 250,
    categoryId: 'food',
    occurredAt: '2026-05-10',
    createdAt: '2026-05-10T10:00:00.000Z',
  },
]

describe('finance domain', () => {
  it('summarizes monthly income, expenses, and balance', () => {
    expect(summarizeMonth(transactions, '2026-06')).toEqual({
      income: 5000,
      expenses: 1900,
      balance: 3100,
    })
  })

  it('groups monthly expenses by category and excludes income', () => {
    expect(summarizeExpensesByCategory(transactions, categories, '2026-06')).toEqual([
      { categoryId: 'home', name: 'Casa', color: '#176b5b', amount: 1400 },
      { categoryId: 'food', name: 'Alimentação', color: '#f97316', amount: 500 },
    ])
  })

  it('projects next month from predictable income and recurring fixed expenses', () => {
    const predictableIncomes: PredictableIncome[] = [
      { id: 'p1', userId: 'u1', description: 'Salario', amount: 5200, frequency: 'monthly' },
    ]

    expect(projectNextMonth(predictableIncomes, transactions)).toEqual({
      income: 5200,
      expenses: 1400,
      balance: 3800,
    })
  })

  it('calculates capped goal progress percentage', () => {
    const goal: Goal = {
      id: 'g1',
      userId: 'u1',
      kind: 'saving',
      name: 'Reserva',
      targetAmount: 2000,
      currentAmount: 2400,
    }

    expect(getGoalProgress(goal)).toBe(100)
  })

  it('creates financial insights with narrative, trend, and suggestions', () => {
    const goals: Goal[] = [
      {
        id: 'g1',
        userId: 'u1',
        kind: 'saving',
        name: 'Reserva',
        targetAmount: 6000,
        currentAmount: 1000,
      },
    ]

    expect(createFinancialInsights(transactions, categories, goals, '2026-06')).toEqual({
      narrative:
        'Junho fechou com saldo positivo de R$ 3.100,00. Os gastos consumiram 38% dos ganhos registrados.',
      trends: ['Gastos subiram R$ 1.650,00 em relação ao mês anterior.'],
      suggestions: [
        'Casa concentrou R$ 1.400,00 dos gastos. Vale revisar se há algo recorrente para otimizar.',
        'Direcione parte do saldo positivo para a meta Reserva.',
      ],
    })
  })
})