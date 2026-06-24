export type TransactionKind = 'income' | 'fixed_expense' | 'variable_expense'

export interface UserProfile {
  id: string
  name: string
  email: string
  createdAt: string
  passwordHash?: string
}

export interface Household {
  id: string
  ownerUserId: string
  name: string
  createdAt: string
}

export interface HouseholdMember {
  id: string
  householdId: string
  userId?: string
  name: string
  email: string
  role: 'owner' | 'member'
  createdAt: string
}

export interface Category {
  id: string
  userId: string
  householdId?: string
  name: string
  color: string
}

export interface Transaction {
  id: string
  userId: string
  kind: TransactionKind
  description: string
  amount: number
  categoryId?: string
  occurredAt: string
  createdAt: string
}

export interface Goal {
  id: string
  userId: string
  householdId?: string
  kind: 'saving' | 'debt'
  name: string
  targetAmount: number
  currentAmount: number
}

export interface Budget {
  id: string
  userId: string
  categoryId: string
  name: string
  color: string
  budgetKind: 'income' | 'expense'
  monthlyAmount: number
  limitAmount: number
  allocationMode: 'percentage' | 'fixed' | 'preset'
  allocationValue: number
  preset: 'essential' | 'lifestyle' | 'reserve' | 'custom'
  isAutomatic: boolean
  period: 'monthly'
  createdAt: string
}

export interface PredictableIncome {
  id: string
  userId: string
  description: string
  amount: number
  frequency: 'monthly'
}

export interface SyncQueueItem {
  id: string
  userId: string
  entity: 'transaction' | 'category' | 'goal' | 'budget' | 'predictable_income' | 'household' | 'household_member'
  entityId: string
  operation: 'create' | 'update' | 'delete'
  status: 'pending' | 'synced' | 'failed'
  createdAt: string
}

export interface FinanceSnapshot {
  user: UserProfile
  household?: Household
  householdMembers: HouseholdMember[]
  categories: Category[]
  transactions: Transaction[]
  goals: Goal[]
  budgets: Budget[]
  predictableIncomes: PredictableIncome[]
  syncQueue: SyncQueueItem[]
  registeredUsers?: UserProfile[]
}





