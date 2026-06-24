import Dexie, { type Table } from 'dexie'
import { createId, createSyncItem } from './sync'
import type {
  Budget,
  Category,
  FinanceSnapshot,
  Goal,
  Household,
  HouseholdMember,
  PredictableIncome,
  SyncQueueItem,
  Transaction,
  TransactionKind,
  UserProfile,
} from '../domain/types'
import type { StatementImportCandidate } from '../features/imports/statementImport'

const sessionKey = 'poupa-plus.activeUserId'
export const defaultCategoryTemplates = [
  { name: 'Casa', color: '#176b5b' },
  { name: 'Alimentação', color: '#f97316' },
  { name: 'Transporte', color: '#2563eb' },
  { name: 'Saúde', color: '#dc2626' },
  { name: 'Lazer', color: '#7c3aed' },
]

class PoupaDatabase extends Dexie {
  users!: Table<UserProfile, string>
  households!: Table<Household, string>
  householdMembers!: Table<HouseholdMember, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  goals!: Table<Goal, string>
  budgets!: Table<Budget, string>
  predictableIncomes!: Table<PredictableIncome, string>
  syncQueue!: Table<SyncQueueItem, string>

  constructor() {
    super('poupa-plus')
    this.version(1).stores({
      users: 'id, email',
      categories: 'id, userId',
      transactions: 'id, userId, occurredAt, kind, categoryId',
      goals: 'id, userId, kind',
      predictableIncomes: 'id, userId',
      syncQueue: 'id, userId, status, entityId',
    })
    this.version(2).stores({
      users: 'id, email',
      households: 'id, ownerUserId',
      householdMembers: 'id, householdId, email, role',
      categories: 'id, userId',
      transactions: 'id, userId, occurredAt, kind, categoryId',
      goals: 'id, userId, kind',
      predictableIncomes: 'id, userId',
      syncQueue: 'id, userId, status, entityId',
    })
    this.version(3).stores({
      users: 'id, email',
      households: 'id, ownerUserId',
      householdMembers: 'id, householdId, email, role',
      categories: 'id, userId, householdId',
      transactions: 'id, userId, occurredAt, kind, categoryId',
      goals: 'id, userId, kind, householdId',
      predictableIncomes: 'id, userId',
      syncQueue: 'id, userId, status, entityId',
    })
    this.version(4).stores({
      users: 'id, email',
      households: 'id, ownerUserId',
      householdMembers: 'id, householdId, email, role, userId',
      categories: 'id, userId, householdId',
      transactions: 'id, userId, occurredAt, kind, categoryId',
      goals: 'id, userId, kind, householdId',
      predictableIncomes: 'id, userId',
      syncQueue: 'id, userId, status, entityId',
    })
    this.version(5).stores({
      users: 'id, email',
      households: 'id, ownerUserId',
      householdMembers: 'id, householdId, email, role, userId',
      categories: 'id, userId, householdId',
      transactions: 'id, userId, occurredAt, kind, categoryId',
      goals: 'id, userId, kind, householdId',
      budgets: 'id, userId, categoryId, allocationMode, isAutomatic',
      predictableIncomes: 'id, userId',
      syncQueue: 'id, userId, status, entityId',
    })
    this.version(6).stores({
      users: 'id, email',
      households: 'id, ownerUserId',
      householdMembers: 'id, householdId, email, role, userId',
      categories: 'id, userId, householdId',
      transactions: 'id, userId, occurredAt, kind, categoryId',
      goals: 'id, userId, kind, householdId',
      budgets: 'id, userId, categoryId, budgetKind, allocationMode, isAutomatic',
      predictableIncomes: 'id, userId',
      syncQueue: 'id, userId, status, entityId',
    })
  }
}

export const db = new PoupaDatabase()

export interface TransactionInput {
  kind: TransactionKind
  description: string
  amount: number
  categoryId?: string
  occurredAt: string
}

export interface CategoryInput {
  name: string
  color: string
  householdId?: string
}

export interface GoalInput {
  kind: Goal['kind']
  name: string
  targetAmount: number
  currentAmount: number
  householdId?: string
}

export interface BudgetInput {
  categoryId?: string
  budgetKind: Budget['budgetKind']
  monthlyAmount: number
  categoryName: string
  color: string
  limitAmount: number
  allocationMode: Budget['allocationMode']
  allocationValue: number
  preset: Budget['preset']
  isAutomatic: boolean
}

export interface PredictableIncomeInput {
  description: string
  amount: number
}

export interface HouseholdInput {
  name: string
}

export interface HouseholdMemberInput {
  userId?: string
  name?: string
  email?: string
  role: HouseholdMember['role']
}

export async function getActiveUserId() {
  return localStorage.getItem(sessionKey)
}

