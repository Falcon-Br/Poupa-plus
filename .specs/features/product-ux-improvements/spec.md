# Product UX Improvements Specification

## Status

Complete

## Goal

Improve day-to-day finance workflows with clearer filters, better data entry, visible sync feedback, more useful charts, and safer local sharing.

## Scope Decision

This iteration delivers offline-first product operations after authentication. Registration and login are API-first, while transactions, categories, goals, predictable income, household changes, and imports remain offline-capable with sync queue retries. Production-grade tokens, password hardening, and authorization middleware remain out of scope.

## Requirements

| Requirement ID | Requirement | Status |
| --- | --- | --- |
| UX-01 | Categories offer predefined color swatches and a custom color picker. | Complete |
| UX-02 | The rectangle chart mode is replaced by a time-based spending chart with X/Y axes and stacked category proportions per day. | Complete |
| UX-03 | Goal placeholders and labels adapt to saving vs debt payoff. | Complete |
| UX-04 | New transactions are split into separate expense and income cards. | Complete |
| UX-05 | Sharing only allows adding users already registered in the backend system. | Complete |
| UX-06 | Dashboard includes month, type, and category filters. | Complete |
| UX-07 | Money inputs accept cent values with comma or dot parsing. | Complete |
| UX-08 | Sync status shows syncing, success, error, and pending local queue details. | Complete |
| UX-09 | Login screen supports API-first account registration and password-based login. | Complete |

## Verification

- `npm run lint` in `frontend`
- `npm test -- --run` in `frontend` (9 files, 25 tests)
- `npm run build` in `frontend`
- `dotnet build backend\PoupaPlus.slnx -m:1 -p:UseAppHost=false -v minimal`
- `dotnet test backend\PoupaPlus.slnx -v minimal` (5 tests)

