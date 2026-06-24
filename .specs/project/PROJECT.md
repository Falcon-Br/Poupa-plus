# Poupa+

**Vision:** Poupa+ is a personal finance web app, mobile PWA, and .NET-backed API that helps users understand the current month, keep working offline, and plan near-term financial outcomes from predictable income and recurring expenses.
**For:** People managing personal finances manually today, starting with individual use and later expanding to couples and families.
**Solves:** Gives a clear, offline-capable place to record income, expenses, categories, fixed bills, variable bills, and goals without depending on bank integrations in v1.

## Goals

- Ship a portfolio-ready MVP where a user can log in, record monthly income and expenses, and see totals plus category charts in under 2 minutes.
- Preserve offline-first behavior: user-entered financial data remains available without internet and is queued for later sync when connectivity returns.
- Establish a codebase that can later add shared households, bank statement imports, and financial intelligence without rewriting the core data model.

## Tech Stack

**Core:**

- Frontend: React with Vite
- Backend: .NET Web API
- Languages: TypeScript and C#
- Database: PostgreSQL for server-side persistence; IndexedDB in the browser for offline-first local storage

**Key dependencies:**

- React and React DOM for UI
- Dexie for IndexedDB persistence
- Recharts for pie and treemap visualizations
- Vite PWA plugin for installability and service worker setup
- ASP.NET Core for API endpoints
- xUnit for backend TDD and Vitest/Testing Library for frontend TDD

## Scope

**v1 includes:**

- User login/session suitable for portfolio/demo use
- Monthly dashboard with income, expenses, balance, and chart view toggle
- Manual transaction entry for income, fixed expenses, and variable expenses
- User-created categories for report grouping
- Goals for saving money or paying down debt
- Predictable income records used for simple month-ahead projections
- Offline-first local persistence with sync queue status
- Responsive web layout that works on desktop and mobile PWA widths

**Explicitly out of scope:**

- Bank statement import: planned after the MVP.
- Production-grade authentication: the MVP will start with an API-backed local/demo auth boundary and evolve into full auth later.
- Multi-user couple/family sharing: data model should allow it later, but v1 is single-user.
- Automated financial intelligence: planned after the offline-first MVP.

## Constraints

- Timeline: Build the smallest useful vertical slice first, then evolve.
- Technical: Offline-first behavior is a core constraint, not an enhancement.
- Resources: Single-developer portfolio project; implementation should stay understandable and demo-friendly.
