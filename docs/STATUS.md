# Project status

The backend API and sample data are in place. The frontend now has a branded React dashboard, organization/contact/deal lists and detail pages, and a pipeline board. Lists support search, sorting, contact-status and deal-stage filters, and create/edit/delete actions. Record details show links and timelines; contact and deal pages can log notes, calls, emails and follow-up dates. Pipeline stage moves use the API and refresh weighted totals. Backend tests cover seed/reset, CRUD relationships, deletion behavior, activity links, probability rules, dashboard totals, and pipeline reads/moves. Focused frontend tests cover formatting and dashboard month grouping.

The dashboard uses `/api/dashboard`, `/api/pipeline` and `/api/deals` for metrics and charts. Focused Vitest coverage is in `frontend/src/features/shared/format.test.ts`.

To run locally from the repository root, use `npm run dev`. Run checks with `npm test` and build the frontend with `npm run build`.

Run `npm install` once, then `npm run dev` starts the API and Vite frontend together. `npm run seed` resets the runtime database. `npm test` runs backend pytest, frontend Vitest, and the Chrome smoke test.

Opening the API root at `http://127.0.0.1:8000` redirects to the frontend at `http://127.0.0.1:5173` (or the configured web port).
