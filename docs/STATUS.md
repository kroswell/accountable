# Project status

The backend API and sample data are in place. The frontend now has a branded React dashboard, organization/contact/deal lists and detail pages, and a pipeline board. Lists support search, sorting, contact-status and deal-stage filters, and create/edit/delete actions. Record details show links and timelines; contact and deal pages can log notes, calls, emails and follow-up dates. Pipeline stage moves use the API and refresh weighted totals. Backend tests cover seed/reset, CRUD relationships, deletion behavior, activity links, probability rules, dashboard totals, and pipeline reads/moves. Focused frontend tests cover formatting and dashboard month grouping.

The dashboard follows mockup 2's Sales cockpit, including local brand fonts, metrics, 12-month revenue chart, stage funnel, activity/follow-ups and pipeline preview. It uses `/api/dashboard`, `/api/pipeline` and `/api/deals` for live data.

The dashboard has been checked against mockup 2 in Chrome at 1440×1000 and 1024×768; no browser console errors were found.

To run locally from the repository root, use `npm run dev`. Run checks with `npm test` and build the frontend with `npm run build`.

Run `npm install` once, then `npm run dev` starts the API and Vite frontend together. `npm run seed` resets the runtime database. `npm test` runs backend pytest, frontend Vitest, and the Chrome smoke test using an isolated E2E database.

Opening the API root at `http://127.0.0.1:8000` redirects to the frontend at `http://127.0.0.1:5173` (or the configured web port).

## Review findings

The branch review identified and fixed these blocking issues:

- Deal edits now apply derived/manual probability rules and create a stage-change timeline entry.
- Pipeline moves now persist the exact requested position, including in-column reorders.
- Pipeline UI now supports pointer dragging and an exact-position alternative.
- Timeline activities now support editing and deletion.
- Dashboard and timeline follow-ups now support completion.
