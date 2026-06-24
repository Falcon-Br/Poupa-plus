# Shared Categories and Goals Specification

## Status

Complete

## Goal

Let a user with a local household mark categories and goals as shared so the group has a visible planning surface before full multi-user permissions and conflict resolution exist.

## Scope Decision

Shared categories and goals are implemented as an optional `householdId` association on category and goal records. A record without `householdId` remains personal. A record with the active household id is visible as shared in the household panel while still participating in normal dashboard totals, transaction categorization, projections, and goal progress.

## Requirements

| Requirement ID | Requirement | Status |
| --- | --- | --- |
| SCG-01 | When a household exists, category creation can mark the category as shared with that household. | Complete |
| SCG-02 | When a household exists, goal creation can mark the goal as shared with that household. | Complete |
| SCG-03 | Shared categories and goals remain available in the normal dashboard calculations and planning views. | Complete |
| SCG-04 | The sharing panel shows which categories and goals are shared with the household. | Complete |
| SCG-05 | Local persistence and API sync payloads preserve the household association. | Complete |

## Out Of Scope

- Member-specific permissions.
- Cross-device conflict resolution.
- Backend authorization beyond the current demo/local user boundary.
- Editing existing categories/goals from personal to shared after creation.

## Verification

- Frontend unit/component tests cover shared form submission and sharing panel display.
- Backend and frontend gates pass.
## Completion Evidence

Completed on 2026-06-19.

- Frontend: added optional `householdId` to categories/goals, planning form sharing controls, household shared-planning lists, API sync payload fields, IndexedDB v3 indexes, and component coverage.
- Backend: added optional `HouseholdId` to category/goal records, request payloads, PostgreSQL selects/inserts/upserts, embedded schema, external schema, and indexes.
- Gates passed: `npm run lint`, `npm test -- --run` (9 files, 24 tests), `npm run build`, `dotnet build backend\PoupaPlus.slnx -m:1 -p:UseAppHost=false -v minimal`, and `dotnet test backend\PoupaPlus.slnx -v minimal` (5 tests).