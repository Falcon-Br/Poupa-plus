# State

## Decisions

- 2026-06-12: Keep the product name as Poupa+.
- 2026-06-12: Build the MVP offline-first before financial intelligence.
- 2026-06-12: Start as individual-use portfolio app while preserving a path to couple/family sharing.
- 2026-06-12: Use SDD with `tlc-spec-driven` artifacts and TDD for implementation.
- 2026-06-12: Use .NET Web API for backend, React/TypeScript/Vite for frontend, PostgreSQL for server database, and IndexedDB for offline-first browser storage.
- 2026-06-12: Backend starts with testable domain services and demo in-memory API store; PostgreSQL schema/Docker are prepared for the persistence adapter.

## Blockers

- 2026-06-15: Frontend dependency vulnerabilities were resolved by upgrading Vite, Vitest, vite-plugin-pwa, and @vitejs/plugin-react; `npm audit` reports 0 vulnerabilities.

## Preferences

- Final visual design will be refined later in Google Stitch through MCP.

## Deferred Ideas

- Bank statement import.
- Couple/family sharing.
- AI-like financial intelligence and recommendations.
- Production backend authentication and cloud sync.

## Todo

- Add production authentication/authorization before public deployment.
- Add update/delete sync semantics and conflict resolution before multi-device production sync.
- Add API integration/E2E coverage once backend sync semantics stabilize.

- 2026-06-15: Categories, goals, predictable income, and next-month projection were implemented in the offline-first frontend and mirrored in demo API endpoints.

- 2026-06-15: Added demo/local household sharing: users can create a household, add members, and queue those changes for future sync; API and PostgreSQL schema now include household records.
- 2026-06-15: Renamed the sync queue label from ambiguous pending text to 'aguardando sync' with a tooltip explaining the offline-first queue.

- 2026-06-15: Added CSV statement import with preview, category classification, duplicate detection, offline transaction creation, and a demo API import endpoint.
- 2026-06-15: Added initial financial intelligence: narrative monthly report, expense trend detection, and savings/debt suggestions based on balance, categories, and goals.

- 2026-06-18: AIOS kernel source was cloned to `tools/AIOS-kernel` and installed as Docker image `poupa-aios:local` using Python 3.11.8 on Debian Bookworm. Local fixes: Dockerfile installs `git`, uses Bookworm for SQLite >= 3.35, and launches `runtime.launch:app`. Created `aios/config/config.yaml` from the example and changed Ollama URLs to `http://host.docker.internal:11434`. Validation: `/core/status` returned all components active from a temporary container bound to `127.0.0.1:18000`. Logs note Redis and MCP server warnings, but they did not block kernel startup. A partial failed clone remains at `tools/AIOS` and can be removed after confirmation.
- 2026-06-18: Frontend sync queue now attempts real API sync when online: it syncs the local user profile first, sends pending queued entities to the .NET endpoints, marks successful items as synced, and leaves API/network failures pending for retry.
- 2026-06-19: MVP Offline-First was closed as complete after multi-agent audit and implementation cleanup. Fixes included API login compilation (`request.Email` normalization), resilient PostgreSQL schema initialization, embedded schema alignment for `sync_queue`, updated API HTTP examples, frontend `lint`/`typecheck` scripts, and component coverage for transaction form/dashboard empty state. Gates passed: frontend lint/typecheck, 6 frontend test files / 20 tests, frontend PWA build, backend serial build with `UseAppHost=false`, 5 backend tests, and local Vite smoke check returning HTTP 200 at `http://127.0.0.1:5173/`.
- 2026-06-19: Completed Shared Categories and Goals. Categories and goals now support optional `householdId` sharing, the planning forms can share new category/goal records with the active household, the sharing panel lists shared categories and goals, frontend sync payloads preserve the household association, and PostgreSQL schemas/API records store the optional household link. Validation passed with frontend lint, 9 frontend test files / 24 tests, frontend PWA build, backend serial build with `UseAppHost=false`, and 5 backend tests.
- 2026-06-19: Completed Backend Sync Service. Frontend sync now batches pending create queue items into POST /api/sync/push, the backend processes each item independently, records server-side sync status in PostgreSQL sync_queue, and returns per-item synced or failed results. Validation passed with frontend lint, 9 frontend test files / 25 tests, backend serial build with UseAppHost=false, and 5 backend tests.
- 2026-06-19: Completed Product UX Improvements. Added predefined and custom category colors, a stacked daily spending chart with X/Y axes and category proportions, adaptive goal placeholders, separate income and expense entry cards, month/type/category dashboard filters, cent-aware money entry, visible sync status and queue details, API-first registration/login, backend registered-user sharing selection, and sync ID preservation for local queue pushes. Production-grade tokens and authorization remain a separate todo.


