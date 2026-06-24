# Backend Sync Service Specification

## Status

Complete

## Goal

Replace the current entity-by-entity frontend sync calls with an explicit backend sync push service that accepts the local pending queue as a batch, processes items individually, records server-side sync status, and returns per-item results to the client.

## Scope Decision

This iteration implements push sync for queued `create` operations only. It does not implement downsync, delete tombstones, conflict resolution, or background workers yet. Unsupported operations fail explicitly per item instead of being silently ignored.

## Requirements

| Requirement ID | Requirement | Status |
| --- | --- | --- |
| BSS-01 | The backend exposes a dedicated batch sync endpoint for queued client items. | Complete |
| BSS-02 | The backend processes each sync item independently and returns per-item `synced` or `failed` results. | Complete |
| BSS-03 | The backend writes sync processing records into PostgreSQL `sync_queue`. | Complete |
| BSS-04 | The frontend sends pending queue items to the new batch endpoint instead of posting each entity directly. | Complete |
| BSS-05 | The frontend marks queue items as `synced` or `failed` based on per-item batch results. | Complete |
| BSS-06 | Unsupported operations like `update` and `delete` fail explicitly with a message instead of being ignored. | Complete |

## Out Of Scope

- Downsync / server-to-client hydration.
- Conflict resolution and merge strategies.
- Tombstones or delete propagation.
- Automatic retries/backoff scheduler beyond the current online-triggered flow.
- Production authn/authz hardening.

## Verification

- `npm run lint` in `frontend`
- `npm test -- --run` in `frontend` (9 files, 25 tests)
- `dotnet build backend\PoupaPlus.slnx -m:1 -p:UseAppHost=false -v minimal`
- `dotnet test backend\PoupaPlus.slnx -v minimal` (5 tests)