export async function clearActiveSession() {
  localStorage.removeItem(sessionKey)
}

export async function getRegisteredUsers() {
  return db.users.orderBy('email').toArray()
}



export async function storeRegisteredProfiles(users: UserProfile[]) {
  await db.users.bulkPut(users.map((user) => ({
    id: user.id,
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    createdAt: user.createdAt,
  })))
}
export async function storeAuthenticatedProfile(user: UserProfile) {
  await db.users.put({
    id: user.id,
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
    createdAt: user.createdAt,
  })
  localStorage.setItem(sessionKey, user.id)
  await ensureDefaultCategories(user.id)
  return user
}
export async function getSnapshot(userId: string): Promise<FinanceSnapshot | null> {
  const user = await db.users.get(userId)
  if (!user) return null

  const [household, categories, transactions, goals, budgets, predictableIncomes, syncQueue, registeredUsers] = await Promise.all([
    db.households.where('ownerUserId').equals(userId).first(),
    db.categories.where('userId').equals(userId).toArray(),
    db.transactions.where('userId').equals(userId).reverse().sortBy('occurredAt'),
    db.goals.where('userId').equals(userId).toArray(),
    db.budgets.where('userId').equals(userId).toArray(),
    db.predictableIncomes.where('userId').equals(userId).toArray(),
    db.syncQueue.where('userId').equals(userId).toArray(),
    getRegisteredUsers(),
  ])
  const householdMembers = household
    ? await db.householdMembers.where('householdId').equals(household.id).toArray()
    : []

  return {
    user,
    household,
    householdMembers,
    categories,
    transactions: transactions.reverse(),
    goals,
    budgets,
    predictableIncomes,
    syncQueue,
    registeredUsers,
  }
}

export async function importTransactions(userId: string, candidates: StatementImportCandidate[]) {
  const transactions: Transaction[] = candidates
    .filter((candidate) => !candidate.duplicate)
    .map((candidate) => ({
      id: createId(),
      userId,
      kind: candidate.kind,
      description: candidate.description.trim(),
      amount: roundMoney(candidate.amount),
      categoryId: candidate.categoryId,
      occurredAt: candidate.occurredAt,
      createdAt: new Date().toISOString(),
    }))

  await db.transaction('rw', db.transactions, db.syncQueue, async () => {
    await db.transactions.bulkAdd(transactions)
    await db.syncQueue.bulkAdd(
      transactions.map((transaction) => createSyncItem(userId, 'transaction', transaction.id)),
    )
  })

  return transactions
}
export async function addTransaction(userId: string, input: TransactionInput) {
  const transaction: Transaction = {
    id: createId(),
    userId,
    kind: input.kind,
    description: input.description.trim(),
    amount: roundMoney(input.amount),
    categoryId: input.categoryId || undefined,
    occurredAt: input.occurredAt,
    createdAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.transactions, db.syncQueue, async () => {
    await db.transactions.add(transaction)
    await db.syncQueue.add(createSyncItem(userId, 'transaction', transaction.id))
  })

  return transaction
}

export async function deleteTransactions(userId: string, transactionIds: string[]) {
  const uniqueIds = Array.from(new Set(transactionIds))
  if (uniqueIds.length === 0) return

  const existingTransactions = await db.transactions.bulkGet(uniqueIds)
  const ownedIds = existingTransactions
    .filter((transaction): transaction is Transaction => transaction !== undefined && transaction.userId === userId)
    .map((transaction) => transaction.id)

  if (ownedIds.length !== uniqueIds.length) throw new Error('TRANSACTION_NOT_FOUND')

  await db.transaction('rw', db.transactions, db.syncQueue, async () => {
    await db.transactions.bulkDelete(ownedIds)
    await db.syncQueue.bulkAdd(
      ownedIds.map((transactionId) => createSyncItem(userId, 'transaction', transactionId, 'delete')),
    )
  })
}

export async function addCategory(userId: string, input: CategoryInput) {
  const category: Category = {
    id: createId(),
    userId,
    householdId: input.householdId,
    name: input.name.trim(),
    color: input.color,
  }

  await db.transaction('rw', db.categories, db.syncQueue, async () => {
    await db.categories.add(category)
    await db.syncQueue.add(createSyncItem(userId, 'category', category.id))
  })

  return category
}

export async function addGoal(userId: string, input: GoalInput) {
  const goal: Goal = {
    id: createId(),
    userId,
    householdId: input.householdId,
    kind: input.kind,
    name: input.name.trim(),
    targetAmount: roundMoney(input.targetAmount),
    currentAmount: roundMoney(input.currentAmount),
  }

  await db.transaction('rw', db.goals, db.syncQueue, async () => {
    await db.goals.add(goal)
    await db.syncQueue.add(createSyncItem(userId, 'goal', goal.id))
  })

  return goal
}


