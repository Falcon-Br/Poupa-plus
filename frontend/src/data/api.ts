import type {
  Budget,
  Category,
  Goal,
  Household,
  HouseholdMember,
  PredictableIncome,
  SyncQueueItem,
  Transaction,
  TransactionKind,
  UserProfile,
} from '../domain/types'

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL
const configuredApiBaseUrl = rawApiBaseUrl === undefined ? undefined : rawApiBaseUrl.replace(/\/$/, '')
const defaultApiBaseUrls = Array.from(new Set([
  ...buildLocalApiBaseUrls(5254),
  ...buildLocalApiBaseUrls(5000),
]))
let activeApiBaseUrl = configuredApiBaseUrl ?? defaultApiBaseUrls[0]
const apiBaseUrls = configuredApiBaseUrl !== undefined
  ? [configuredApiBaseUrl]
  : defaultApiBaseUrls
const syncBatchPath = '/api/sync/push'

type SyncableEntity = Budget | Category | Goal | Household | HouseholdMember | PredictableIncome | Transaction

export class ApiConnectionError extends Error {
  constructor(message = 'Não foi possível conectar ao servidor.') {
    super(message)
    this.name = 'ApiConnectionError'
  }
}

export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiHttpError'
  }
}

export interface SyncBatchItem {
  queueItemId: string
  userId: string
  entity: SyncQueueItem['entity']
  entityId: string
  operation: SyncQueueItem['operation']
  payload: Record<string, unknown>
}

export interface SyncBatchItemResult {
  queueItemId: string
  status: Extract<SyncQueueItem['status'], 'synced' | 'failed'>
  message?: string
}

interface SyncBatchResponse {
  results: SyncBatchItemResult[]
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetchApi(path)

  if (!response.ok) {
    const message = await readApiErrorMessage(response)
    throw new ApiHttpError(response.status, `API failed (${response.status}) ${message}`.trim())
  }

  return response.json() as Promise<TResponse>
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await readApiErrorMessage(response)
    throw new ApiHttpError(response.status, `Sync failed (${response.status}) ${message}`.trim())
  }

  return response.json() as Promise<TResponse>
}

async function readApiErrorMessage(response: Response) {
  const text = await response.text().catch(() => '')
  if (!text) return ''

  try {
    const payload = JSON.parse(text) as { detail?: string; message?: string; title?: string }
    return payload.detail ?? payload.message ?? payload.title ?? text
  } catch {
    return text
  }
}
async function fetchApi(path: string, init?: RequestInit) {
  let lastError: unknown
  const candidates = [activeApiBaseUrl, ...apiBaseUrls.filter((baseUrl) => baseUrl !== activeApiBaseUrl)]

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init)
      activeApiBaseUrl = baseUrl
      return response
    } catch (error) {
      lastError = error
    }
  }

  throw new ApiConnectionError(lastError instanceof Error ? lastError.message : undefined)
}

function buildLocalApiBaseUrls(port: number) {
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname
  return Array.from(new Set([
    hostname ? `http://${hostname}:${port}` : null,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ].filter((value): value is string => Boolean(value))))
}

export async function registerAccount(name: string, email: string, password: string) {
  return postJson<UserProfile>('/api/auth/register', {
    name,
    email,
    password,
  })
}

export async function loginAccount(email: string, password: string) {
  return postJson<UserProfile>('/api/auth/login', {
    email,
    password,
  })
}

export async function requestPasswordReset(email: string) {
  return postJson<{ message: string }>('/api/auth/password-reset', { email })
}

export async function confirmPasswordReset(email: string, token: string, newPassword: string) {
  return postJson<{ message: string }>('/api/auth/password-reset/confirm', { email, token, newPassword })
}

export async function listRegisteredUsers() {
  return getJson<UserProfile[]>('/api/users')
}

export async function syncUserProfile(user: UserProfile) {
  await postJson('/api/auth/local', {
    id: user.id,
    name: user.name,
    email: user.email,
  })
}

export function createSyncBatchItem(item: SyncQueueItem, entity?: SyncableEntity): SyncBatchItem {
  return {
    queueItemId: item.id,
    userId: item.userId,
    entity: item.entity,
    entityId: item.entityId,
    operation: item.operation,
    payload: item.operation === 'delete' ? {} : toApiSyncPayload(item.entity, entity as SyncableEntity),
  }
}

export async function pushSyncBatch(items: SyncBatchItem[]) {
  const response = await postJson<SyncBatchResponse>(syncBatchPath, { items })
  return response.results
}

function toHouseholdPayload(household: Household) {
  return {
    id: household.id,
    ownerUserId: household.ownerUserId,
    name: household.name,
  }
}

function toHouseholdMemberPayload(member: HouseholdMember) {
  return {
    id: member.id,
    householdId: member.householdId,
    userId: member.userId,
    name: member.name,
    email: member.email,
    role: member.role,
  }
}

function toCategoryPayload(category: Category) {
  return {
    id: category.id,
    userId: category.userId,
    householdId: category.householdId,
    name: category.name,
    color: category.color,
  }
}

function toTransactionPayload(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    kind: toApiTransactionKind(transaction.kind),
    description: transaction.description,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    occurredAt: transaction.occurredAt,
  }
}

function toGoalPayload(goal: Goal) {
  return {
    id: goal.id,
    userId: goal.userId,
    householdId: goal.householdId,
    kind: goal.kind === 'debt' ? 'Debt' : 'Saving',
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
  }
}

function toBudgetPayload(budget: Budget) {
  return {
    id: budget.id,
    userId: budget.userId,
    categoryId: budget.categoryId,
    name: budget.name,
    color: budget.color,
    budgetKind: budget.budgetKind ?? 'expense',
    monthlyAmount: budget.monthlyAmount ?? budget.limitAmount,
    limitAmount: budget.limitAmount,
    allocationMode: budget.allocationMode,
    allocationValue: budget.allocationValue,
    preset: budget.preset,
    isAutomatic: budget.isAutomatic,
  }
}

function toPredictableIncomePayload(income: PredictableIncome) {
  return {
    id: income.id,
    userId: income.userId,
    description: income.description,
    amount: income.amount,
  }
}

function toApiSyncPayload(entityType: SyncQueueItem['entity'], entity: SyncableEntity) {
  if (entityType === 'category') return toCategoryPayload(entity as Category)
  if (entityType === 'goal') return toGoalPayload(entity as Goal)
  if (entityType === 'budget') return toBudgetPayload(entity as Budget)
  if (entityType === 'household') return toHouseholdPayload(entity as Household)
  if (entityType === 'household_member') return toHouseholdMemberPayload(entity as HouseholdMember)
  if (entityType === 'predictable_income') return toPredictableIncomePayload(entity as PredictableIncome)
  return toTransactionPayload(entity as Transaction)
}

function toApiTransactionKind(kind: TransactionKind) {
  if (kind === 'income') return 'Income'
  if (kind === 'fixed_expense') return 'FixedExpense'
  return 'VariableExpense'
}





