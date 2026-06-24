# MVP Offline-First Specification

## Problem Statement

Poupa+ needs a first usable version where a person can manually manage monthly finances even without internet access. The MVP must prove the core product loop: log in, record financial activity, understand the month, and keep data safely stored locally for later sync.

## Goals

- [x] User can complete the monthly finance loop from login to dashboard insight.
- [x] User data remains available after reload and while offline.
- [x] Core calculations are protected by tests before implementation.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Bank statement import | Planned after manual offline-first flow is proven. |
| Couple/family sharing | Requires backend identity, permissions, and conflict strategy. |
| Production auth | MVP is portfolio/demo-first; auth facade will be replaceable later. |
| Automated financial intelligence | Comes after reliable data capture. |

---

## User Stories

### P1: Local Login and Workspace Access - MVP

**User Story**: As an individual user, I want to log in to a local Poupa+ workspace so that my financial data is scoped to my profile.

**Why P1**: Login is a stated product requirement and prepares the app for future backend auth.

**Acceptance Criteria**:

1. WHEN the user submits a valid name and email THEN system SHALL create or resume a local profile.
2. WHEN a profile is active THEN system SHALL show the finance workspace instead of the login screen.
3. WHEN the user logs out THEN system SHALL clear only the active session and preserve stored finance data.

**Independent Test**: Can demo by logging in, refreshing, and seeing the workspace remain available.

---

### P1: Manual Financial Entries - MVP

**User Story**: As an individual user, I want to record income and expenses for the month so that Poupa+ can calculate my balance.

**Why P1**: Financial entry is the core input for all reporting, projection, and goals.

**Acceptance Criteria**:

1. WHEN the user adds income THEN system SHALL include it in monthly income totals.
2. WHEN the user adds a fixed or variable expense THEN system SHALL include it in monthly expense totals.
3. WHEN the user provides invalid amount or missing description THEN system SHALL prevent the entry and show validation feedback.
4. WHEN the user reloads the app THEN system SHALL restore saved entries from local storage.

**Independent Test**: Can demo by adding one income and one expense, refreshing, and seeing totals remain correct.

---

### P1: Category-Based Dashboard - MVP

**User Story**: As an individual user, I want to see spending by category as a pie chart or treemap so that I can quickly understand where money went.

**Why P1**: Category visibility is one of the clearest immediate insights in the MVP.

**Acceptance Criteria**:

1. WHEN the user selects pie view THEN system SHALL display category spending as a pie chart.
2. WHEN the user selects treemap view THEN system SHALL display category spending as proportional rectangles.
3. WHEN no expenses exist THEN system SHALL show an empty state instead of a broken chart.

**Independent Test**: Can demo by adding categorized expenses and toggling both chart modes.

---

### P1: Offline-First Queue Status - MVP

**User Story**: As an individual user, I want Poupa+ to keep my changes offline and show sync status so that I can trust the app without internet.

**Why P1**: Offline-first is a product-defining requirement.

**Acceptance Criteria**:

1. WHEN the app is offline THEN system SHALL keep accepting new local entries.
2. WHEN a local change is saved THEN system SHALL add a pending sync item.
3. WHEN the app regains connectivity THEN system SHALL attempt to mark pending local changes as synced.
4. WHEN sync is not connected to a backend yet THEN system SHALL clearly represent queued local changes without losing data.

**Independent Test**: Can demo with browser offline mode by adding an entry and seeing pending status.

---

### P2: Goals - MVP Extension

**User Story**: As an individual user, I want to create saving or debt goals so that I can track progress toward a financial target.

**Why P2**: Goals are important but can follow the core capture/report loop.

**Acceptance Criteria**:

1. WHEN the user creates a saving goal THEN system SHALL store target amount and current amount.
2. WHEN the user creates a debt payoff goal THEN system SHALL store debt amount and paid amount.
3. WHEN goal data changes THEN system SHALL display progress percentage.

**Independent Test**: Can demo by creating one saving goal and one debt goal with visible progress.

---

### P2: Predictable Income Projection - MVP Extension

**User Story**: As an individual user, I want to register predictable income so that Poupa+ can estimate future months.

**Why P2**: Projection is valuable but depends on stable income/expense capture first.

**Acceptance Criteria**:

1. WHEN predictable income exists THEN system SHALL include it in next-month projection.
2. WHEN recurring fixed expenses exist THEN system SHALL subtract them from projected balance.
3. WHEN projection is calculated THEN system SHALL label it as an estimate.

**Independent Test**: Can demo by adding predictable income and fixed expense, then viewing the next-month estimate.

---

## Edge Cases

- WHEN the user has no transactions THEN system SHALL display zero totals and useful empty states.
- WHEN expense categories are missing THEN system SHALL group them under Uncategorized.
- WHEN the entered amount is zero or negative THEN system SHALL reject the entry.
- WHEN the browser is offline THEN system SHALL keep local operations available.
- WHEN local persistence fails THEN system SHALL show a recoverable error message.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MVP-01 | P1: Local Login and Workspace Access | Verified | Complete |
| MVP-02 | P1: Manual Financial Entries | Verified | Complete |
| MVP-03 | P1: Category-Based Dashboard | Verified | Complete |
| MVP-04 | P1: Offline-First Queue Status | Verified | Complete |
| MVP-05 | P2: Goals | Verified | Complete |
| MVP-06 | P2: Predictable Income Projection | Verified | Complete |

**Coverage:** 6 total, all implemented and covered by automated gates.

---

## Success Criteria

- [x] User can log in, add transactions, and see updated dashboard totals.
- [x] User can toggle pie and treemap views for category spending.
- [x] App builds as an installable PWA.
- [x] Unit tests cover monthly totals, category totals, and projection helpers.
- [x] App survives reload with local data preserved.
## Completion Note

2026-06-19: The offline-first MVP has been validated with frontend typecheck/lint, frontend tests, frontend PWA build, backend build, and backend tests. Import, sharing, and financial intelligence remain documented as post-MVP product lanes even though demo implementations already exist in the codebase; production-grade auth, conflict resolution, and full server sync semantics remain deferred.