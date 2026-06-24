import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyncBatchItem, pushSyncBatch } from './api'

describe('planning sync payloads', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
      text: vi.fn().mockResolvedValue(''),
    }))
  })

  it('preserves householdId when building a shared category sync payload', () => {
    const batchItem = createSyncBatchItem({
      id: 'queue-1',
      userId: 'user-1',
      entity: 'category',
      entityId: 'category-1',
      operation: 'create',
      status: 'pending',
      createdAt: '2026-06-19T12:00:00.000Z',
    }, {
      id: 'category-1',
      userId: 'user-1',
      householdId: 'household-1',
      name: 'Mercado',
      color: '#176b5b',
    })

    expect(batchItem).toEqual(expect.objectContaining({
      payload: {
        id: 'category-1',
        userId: 'user-1',
        householdId: 'household-1',
        name: 'Mercado',
        color: '#176b5b',
      },
    }))
  })

  it('preserves householdId and enum mapping when building a shared goal sync payload', () => {
    const batchItem = createSyncBatchItem({
      id: 'queue-2',
      userId: 'user-1',
      entity: 'goal',
      entityId: 'goal-1',
      operation: 'create',
      status: 'pending',
      createdAt: '2026-06-19T12:00:00.000Z',
    }, {
      id: 'goal-1',
      userId: 'user-1',
      householdId: 'household-1',
      kind: 'saving',
      name: 'Reserva',
      targetAmount: 1000,
      currentAmount: 250,
    })

    expect(batchItem).toEqual(expect.objectContaining({
      payload: {
        id: 'goal-1',
        userId: 'user-1',
        householdId: 'household-1',
        kind: 'Saving',
        name: 'Reserva',
        targetAmount: 1000,
        currentAmount: 250,
      },
    }))
  })

  it('posts pending items as a single sync batch request', async () => {
    await pushSyncBatch([
      {
        queueItemId: 'queue-1',
        userId: 'user-1',
        entity: 'transaction',
        entityId: 'transaction-1',
        operation: 'create',
        payload: {
          id: 'transaction-1',
          userId: 'user-1',
          kind: 'VariableExpense',
          description: 'Mercado',
          amount: 120,
          occurredAt: '2026-06-18',
        },
      },
    ])

    expect(fetch).toHaveBeenCalledWith('http://localhost:5254/api/sync/push', expect.objectContaining({
      body: JSON.stringify({
        items: [
          {
            queueItemId: 'queue-1',
            userId: 'user-1',
            entity: 'transaction',
            entityId: 'transaction-1',
            operation: 'create',
            payload: {
              id: 'transaction-1',
              userId: 'user-1',
              kind: 'VariableExpense',
              description: 'Mercado',
              amount: 120,
              occurredAt: '2026-06-18',
            },
          },
        ],
      }),
    }))
  })

  it('falls back to port 5000 when the default API port is unreachable', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] }),
        text: vi.fn().mockResolvedValue(''),
      })

    vi.stubGlobal('fetch', fetchMock)

    await pushSyncBatch([])

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:5254/api/sync/push', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:5254/api/sync/push', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:5000/api/sync/push', expect.any(Object))
  })
})

