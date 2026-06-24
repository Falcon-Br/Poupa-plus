import type { Category, Goal, PredictableIncome, Transaction } from './types'

export interface MonthlySummary {
  income: number
  expenses: number
  balance: number
}

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  amount: number
}

export interface DailyExpenseTotal {
  day: string
  label: string
  amount: number
}

export interface DailyCategoryExpenseTotal {
  day: string
  label: string
  total: number
  [seriesKey: string]: string | number
}

export interface ExpenseCategorySeries {
  id: string
  key: string
  name: string
  color: string
}

export interface FinancialInsights {
  narrative: string
  trends: string[]
  suggestions: string[]
}

const uncategorized = {
  id: 'uncategorized',
  name: 'Sem categoria',
  color: '#9ca3af',
}

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function isInMonth(date: string, month: string) {
  return date.startsWith(month)
}

function isExpense(transaction: Transaction) {
  return transaction.kind === 'fixed_expense' || transaction.kind === 'variable_expense'
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatCurrency(value: number) {
  return `R$ ${roundCurrency(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function summarizeMonth(transactions: Transaction[], month: string): MonthlySummary {
  const monthly = transactions.filter((transaction) => isInMonth(transaction.occurredAt, month))
  const income = monthly
    .filter((transaction) => transaction.kind === 'income')
    .reduce((total, transaction) => total + transaction.amount, 0)
  const expenses = monthly.filter(isExpense).reduce((total, transaction) => total + transaction.amount, 0)

  return {
    income: roundCurrency(income),
    expenses: roundCurrency(expenses),
    balance: roundCurrency(income - expenses),
  }
}

export function summarizeExpensesByCategory(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): CategoryTotal[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const totals = new Map<string, CategoryTotal>()

  transactions
    .filter((transaction) => isInMonth(transaction.occurredAt, month))
    .filter(isExpense)
    .forEach((transaction) => {
      const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined
      const categoryId = category?.id ?? uncategorized.id
      const current = totals.get(categoryId) ?? {
        categoryId,
        name: category?.name ?? uncategorized.name,
        color: category?.color ?? uncategorized.color,
        amount: 0,
      }

      totals.set(categoryId, { ...current, amount: roundCurrency(current.amount + transaction.amount) })
    })

  return [...totals.values()].sort((left, right) => right.amount - left.amount)
}

export function summarizeExpensesByDay(transactions: Transaction[], month: string): DailyExpenseTotal[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const totals = new Map<string, number>()

  transactions
    .filter((transaction) => isInMonth(transaction.occurredAt, month))
    .filter(isExpense)
    .forEach((transaction) => {
      totals.set(transaction.occurredAt, roundCurrency((totals.get(transaction.occurredAt) ?? 0) + transaction.amount))
    })

  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1
    const day = `${month}-${String(dayNumber).padStart(2, '0')}`
    return {
      day,
      label: String(dayNumber).padStart(2, '0'),
      amount: totals.get(day) ?? 0,
    }
  })
}

export function summarizeExpensesByDayAndCategory(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): { days: DailyCategoryExpenseTotal[]; series: ExpenseCategorySeries[] } {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const seriesByCategory = new Map<string, ExpenseCategorySeries>()
  const totalsByDay = new Map<string, DailyCategoryExpenseTotal>()

  const getSeries = (categoryId: string, name: string, color: string) => {
    const existing = seriesByCategory.get(categoryId)
    if (existing) return existing

    const series = {
      id: categoryId,
      key: `category_${seriesByCategory.size}`,
      name,
      color,
    }
    seriesByCategory.set(categoryId, series)
    return series
  }

  transactions
    .filter((transaction) => isInMonth(transaction.occurredAt, month))
    .filter(isExpense)
    .forEach((transaction) => {
      const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined
      const categoryId = category?.id ?? uncategorized.id
      const series = getSeries(categoryId, category?.name ?? uncategorized.name, category?.color ?? uncategorized.color)
      const current = totalsByDay.get(transaction.occurredAt) ?? {
        day: transaction.occurredAt,
        label: transaction.occurredAt.slice(8, 10),
        total: 0,
      }
      const currentValue = typeof current[series.key] === 'number' ? Number(current[series.key]) : 0
      current[series.key] = roundCurrency(currentValue + transaction.amount)
      current.total = roundCurrency(current.total + transaction.amount)
      totalsByDay.set(transaction.occurredAt, current)
    })

  const series = [...seriesByCategory.values()]
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1
    const day = `${month}-${String(dayNumber).padStart(2, '0')}`
    const total = totalsByDay.get(day) ?? {
      day,
      label: String(dayNumber).padStart(2, '0'),
      total: 0,
    }

    series.forEach((item) => {
      if (typeof total[item.key] !== 'number') total[item.key] = 0
    })

    return total
  })

  return { days, series }
}
export function projectNextMonth(
  predictableIncomes: PredictableIncome[],
  transactions: Transaction[],
): MonthlySummary {
  const income = predictableIncomes.reduce((total, item) => total + item.amount, 0)
  const expenses = transactions
    .filter((transaction) => transaction.kind === 'fixed_expense')
    .reduce((total, transaction) => total + transaction.amount, 0)

  return {
    income: roundCurrency(income),
    expenses: roundCurrency(expenses),
    balance: roundCurrency(income - expenses),
  }
}

export function createFinancialInsights(
  transactions: Transaction[],
  categories: Category[],
  goals: Goal[],
  month: string,
): FinancialInsights {
  const summary = summarizeMonth(transactions, month)
  const previousSummary = summarizeMonth(transactions, previousMonth(month))
  const categoryTotals = summarizeExpensesByCategory(transactions, categories, month)
  const expenseRate = summary.income > 0 ? Math.round((summary.expenses / summary.income) * 100) : 0
  const monthLabel = monthNames[Number(month.slice(5, 7)) - 1] ?? 'O mês'
  const balanceLabel = summary.balance >= 0 ? 'positivo' : 'negativo'

  const trends: string[] = []
  const expenseDelta = roundCurrency(summary.expenses - previousSummary.expenses)
  if (expenseDelta > 0) {
    trends.push(`Gastos subiram ${formatCurrency(expenseDelta)} em relação ao mês anterior.`)
  } else if (expenseDelta < 0) {
    trends.push(`Gastos cairam ${formatCurrency(Math.abs(expenseDelta))} em relação ao mês anterior.`)
  } else {
    trends.push('Gastos ficaram estáveis em relação ao mês anterior.')
  }

  const suggestions: string[] = []
  const topCategory = categoryTotals[0]
  if (topCategory && topCategory.amount > 0) {
    suggestions.push(
      `${topCategory.name} concentrou ${formatCurrency(topCategory.amount)} dos gastos. Vale revisar se há algo recorrente para otimizar.`,
    )
  }

  const activeGoal = goals.find((goal) => goal.currentAmount < goal.targetAmount)
  if (summary.balance > 0 && activeGoal) {
    suggestions.push(`Direcione parte do saldo positivo para a meta ${activeGoal.name}.`)
  }

  if (summary.balance < 0) {
    suggestions.push('Priorize reduzir gastos variáveis antes de assumir novos compromissos.')
  }

  return {
    narrative: `${monthLabel} fechou com saldo ${balanceLabel} de ${formatCurrency(summary.balance)}. Os gastos consumiram ${expenseRate}% dos ganhos registrados.`,
    trends,
    suggestions,
  }
}

export function getGoalProgress(goal: Goal): number {
  if (goal.targetAmount <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((goal.currentAmount / goal.targetAmount) * 100)))
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 2, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

