# MVP Offline-First Tasks

**Design**: `.specs/features/mvp-offline-first/design.md`
**Status**: Complete

---

## Execution Plan

### Phase 1: Foundation

```text
T1 -> T2 -> T3
```

### Phase 2: Core Vertical Slice

```text
T3 -> T4 -> T5 -> T6
```

### Phase 3: Verification

```text
T6 -> T7
```

---

## Task Breakdown

### T1: Create full-stack project scaffold

**What**: Create monorepo structure with .NET backend, React frontend, PostgreSQL Docker config, and dependency configuration.
**Where**: `backend/`, `frontend/`, `docker-compose.yml`, `database/schema.sql`
**Depends on**: None
**Reuses**: Greenfield setup.
**Requirement**: MVP-01, MVP-04

**Tools**:

- MCP: filesystem
- Skill: tlc-spec-driven, tdd-workflow

**Done when**:

- [x] Project installs dependencies.
- [x] Vite app entry renders.
- [x] PWA manifest/config exists.

**Tests**: build
**Gate**: build

---

### T2: Define domain types and finance calculations

**What**: Add finance types and pure functions for monthly totals, category totals, projections, and goal progress in backend and frontend.
**Where**: `backend/PoupaPlus.Domain/Finance/`, `backend/PoupaPlus.Tests/Finance/`, `frontend/src/domain/`
**Depends on**: T1
**Reuses**: TESTING.md domain layer rules.
**Requirement**: MVP-02, MVP-03, MVP-05, MVP-06

**Tools**:

- MCP: filesystem
- Skill: tdd-workflow

**Done when**:

- [x] Tests describe totals and category grouping before implementation.
- [x] Domain functions pass deterministic tests.
- [x] Gate check passes: `npm test -- --run`

**Tests**: unit
**Gate**: quick

---

### T3: Create persistence boundaries

**What**: Add IndexedDB wrapper for offline frontend storage and prepare PostgreSQL schema for server persistence.
**Where**: `frontend/src/data/db.ts`, `database/schema.sql`
**Depends on**: T2
**Reuses**: Domain types.
**Requirement**: MVP-01, MVP-02, MVP-04

**Tools**:

- MCP: filesystem
- Skill: tdd-workflow

**Done when**:

- [x] Repository can create/resume user profiles.
- [x] Repository can save transactions and sync queue items.
- [x] App can load a user snapshot.

**Tests**: unit
**Gate**: quick

---

### T4: Build local login and transaction capture

**What**: Add login screen, transaction form, validation, and local save flow.
**Where**: `src/App.tsx`, `src/features/transactions/TransactionForm.tsx`
**Depends on**: T3
**Reuses**: Local repository and domain types.
**Requirement**: MVP-01, MVP-02, MVP-04

**Tools**:

- MCP: filesystem
- Skill: frontend-best-practices, tdd-workflow

**Done when**:

- [x] User can create/resume a local profile.
- [x] User can submit valid income and expenses.
- [x] Invalid entries are rejected with visible feedback.

**Tests**: unit
**Gate**: quick

---

### T5: Build dashboard charts and report summary

**What**: Add responsive dashboard with totals, pie/treemap toggle, report copy, goals preview, and sync status.
**Where**: `src/features/dashboard/Dashboard.tsx`, `src/App.css`
**Depends on**: T4
**Reuses**: Domain summary functions and Recharts.
**Requirement**: MVP-03, MVP-04, MVP-05, MVP-06

**Tools**:

- MCP: filesystem
- Skill: frontend-best-practices

**Done when**:

- [x] Dashboard reflects current transactions.
- [x] Pie and treemap chart modes can be toggled.
- [x] Empty state appears when there are no expenses.
- [x] Mobile and desktop layouts are usable.

**Tests**: unit
**Gate**: quick

---

### T6: Wire PWA and backend API experience

**What**: Add app manifest metadata, offline-ready PWA plugin config, connectivity indicator, queued-sync status, and .NET API endpoints.
**Where**: `frontend/vite.config.ts`, `frontend/src/App.tsx`, `frontend/src/data/sync.ts`, `backend/PoupaPlus.Api/Program.cs`
**Depends on**: T5
**Reuses**: Sync queue model.
**Requirement**: MVP-04

**Tools**:

- MCP: filesystem
- Skill: frontend-best-practices

**Done when**:

- [x] Production build includes PWA assets.
- [x] Offline/online status is reflected in UI.
- [x] Pending sync count is visible.

**Tests**: build
**Gate**: build

---

### T7: Verify MVP vertical slice

**What**: Run tests/build and verify the local app responds through the dev server.
**Where**: Full project.
**Depends on**: T6
**Reuses**: TESTING.md gates.
**Requirement**: MVP-01, MVP-02, MVP-03, MVP-04

**Tools**:

- MCP: browser
- Skill: tlc-spec-driven

**Done when**:

- [x] Gate check passes: `npm test -- --run && npm run build`
- [x] Local dev server responds at the app URL.
- [x] Login/dashboard/transaction/chart behavior is covered by automated frontend tests.

**Tests**: full
**Gate**: full

---

## Validation Tables

### Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | Project scaffold | OK |
| T2 | Domain functions and colocated tests | OK |
| T3 | Local repository boundary | OK |
| T4 | Login plus transaction capture flow | OK |
| T5 | Dashboard visualization | OK |
| T6 | PWA/offline wiring | OK |
| T7 | Verification | OK |

### Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Start | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |
| T5 | T4 | T4 -> T5 | Match |
| T6 | T5 | T5 -> T6 | Match |
| T7 | T6 | T6 -> T7 | Match |

### Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | PWA/config | build | build | OK |
| T2 | Domain calculations | unit | unit | OK |
| T3 | Local persistence adapters | unit | unit | OK |
| T4 | React components | unit | unit | OK |
| T5 | React components | unit | unit | OK |
| T6 | PWA/service worker config | build | build | OK |
| T7 | Full project | full | full | OK |

## Completion Evidence

2026-06-19 gates:

- `npm run lint` passed in `frontend`.
- `npm test -- --run` passed in `frontend` with 6 test files and 20 tests.
- `npm run build` passed in `frontend` and generated PWA assets.
- `dotnet build backend\PoupaPlus.slnx -m:1 -p:UseAppHost=false -v minimal` passed. `UseAppHost=false` avoids a stale locked `PoupaPlus.Api.exe`; the API DLL build succeeds.
- `dotnet test backend\PoupaPlus.slnx -v minimal` passed with 5 backend tests.
- Local dev server smoke check returned HTTP 200 at http://127.0.0.1:5173/.