export async function updateGoal(userId: string, goalId: string, input: GoalInput) {
  const existing = await db.goals.get(goalId)
  if (!existing || existing.userId !== userId) throw new Error('GOAL_NOT_FOUND')

  const goal: Goal = {
    ...existing,
    householdId: input.householdId,
    kind: input.kind,
    name: input.name.trim(),
    targetAmount: roundMoney(input.targetAmount),
    currentAmount: roundMoney(input.currentAmount),
  }

  await db.transaction('rw', db.goals, db.syncQueue, async () => {
    await db.goals.put(goal)
    await db.syncQueue.add(createSyncItem(userId, 'goal', goal.id, 'update'))
  })

  return goal
}

export async function deleteGoal(userId: string, goalId: string) {
  const existing = await db.goals.get(goalId)
  if (!existing || existing.userId !== userId) throw new Error('GOAL_NOT_FOUND')

  await db.transaction('rw', db.goals, db.syncQueue, async () => {
    await db.goals.delete(goalId)
    await db.syncQueue.add(createSyncItem(userId, 'goal', goalId, 'delete'))
  })
}

export async function addBudget(userId: string, input: BudgetInput) {
  const category = input.categoryId
    ? await db.categories.get(input.categoryId)
    : undefined
  const budgetCategory: Category = category ?? {
    id: createId(),
    userId,
    name: input.categoryName.trim(),
    color: input.color,
  }
  const budget: Budget = {
    id: createId(),
    userId,
    categoryId: budgetCategory.id,
    name: input.categoryName.trim(),
    color: input.color,
    budgetKind: input.budgetKind,
    monthlyAmount: roundMoney(input.monthlyAmount),
    limitAmount: roundMoney(input.limitAmount),
    allocationMode: input.allocationMode,
    allocationValue: roundMoney(input.allocationValue),
    preset: input.preset,
    isAutomatic: input.isAutomatic,
    period: 'monthly',
    createdAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.categories, db.budgets, db.syncQueue, async () => {
    if (!category) {
      await db.categories.add(budgetCategory)
      await db.syncQueue.add(createSyncItem(userId, 'category', budgetCategory.id))
    }
    await db.budgets.add(budget)
    await db.syncQueue.add(createSyncItem(userId, 'budget', budget.id))
  })

  return budget
}

export async function updateBudget(userId: string, budgetId: string, input: BudgetInput) {
  const existing = await db.budgets.get(budgetId)
  if (!existing || existing.userId !== userId) throw new Error('BUDGET_NOT_FOUND')

  const category = input.categoryId
    ? await db.categories.get(input.categoryId)
    : undefined
  const categoryId = category?.id ?? existing.categoryId
  const budget: Budget = {
    ...existing,
    categoryId,
    name: input.categoryName.trim(),
    color: input.color,
    budgetKind: input.budgetKind,
    monthlyAmount: roundMoney(input.monthlyAmount),
    limitAmount: roundMoney(input.limitAmount),
    allocationMode: input.allocationMode,
    allocationValue: roundMoney(input.allocationValue),
    preset: input.preset,
    isAutomatic: input.isAutomatic,
  }

  await db.transaction('rw', db.budgets, db.syncQueue, async () => {
    await db.budgets.put(budget)
    await db.syncQueue.add(createSyncItem(userId, 'budget', budget.id, 'update'))
  })

  return budget
}

export async function deleteBudget(userId: string, budgetId: string) {
  const existing = await db.budgets.get(budgetId)
  if (!existing || existing.userId !== userId) throw new Error('BUDGET_NOT_FOUND')

  await db.transaction('rw', db.budgets, db.syncQueue, async () => {
    await db.budgets.delete(budgetId)
    await db.syncQueue.add(createSyncItem(userId, 'budget', budgetId, 'delete'))
  })
}
export async function addPredictableIncome(userId: string, input: PredictableIncomeInput) {
  const predictableIncome: PredictableIncome = {
    id: createId(),
    userId,
    description: input.description.trim(),
    amount: roundMoney(input.amount),
    frequency: 'monthly',
  }

  await db.transaction('rw', db.predictableIncomes, db.syncQueue, async () => {
    await db.predictableIncomes.add(predictableIncome)
    await db.syncQueue.add(createSyncItem(userId, 'predictable_income', predictableIncome.id))
  })

  return predictableIncome
}

