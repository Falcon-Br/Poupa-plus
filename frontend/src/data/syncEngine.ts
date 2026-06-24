import {
  createSyncBatchItem,
  pushSyncBatch,
  syncUserProfile,
  type SyncBatchItem,
  type SyncBatchItemResult,
} from './api'
import { db } from './db'
import { createSyncItem } from './sync'
import type {
  Budget,
  Category,
  Goal,
  Household,
  HouseholdMember,
  PredictableIncome,
  SyncQueueItem,
  Transaction,
} from '../domain/types'

type SyncableEntity = Budget | Category | Goal | Household | HouseholdMember | PredictableIncome | Transaction

interface SyncPendingItemsDependencies {
  loadEntity: (item: SyncQueueItem) => Promise<SyncableEntity | undefined>
  buildBatchItem: (item: SyncQueueItem, entity?: SyncableEntity) => SyncBatchItem
  pushBatch: (items: SyncBatchItem[]) => Promise<SyncBatchItemResult[]>
  markSynced: (itemId: string) => Promise<void>
  markFailed: (itemId: string) => Promise<void>
}

export interface SyncResult {
  synced: number
  failed: number
}

export async function syncPendingQueue(userId: string): Promise<SyncResult> {
  const user = await db.users.get(userId)
  if (user) {
    await syncUserProfile(user)
  }

  const initialPendingItems = await loadPendingQueue(userId)
  await ensureReferencedCategoriesAreQueued(userId, initialPendingItems)
  const pendingItems = orderSyncItems(await loadPendingQueue(userId))

  return syncPendingItems(pendingItems, {
    loadEntity: loadLocalEntity,
    buildBatchItem: createSyncBatchItem,
    pushBatch: pushSyncBatch,
    markSynced: async (itemId) => {
      await db.syncQueue.update(itemId, { status: 'synced' })
    },
    markFailed: async (itemId) => {
      await db.syncQueue.update(itemId, { status: 'failed' })
    },
  })
}

export async function syncPendingItems(
  items: SyncQueueItem[],
  dependencies: SyncPendingItemsDependencies,
): Promise<SyncResult> {
  let synced = 0
  let failed = 0
  const batchItems: SyncBatchItem[] = []

  for (const item of items) {
    const entity = await dependencies.loadEntity(item)
    if (!entity && item.operation !== 'delete') {
      await dependencies.markFailed(item.id)
      failed++
      continue
    }

    batchItems.push(dependencies.buildBatchItem(item, entity))
  }

  if (batchItems.length === 0) {
    return { synced, failed }
  }

  const results = await dependencies.pushBatch(batchItems)

  for (const result of results) {
    if (result.status === 'synced') {
      await dependencies.markSynced(result.queueItemId)
      synced++
      continue
    }

    await dependencies.markFailed(result.queueItemId)
    failed++
  }

  return { synced, failed }
}

async function loadPendingQueue(userId: string) {
  return db.syncQueue
    .where('userId')
    .equals(userId)
    .and((item) => item.status === 'pending' || item.status === 'failed')
    .sortBy('createdAt')
}

async function ensureReferencedCategoriesAreQueued(userId: string, items: SyncQueueItem[]) {
  const transactions = await Promise.all(
    items
      .filter((item) => item.entity === 'transaction')
      .map((item) => db.transactions.get(item.entityId)),
  )
  const categoryIds = Array.from(new Set(
    transactions
      .map((transaction) => transaction?.categoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId)),
  ))

  for (const categoryId of categoryIds) {
    const category = await db.categories.get(categoryId)
    if (!category) continue

    const existingQueueItem = await db.syncQueue
      .where('entityId')
      .equals(categoryId)
      .and((item) => item.entity === 'category')
      .first()

    if (!existingQueueItem) {
      await db.syncQueue.add(createSyncItem(userId, 'category', categoryId))
    }
  }
}

function orderSyncItems(items: SyncQueueItem[]) {
  const priority: Record<SyncQueueItem['entity'], number> = {
    household: 0,
    household_member: 1,
    category: 2,
    goal: 3,
    budget: 3,
    predictable_income: 3,
    transaction: 4,
  }

  return [...items].sort((left, right) => {
    const priorityDelta = priority[left.entity] - priority[right.entity]
    return priorityDelta || left.createdAt.localeCompare(right.createdAt)
  })
}

async function loadLocalEntity(item: SyncQueueItem) {
  if (item.entity === 'category') return db.categories.get(item.entityId)
  if (item.entity === 'goal') return db.goals.get(item.entityId)
  if (item.entity === 'household') return db.households.get(item.entityId)
  if (item.entity === 'household_member') return db.householdMembers.get(item.entityId)
  if (item.entity === 'predictable_income') return db.predictableIncomes.get(item.entityId)
  if (item.entity === 'budget') return db.budgets.get(item.entityId)
  return db.transactions.get(item.entityId)
}




