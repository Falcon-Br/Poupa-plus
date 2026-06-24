# Roadmap

**Current Milestone:** MVP Offline-First
**Status:** Complete

---

## MVP Offline-First

**Goal:** A user can install/open Poupa+, log in locally, record finances manually, view monthly insights, and keep using it offline.
**Target:** Functional web app with tests, backend build, frontend build, and local dev server verification passing.

### Features

**Local Login and Session** - COMPLETE

- Create a demo-safe login/session flow.
- Persist the active local profile.
- Route users into the finance workspace after login.

**Monthly Finance Dashboard** - COMPLETE

- Show monthly income, expenses, and balance.
- Toggle category visualization between pie and treemap.
- Show a short month report summary.

**Offline Transaction Capture** - COMPLETE

- Add income, fixed expense, and variable expense records.
- Save records to IndexedDB.
- Queue local changes for future sync.

**Categories** - COMPLETE

- Create user-defined categories.
- Assign categories to transactions.
- Summarize reports by category.

**Goals** - COMPLETE

- Create saving goals.
- Create debt payoff goals.
- Track progress against current financial data.

**Predictable Income Projection** - COMPLETE

- Register predictable income.
- Project next months using predictable income and recurring expenses.

---


### Completion Evidence

Completed on 2026-06-19 with the following gates passing:

- Frontend lint/typecheck: `npm run lint`
- Frontend unit/component tests: `npm test -- --run` (6 files, 20 tests)
- Frontend PWA build: `npm run build`
- Backend build: `dotnet build backend\PoupaPlus.slnx -m:1 -p:UseAppHost=false -v minimal`
- Backend tests: `dotnet test backend\PoupaPlus.slnx -v minimal` (5 tests)
- Local app smoke check: `http://127.0.0.1:5173/` returned HTTP 200

## Shared Finance

**Goal:** Expand the individual model into couple/family collaboration.

### Features

**Households** - COMPLETE
**Member Roles** - COMPLETE
**Shared Categories and Goals** - COMPLETE

---

## Imported Data

**Goal:** Reduce manual entry by importing bank statements.

### Features

**Statement Import** - COMPLETE
**Transaction Classification Review** - COMPLETE
**Duplicate Detection** - COMPLETE

---

## Financial Intelligence

**Goal:** Turn captured data into useful guidance.

### Features

**Monthly Narrative Report** - COMPLETE
**Trend Detection** - COMPLETE
**Savings and Debt Suggestions** - COMPLETE

---

## Future Considerations

- Push reminders for fixed bills and goal check-ins.
- CSV/PDF export.
- Stitch-driven final design system once product flows settle.