export async function createHousehold(user: UserProfile, input: HouseholdInput) {
  const existing = await db.households.where('ownerUserId').equals(user.id).first()
  if (existing) return existing

  const household: Household = {
    id: createId(),
    ownerUserId: user.id,
    name: input.name.trim(),
    createdAt: new Date().toISOString(),
  }
  const ownerMember: HouseholdMember = {
    id: createId(),
    householdId: household.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: 'owner',
    createdAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.households, db.householdMembers, db.syncQueue, async () => {
    await db.households.add(household)
    await db.householdMembers.add(ownerMember)
    await db.syncQueue.add(createSyncItem(user.id, 'household', household.id))
    await db.syncQueue.add(createSyncItem(user.id, 'household_member', ownerMember.id))
  })

  return household
}

export async function addHouseholdMember(userId: string, householdId: string, input: HouseholdMemberInput) {
  const registeredUser = input.userId
    ? await db.users.get(input.userId)
    : await db.users.where('email').equals((input.email ?? '').trim().toLowerCase()).first()

  if (!registeredUser) throw new Error('REGISTERED_USER_REQUIRED')

  const existingMember = await db.householdMembers
    .where('householdId')
    .equals(householdId)
    .and((member) => member.userId === registeredUser.id || member.email === registeredUser.email)
    .first()
  if (existingMember) return existingMember

  const member: HouseholdMember = {
    id: createId(),
    householdId,
    userId: registeredUser.id,
    name: registeredUser.name,
    email: registeredUser.email,
    role: input.role,
    createdAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.householdMembers, db.syncQueue, async () => {
    await db.householdMembers.add(member)
    await db.syncQueue.add(createSyncItem(userId, 'household_member', member.id))
  })

  return member
}

export async function markPendingItemsSynced(userId: string) {
  const pending = await db.syncQueue.where({ userId, status: 'pending' }).toArray()
  await Promise.all(pending.map((item) => db.syncQueue.update(item.id, { status: 'synced' })))
}

export function parseCurrencyInput(value: string | number) {
  if (typeof value === 'number') return roundMoney(value)
  const normalized = value.trim().replace(/\D/g, '')
  if (!normalized) return 0
  return roundMoney(Number(normalized) / 100)
}

export function formatCurrencyInput(value: string | number) {
  const amount = parseCurrencyInput(value)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function maskCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function validateTransactionInput(input: TransactionInput) {
  if (!input.description.trim()) return 'Informe uma descrição.'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Informe um valor maior que zero.'
  if (!input.occurredAt) return 'Informe a data.'
  return null
}

export function validateCategoryInput(input: CategoryInput) {
  if (!input.name.trim()) return 'Informe o nome da categoria.'
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return 'Informe uma cor válida.'
  return null
}

export function validateGoalInput(input: GoalInput) {
  if (!input.name.trim()) return 'Informe o nome da meta.'
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) return 'Informe uma meta maior que zero.'
  if (!Number.isFinite(input.currentAmount) || input.currentAmount < 0) {
    return 'Informe um progresso maior ou igual a zero.'
  }
  return null
}

export function validateBudgetInput(input: BudgetInput) {
  if (!input.categoryName.trim()) return 'Informe a categoria do orçamento.'
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return 'Informe uma cor válida.'
  if (input.budgetKind !== 'income' && input.budgetKind !== 'expense') return 'Informe se o orçamento é para ganhos ou despesas.'
  if (!Number.isFinite(input.monthlyAmount) || input.monthlyAmount <= 0) return 'Informe um valor mensal maior que zero.'
  if (!Number.isFinite(input.limitAmount) || input.limitAmount <= 0) return 'Informe um limite maior que zero.'
  if (!Number.isFinite(input.allocationValue) || input.allocationValue <= 0) return 'Informe uma distribuição maior que zero.'
  if (input.allocationMode === 'percentage' && input.allocationValue > 100) return 'A porcentagem não pode passar de 100%.'
  if (roundMoney(input.limitAmount) > roundMoney(input.monthlyAmount)) return 'A categoria não pode exceder o valor mensal configurado.'
  return null
}
export function validatePredictableIncomeInput(input: PredictableIncomeInput) {
  if (!input.description.trim()) return 'Informe a descrição da renda.'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Informe uma renda maior que zero.'
  return null
}

export function validateHouseholdInput(input: HouseholdInput) {
  if (!input.name.trim()) return 'Informe o nome do grupo.'
  return null
}

export function validateHouseholdMemberInput(input: HouseholdMemberInput) {
  if (!input.userId && !input.name?.trim() && !input.email?.trim()) return 'Informe nome e email do membro.'
  if (!input.userId) return 'Selecione uma pessoa cadastrada.'
  return null
}

async function ensureDefaultCategories(userId: string) {
  const existingCount = await db.categories.where('userId').equals(userId).count()
  if (existingCount > 0) return

  await db.categories.bulkAdd(
    defaultCategoryTemplates.map((template) => ({
      id: createId(),
      userId,
      ...template,
    })),
  )
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}










