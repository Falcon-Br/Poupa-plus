import { describe, expect, it, vi } from 'vitest'
import { syncPendingItems } from './syncEngine'
import type { SyncQueueItem, Transaction } from '../domain/types'

const pendingTransaction: SyncQueueItem = {
  id: 'queue-1',
  userId: 'user-1',
  entity: 'transaction',
  entityId: 'transaction-1',
  operation: 'create',
  status: 'pending',
  createdAt: '2026-06-18T12:00:00.000Z',
}

const transaction: Transaction = {
  id: 'transaction-1',
  userId: 'user-1',
  kind: 'variable_expense',
  description: 'Mercado',
  amount: 120,
  occurredAt: '2026-06-18',
  createdAt: '2026-06-18T12:00:00.000Z',
}

describe('syncPendingItems', () => {
  it('syncs queue items from a single batch response and reflects mixed item statuses', async () => {
    const pendingCategory: SyncQueueItem = {
      ...pendingTransaction,
      id: 'queue-2',
      entity: 'category',
      entityId: 'category-1',
    }
    const loadEntity = vi
      .fn()
      .mockResolvedValueOnce(transaction)
      .mockResolvedValueOnce({
        id: 'category-1',
        userId: 'user-1',
        householdId: 'household-1',
        name: 'Mercado',
        color: '#176b5b',
      })
    const buildBatchItem = vi
      .fn()
      .mockReturnValueOnce({ queueItemId: 'queue-1' })
      .mockReturnValueOnce({ queueItemId: 'queue-2' })
    const pushBatch = vi.fn().mockResolvedValue([
      { queueItemId: 'queue-1', status: 'synced' },
      { queueItemId: 'queue-2', status: 'failed', message: 'Unsupported operation update.' },
    ])
    const markSynced = vi.fn().mockResolvedValue(undefined)
    const markFailed = vi.fn().mockResolvedValue(undefined)

    const result = await syncPendingItems([pendingTransaction, pendingCategory], {
      loadEntity,
      buildBatchItem,
      pushBatch,
      markSynced,
      markFailed,
    })

    expect(loadEntity).toHaveBeenCalledWith(pendingTransaction)
    expect(loadEntity).toHaveBeenCalledWith(pendingCategory)
    expect(pushBatch).toHaveBeenCalledWith([{ queueItemId: 'queue-1' }, { queueItemId: 'queue-2' }])
    expect(markSynced).toHaveBeenCalledWith('queue-1')
    expect(markFailed).toHaveBeenCalledWith('queue-2')
    expect(result).toEqual({ synced: 1, failed: 1 })
  })

  it('marks a queue item as failed when its local entity no longer exists', async () => {
    const markSynced = vi.fn().mockResolvedValue(undefined)
    const markFailed = vi.fn().mockResolvedValue(undefined)
    const buildBatchItem = vi.fn()
    const pushBatch = vi.fn()

    const result = await syncPendingItems([pendingTransaction], {
      loadEntity: vi.fn().mockResolvedValue(undefined),
      buildBatchItem,
      pushBatch,
      markSynced,
      markFailed,
    })

    expect(buildBatchItem).not.toHaveBeenCalled()
    expect(pushBatch).not.toHaveBeenCalled()
    expect(markSynced).not.toHaveBeenCalled()
    expect(markFailed).toHaveBeenCalledWith('queue-1')
    expect(result).toEqual({ synced: 0, failed: 1 })
  })

  it('leaves a queue item pending when the API sync fails', async () => {
    const markSynced = vi.fn().mockResolvedValue(undefined)
    const markFailed = vi.fn().mockResolvedValue(undefined)
    const buildBatchItem = vi.fn().mockReturnValue({ queueItemId: 'queue-1' })

    await expect(
      syncPendingItems([pendingTransaction], {
        loadEntity: vi.fn().mockResolvedValue(transaction),
        buildBatchItem,
        pushBatch: vi.fn().mockRejectedValue(new Error('network unavailable')),
        markSynced,
        markFailed,
      }),
    ).rejects.toThrow('network unavailable')

    expect(markSynced).not.toHaveBeenCalled()
    expect(markFailed).not.toHaveBeenCalled()
  })
})
