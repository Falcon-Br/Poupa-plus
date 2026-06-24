# Testing Strategy

## Test Coverage Matrix

| Code Layer | Required Test Type | Parallel-Safe | Notes |
| --- | --- | --- | --- |
| Domain calculations | unit | Yes | Totals, grouping, projections, goal progress, report summaries. |
| .NET domain services | unit | Yes | C# equivalents for backend finance behavior. |
| API endpoints | integration | No | Add once PostgreSQL persistence is wired. |
| Local persistence adapters | unit | Yes | Mock or isolate browser storage where practical. |
| React components | unit | Yes | Use Testing Library for behavior and accessibility. |
| PWA/service worker config | build | Yes | Validate through production build. |
| End-to-end flows | e2e | No | Deferred until the app has stable navigation and backend-like sync. |

## Gate Check Commands

| Gate | Command | Expected Use |
| --- | --- | --- |
| quick | `npm test -- --run` | Domain and component behavior during development. |
| backend-quick | `dotnet test backend/PoupaPlus.slnx` | Backend domain tests. |
| build | `npm run build` | TypeScript, Vite, PWA, and production bundle validation. |
| full | `dotnet build backend/PoupaPlus.slnx -m:1 -p:UseAppHost=false -v minimal && dotnet test backend/PoupaPlus.slnx && npm run lint && npm test -- --run && npm run build` | Before marking a milestone complete. |

## TDD Rules

- Write or update tests before implementing domain behavior.
- Keep tests close to the behavior they protect.
- Prefer deterministic unit tests for calculations and state transitions.
- Use component tests for user-visible state changes, not layout snapshots.

## Latest Gate Result

2026-06-19: MVP gates passed. The backend build uses `-m:1 -p:UseAppHost=false` because a stale Windows `PoupaPlus.Api.exe` can remain locked while the API DLL builds successfully. Frontend tests passed with 6 files and 20 tests; backend tests passed with 5 tests.