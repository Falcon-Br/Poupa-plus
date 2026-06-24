import type { SyncQueueItem } from '../domain/types'

export function createId() {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createSyncItem(
  userId: string,
  entity: SyncQueueItem['entity'],
  entityId: string,
  operation: SyncQueueItem['operation'] = 'create',
): SyncQueueItem {
  return {
    id: createId(),
    userId,
    entity,
    entityId,
    operation,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}
