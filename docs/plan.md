# Accountable MVP Plan

## Packaging decision

The packaging is a good foundation for the CRM-to-Business-OS direction, but the first frontend structure was too helper-oriented. The implementation will use vertical feature folders, a thin shared API module, and only a small set of reusable UI primitives.

- **Keep:** one feature folder per user area (`dashboard`, `organizations`, `contacts`, `deals`, `pipeline`, `activities`). A later ERP module can add another feature without changing the existing feature folders.
- **Keep:** one route per record page, typed API responses, and feature-local components/tests.
- **Avoid:** generic repository/service layers, a large `lib/` of speculative helpers, generic "base" forms, and shared components designed for requirements that do not exist yet.
- **Shared UI:** use only genuinely cross-product primitives such as Button, Dialog, Toast, Field, Badge, EmptyState, and ConfirmDialog.
- **Shared logic:** use `api/client.ts` and a few direct format functions for money and dates. Pipeline move, dashboard aggregation, and deletion behavior stay feature-local unless duplicate implementation proves they need extraction.
- **Upgrade path:** route definitions, API types, and feature boundaries are explicit. React Query/cache and a component library can be introduced without a folder rewrite. Supabase can replace the HTTP client implementation later while feature components continue through the same feature API modules.
- **Not satisfied rationale:** no amount of extra abstraction is needed for one salesperson. Future readiness comes from clear boundaries and consistent patterns, not from a framework-sized frontend architecture.

## Files that change

- Root:
  - `package.json`, `package-lock.json`: define npm workspace `frontend`, scripts `dev`, `test`, `seed`, and test sub-scripts.
  - `pyproject.toml`, `uv.lock`, `.python-version`: define Python 3.12 and backend dependencies.
  - `scripts/dev.mjs`: cross-platform process launcher for FastAPI and Vite. The script starts both, prints both URLs, forwards Ctrl+C, and closes the process trees.
  - `scripts/seed.mjs`: invoke the backend seed module and preserve a nonzero exit code on failure.
  - `playwright.config.ts`: run the installed Chrome channel, fixed test ports, and an isolated test database.
  - `.gitignore`: ignore the runtime database, virtual environments, node modules, build output, screenshots, and test reports.
- Backend:
  - `backend/app/main.py`: FastAPI app, `/api` routers, startup database initialization, and static-serving behavior if used for one-command production-style preview.
  - `backend/app/config.py`: `ACCOUNTABLE_DB_PATH` default `data/accountable.db`; test databases override it.
  - `backend/app/db.py`: SQLAlchemy Core tables and SQLite foreign-key enforcement on every connection.
  - `backend/app/clock.py`: fixed local-time `today()` and `now()` boundaries for tests and seed data.
  - `backend/app/rules.py`: pure stage defaults, late/overdue checks, expected revenue, probability transitions, and card-position calculations.
  - `backend/app/schemas.py`: Pydantic request/response models and field-level validation.
  - `backend/app/seed.py`: deterministic relative-to-today sample data and reset entry point.
  - `backend/app/queries/`: Core read/write modules for organizations, contacts, deals, activities, timelines, pipeline, and dashboard.
  - `backend/app/routers/`: JSON routes for organizations, contacts, deals, activities, pipeline, dashboard, and health.
  - `backend/tests/`: pytest fixtures and unit/integration coverage.
- Frontend:
  - `frontend/package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`: React/TypeScript/Vite setup.
  - `frontend/src/main.tsx`, `App.tsx`: router, API query provider, toast provider, and top navigation shell.
  - `frontend/src/styles/`: brand tokens and global CSS.
  - `frontend/src/api/client.ts`: typed HTTP client; request methods, error mapping, and no domain repository classes.
  - `frontend/src/types.ts`: shared wire types only.
  - `frontend/src/lib/format.ts`: direct USD and local-date formatting functions. Extract stage or other domain logic only when a second feature actually uses it.
  - `frontend/src/components/ui/`: only cross-feature UI primitives.
  - `frontend/src/features/dashboard/`: Dashboard page, local components, API hooks, calculations, chart adapters, and tests.
  - `frontend/src/features/organizations/`: Organizations table, organization detail, forms, delete confirmation, API hooks, and tests.
  - `frontend/src/features/contacts/`: Contacts table/filter, contact detail, forms, delete confirmation, API hooks, and tests.
  - `frontend/src/features/deals/`: Deals table, deal detail, forms, delete impact, stage and probability UI, API hooks, and tests.
  - `frontend/src/features/pipeline/`: board, column, card, move/reorder UI, and tests.
  - `frontend/src/features/activities/`: activity form, timeline entries, follow-up UI, API hooks, and tests.
  - `frontend/src/**/*.test.tsx`: Vitest coverage.
- `e2e/`: Playwright fixtures and browser specifications.
- `docs/STATUS.md`: startup/reset instructions and implementation progress.
- Existing `docs/intent.md`, `docs/spec.md`, `docs/TECH_STACK.md`, and mockups remain source material. `README.md` remains unchanged unless a later course step explicitly requires it.

### Build contract

- The runtime database is SQLite at `data/accountable.db` by default.
- `npm run dev` starts the FastAPI API at `127.0.0.1:8000` and Vite at `127.0.0.1:5173`, with Vite proxying `/api` to the API. The script accepts optional `ACCOUNTABLE_API_PORT` and `ACCOUNTABLE_WEB_PORT` overrides but uses those defaults.
- `npm run seed` executes the backend seed module and replaces only the runtime database selected by `ACCOUNTABLE_DB_PATH`.
- `npm test` runs backend pytest, frontend Vitest, and Playwright against an isolated database. It does not start or reset the user's runtime database.
- API routes live below `/api`. The app sends and stores dates as ISO calendar strings and timestamps as ISO 8601 strings.
- Search uses a case-insensitive contains match on the fields named in `docs/spec.md`. Sort accepts only published sortable fields. Unknown sort fields return `422`.
- Every create/update/move/delete response includes enough data for the caller to update the relevant table or board without a second manual fetch.
- The one-person local build has no authentication, Supabase, Supabase MCP, background worker, or network service.

### Frontend folder rules

- Add code to an existing feature folder before creating a generic shared module.
- Share a component or helper only after two real call sites need the exact same behavior.
- Keep API hooks and domain-specific calculations beside their feature pages.
- Keep route composition in `App.tsx` or a small route module; do not introduce a routing framework beyond React Router if the MVP needs only named paths.
- Use React Query for server state and local component state for forms and dialogs. Do not add a Redux/Zustand store for this MVP.
- Use a mature table, chart, and drag-and-drop dependency instead of recreating them.
- Put only brand layout styles and global resets in global CSS. Let feature components own feature-specific layout styles.
- Before adding a new abstraction, a future engineer must be able to point to two current call sites or a real persistence migration boundary.

### API contract

| Method and route | Request | Success response |
|---|---|---|
| `GET /api/health` | none | `{ "status": "ok" }` |
| `GET /api/organizations` | `q`, `sort`, `direction` | organization rows with contact/deal counts |
| `POST /api/organizations` | name, optional website, industry, notes | created organization |
| `GET /api/organizations/{id}` | none | organization with linked contacts and deals |
| `PUT /api/organizations/{id}` | organization fields | updated organization |
| `DELETE /api/organizations/{id}` | none | `204`; linked-record delete is `409` with `{ "linked": { "contacts": [], "deals": [] } }` |
| `GET /api/contacts` | `q`, `sort`, `direction`, `status` | contact rows with organization names |
| `POST /api/contacts` | name, optional email/phone/job title/organization, required status | created contact |
| `GET /api/contacts/{id}` | none | contact with organization, linked deals, and newest-first timeline |
| `PUT /api/contacts/{id}` | contact fields | updated contact |
| `DELETE /api/contacts/{id}` | none | `204`; response preview states cleared deal main-contact and activity links |
| `GET /api/deals` | `q`, `sort`, `direction`, `stage` | deal rows with organization/main-contact names |
| `POST /api/deals` | name, organization, optional main contact, stage, value, probability, close dates | created deal |
| `GET /api/deals/{id}` | none | deal with organization/main contact and newest-first timeline |
| `PUT /api/deals/{id}` | deal fields | updated deal without an unrequested stage/probability change |
| `DELETE /api/deals/{id}` | none | `204`; blocked by none, with linked activity count in its preview |
| `GET /api/activities` | optional `contact_id`, `deal_id` | matching activities newest first |
| `POST /api/activities` | type, description, happened_at, optional follow-up date/done, optional contact/deal IDs | created activity |
| `PUT /api/activities/{id}` | activity fields and optional contact/deal IDs | updated activity |
| `DELETE /api/activities/{id}` | none | `204` |
| `GET /api/pipeline` | none | six fixed stages, cards, card counts, column totals, board totals |
| `POST /api/deals/{id}/move` | `{ "stage": "...", "position": 0 }` | moved deal, pipeline board, and resulting stage-change entry |
| `GET /api/dashboard` | none | headline metrics, 12 monthly revenue rows, funnel, recent activity, and pending follow-ups |

Create/update validation returns `422` with a field-keyed `detail` array. Missing resources return `404`. Invalid stage, status, probability outside `0..100`, and unknown sort direction return `422`. No route accepts `Lost` or `Won` probability changes that replace a manual probability.

The frontend treats `sort=field` and `direction=asc|desc`; sort field names are API field names, not display labels. Search parameter `q` is an empty string by default. Status filter is `all`, `lead`, `qualified`, or `customer`. Stage filter is one of the six fixed stage values or `all`.

### Seed contract

- The seed is deterministic relative to a fixed local date during tests and relative to actual local today during normal reset.
- It creates at least six organizations, 12 contacts spanning Lead/Qualified/Customer, 18 deals spanning all stages, 10 activities, and follow-ups overdue/today/future/done.
- Won/Lost deals are spread across the latest 12 calendar months. Open deals include several expected-close dates before today and several in future months.
- The seed creates all required organization, contact, deal, activity, and stage-change rows in one transaction.
- `npm run seed` asks for no confirmation and is explicitly a destructive reset for the local runtime database.
- Startup with a missing database creates and seeds a new database. Startup with an existing database never reseeds or replaces records.

### Data model

- `organizations`: `id`, `name`, `website`, `industry`, `notes`, timestamps.
- `contacts`: `id`, `name`, `email`, `phone`, `job_title`, `organization_id`, `status`, timestamps.
- `deals`: `id`, `name`, `organization_id`, `main_contact_id`, `stage`, `value_usd`, `probability`, `probability_source` (`derived` or `manual`), `expected_close_date`, `actual_close_date`, `position`, timestamps.
- `activities`: `id`, `type`, `description`, `happened_at`, `follow_up_date`, `done`, timestamps.
- `activity_contacts`: activity-to-contact links.
- `activity_deals`: activity-to-deal links.
- Stage-change entries are stored read-only in the activity timeline model with system type `stage_change`, from-stage, to-stage, timestamp, and deal link.

The database enables SQLite foreign keys on every connection. No raw SQL is used. `activity_contacts` and `activity_deals` are association tables with application-level validation that every activity has at least one link. The database cannot independently enforce “at least one” across two tables, so this invariant is enforced in one backend transaction and tested. Organization deletion is blocked while linked contacts or deals exist. Contact deletion nulls deal main-contact and activity-contact links while keeping the deals and activities. Deal deletion removes linked activity rows and stage-change rows. Deletion of an activity removes only that activity and its follow-up.

## Order of work

Work is split into independent, committable phases. Each phase proves its own behavior before the next phase adds another surface.

### Phase 1: Project and data foundation

- Add the npm workspace and cross-platform scripts: `npm run dev`, `npm test`, and `npm run seed`.
- Set up the Python 3.12 environment with FastAPI, uv, SQLAlchemy Core, SQLite, and pytest.
- Create the database tables for organizations, contacts, deals, activities, deal stage positions, and activity relationships.
- Implement database initialization and deterministic sample seeding for every stage, status, 12-month data range, late deal, and follow-up state.
- Implement validation and the reset command as separate tested operations.
- Use SQLAlchemy Core migrations or a tested schema-create function; do not add an ORM or migration framework.
- Do not build frontend pages yet. The only frontend proof is a health/loading shell that calls `/api/health`.

**Done when:** a fresh clone installs dependencies, `npm run dev` starts both processes and opens the shell, `GET /api/health` succeeds, `npm run seed` creates data, and backend reset tests pass.

### Phase 2: Backend resources and relationships

- Add JSON CRUD for organizations, contacts, and deals with search and sorting.
- Implement contact status filtering and organization/detail relationship reads.
- Enforce organization deletion blocking and the confirmed contact/deal deletion behavior.
- Add activity create, read, update, and delete, with at least one contact or deal link required.
- Add system-generated, immutable stage-change entries and newest-first timeline reads.
- Expose probability source state and apply stage-default or manual-probability rules during create and stage changes.
- Return delete-impact data for each record: organization lists linked contacts/deals; contact lists cleared main-contact/deal/activity links; deal lists the linked activity count.
- Use `422` for validation, `404` for missing records, `409` for blocked deletion or an invalid last activity link, and `500` only for unexpected server failures.

**Done when:** every resource route passes create/read/update/delete tests and relationship rules, and the API can serve all detail and timeline reads needed by later phases.

### Phase 3: Pipeline behavior

- Implement the fixed six-stage board read and explicit card-position storage.
- Add transactional cross-column moves and in-column reordering.
- Update stage-derived probability on stage change while preserving manual probability.
- Recalculate column and board value and expected revenue after each move.
- Add "Create deal in selected column" behavior with the stage preselected.
- Add keyboard and menu alternatives to pointer drag-and-drop.
- Provide `GET /api/pipeline` and `POST /api/deals/{id}/move` with `{stage, position}`. The move endpoint renumbers only the source and target positions and returns the affected deal plus board totals.
- Add one stage-change entry inside the same transaction as a successful stage move. A reorder with no stage change does not create an entry.

**Done when:** card moves, reorder slots, stage defaults, manual probabilities, totals, and stage-change timeline entries pass isolated backend tests.

### Phase 4: Frontend shell and dashboard

- Build the React and Vite application shell with mockup 2's horizontal top navigation.
- Apply the brand colors, Instrument Sans, Instrument Serif, JetBrains Mono, spacing, and rounded white panel system.
- Build the mockup 2 "Sales cockpit": Midnight open-expected-revenue panel, 2×2 metric grid, won-revenue line chart, stage funnel, recent activity, and follow-up tasks.
- Calculate and display open pipeline, open expected revenue, monthly won revenue/deals, late deals, and pending follow-ups.
- Add local-date formatting and text/tooltip values for every chart.
- Add loading, empty, and error states that use plain, actionable language.
- Bundle the three brand fonts locally in `frontend/public/fonts/` or via an offline package. Do not rely on runtime Google Fonts requests.
- Use Recharts only for the real chart needs: won-revenue line and pipeline funnel. Do not add a second bar chart to mockup 2.
- Use a typed API client and React Query or equivalent. Dashboard calculations stay in `features/dashboard/`; they are not extracted into a generic `lib/`.

**Done when:** the Dashboard matches mockup 2 hierarchy and functions against seeded API data; Vitest covers every displayed calculation and chart bucket.

### Phase 5: Tables and record detail pages

- Build Organizations, Contacts, and Deals searchable, sortable tables with add, edit, and delete actions.
- Build organization, contact, and deal detail pages with their linked records.
- Add organization and deal deletion confirmations that state linked-record consequences.
- Build contact status filtering and late-deal emphasis.
- Build add/edit forms and inline validation for all four record types.
- Add activity and follow-up forms on contact and deal pages.
- Keep completed follow-ups in timelines and remove them from Dashboard tasks.
- Use TanStack Table or an equivalent mature table library. Each feature owns its table configuration. If collection size stays small, sort/filter locally; otherwise send `q`, `sort`, `direction`, and `status` parameters to the API.
- The organization detail page lists linked contacts/deals. The contact detail page lists organization, linked deals, and timeline. The deal detail page lists organization/main contact and timeline.

**Done when:** CRUD, status filtering, detail relationships, delete consequences, and activity/follow-up forms pass frontend and Playwright tests.

### Phase 6: Pipeline UI and interaction

- Build the six-column horizontal board and column totals.
- Render cards with organization, value, probability, and late state.
- Use a maintained drag-and-drop library for cross-column moves and exact in-column drops.
- Update card, column, and board totals from the server response, with rollback on failure.
- Add board-level add-deal actions and stage preselection.
- Add the alternative move/reorder control required for keyboard users.
- Use dnd-kit or an equivalent maintained drag-and-drop library.
- Queue one move at a time. After success, apply the server response; after failure, refetch pipeline state and show a concise error toast.
- The card move menu offers each fixed stage and an exact position option at the start, end, or existing position list.

**Done when:** pointer dragging and the alternative move/reorder control produce the same API call, totals, and persisted position.

### Phase 7: End-to-end integration and visual verification

- Start frontend and backend together for Playwright tests and use an isolated test database.
- Add end-to-end journeys for CRUD, persistence, pipeline drag and reorder, activities, follow-ups, timelines, and seed reset.
- Check the selected mockup 2 layout at desktop widths and verify the real app against its hierarchy and brand.
- Run the complete test suite and fix browser-console errors or visual deviations.
- Document the final startup and reset commands in `docs/STATUS.md`.
- Run Playwright with one worker until suite stability is proven. The optional parallel mode belongs later and is not required for MVP completion.
- Fail every browser test on any browser console error or failed local API request.
- Capture the final app at 1440×1000 and 1024×768, comparing composition with mockup 2 rather than the other mockups.

**Done when:** `npm test` passes, screenshots and manual walkthrough meet mockup 2 and the brand, and no browser console or local API errors remain.

## Risks

- **Riskiest step: Pipeline transactions and position persistence (Phase 3, followed by Phase 6).** It combines probability semantics, source/target renumbering, stage timeline creation, totals, UI optimistic state, and drag accessibility. A staged move may partially succeed if transaction boundaries are wrong. Mitigation: use one backend transaction, make move idempotent only as documented in tests, return the complete server board state, and prove exact cross/in-column drops before frontend styling begins.
- **Could break: Probability semantics.** Reusing stage move for a non-stage edit could overwrite manual/derived state. Mitigation: only `move` changes probability by stage; ordinary deal update preserves `probability_source`; tests cover both manual and derived values.
- **Could break: Pipeline ordering.** Cross-column and in-column moves can leave duplicate or negative positions. Mitigation: represent position as a zero-based integer, renumber source and target columns after each committed move, and add a database unique constraint on `(stage, position)` if it can be enforced through upserts.
- **Could break: Deletion semantics.** SQLite foreign key or null behavior could delete or retain the wrong records. Mitigation: set foreign keys on every connection and encode each confirmed delete rule in backend tests before UI work.
- **Could break: Dashboard correctness.** UTC parsing and local “today” can shift a month or overdue date. Mitigation: use one `clock.py` boundary, compare ISO local dates, and use fixed-date fixtures.
- **Could break: Selected layout fidelity.** Mockup 2 could regress into a left-sidebar or unrelated card layout. Mitigation: keep the horizontal top bar and 2×2 + wide/Midnight + three-column hierarchy in one shell-level component.
- **Could break: Offline startup.** Dependency installation or fonts could require network access after setup. Mitigation: `npm run dev` expects dependencies already present, packages fonts locally, and the app makes no external runtime requests.
- **Could break: Accessibility.** Pointer-only dragging would violate the interaction requirement. Mitigation: ship a move-position control and keyboard activation that call the same API operation.
- **Could break: Test isolation.** Tests could seed or migrate the personal database. Mitigation: separate `ACCOUNTABLE_DB_PATH`, temporary pytest database, and dedicated Playwright database/ports.
- **Could break: Optimistic UI totals.** A stale board or out-of-order request could show incorrect values. Mitigation: queue moves, apply only the server response, refetch on failure, and display no success toast until persistence succeeds.
- **Could break: Course repository scope.** Large architectural choices or README edits could interfere with the course. Mitigation: keep implementation in root application folders and update only `docs/STATUS.md` unless later course work explicitly says otherwise.

## Decisions and rejected alternatives

- **Implemented:** a single local SQLite database with SQLAlchemy Core and no Supabase or authentication.
- **Rejected:** dark mode, mobile layout, sign-in, multi-user data, audit attribution, external integrations, custom fields, tags, import/export, and extra reports.
- **Rejected:** editing pipeline stages or using a configurable stage model. Stage names and order stay fixed in code and database checks.
- **Rejected:** per-user or per-record deletion cascades invented for organizations. Deletion blocks at organization level, then uses the explicit contact/deal rules.
- **Rejected:** editing a stage change entry or storing it as a normal user-created activity. Stage changes are server-generated, read-only timeline rows.
- **Rejected:** a separate bar chart on Dashboard. Mockup 2 is the chosen design and uses a won-revenue line, pipeline funnel, and metric panels.
- **Rejected:** a left rail. The implementation uses mockup 2's horizontal top navigation.
- **Rejected:** handmade drag-and-drop, table, and chart primitives. Use dnd-kit or a maintained equivalent, TanStack Table or equivalent, and Recharts.
- **Rejected:** speculative frontend helpers and generic domain frameworks. Feature folders and direct components keep the MVP easy to change.
- **Rejected:** raw SQL, SQLAlchemy ORM models, and repository/service abstraction unless a real cycle requires it. SQLAlchemy Core modules are sufficient for this local MVP.
- **Rejected:** a server-side sample snapshot per browser. One runtime SQLite database is the source of truth; tests receive isolated databases.

## Proof

### Backend unit and integration tests

- Seed creates realistic organizations, contacts, deals, activities, and follow-ups across all required states.
- Seed/reset replaces database data and does not affect a test database.
- Organization CRUD validates required fields and blocks delete when contacts or deals remain.
- Contact CRUD validates status and filters by All, Lead, Qualified, and Customer.
- Deleting a contact clears deal main-contact links and activity contact links while keeping deals and activities.
- Deal CRUD validates organization, stage, value, probability, and close dates.
- Each stage has the confirmed default probability: 10%, 25%, 50%, 75%, 100%, or 0%.
- A manual probability survives stage changes and non-stage edits; a derived probability changes to the target stage default.
- Deleting a deal removes all linked activities.
- Activity validation requires at least one contact or deal and permits both links.
- Activity edit can move or remove a link only while at least one valid link remains.
- Activity and stage-change timelines are newest first.
- Follow-up completion leaves the timeline entry and removes it from pending Dashboard tasks.
- Cross-column moves apply stage, probability, and card position transactionally.
- In-column reorder persists exact drop position across reads.
- Column totals, board open totals, and expected revenue match stored deal values and probabilities.
- Dashboard line-chart months cover the latest 12 local calendar months, including zero-value months.
- Won revenue and won deal count reflect close date and stage.
- Late deals use expected close date before today.
- Recent activity contains the latest 10 entries and a single entry per stage change.
- Deletion, validation, and not-found responses use the expected HTTP status and consequence details.

### Frontend unit tests

- Stage probability defaults and manual-probability preservation work on create and stage change.
- Search and sorting are correct for organizations, contacts, and deals.
- Contact status filtering includes every confirmed status and All.
- Late-deal formatting adds overdue text and Raspberry emphasis.
- Dashboard open pipeline and expected-revenue calculations match deal data.
- Monthly won-revenue grouping includes exactly 12 local calendar months and zero-filled periods.
- Overdue versus upcoming follow-ups use follow-up date, local today, and done state correctly.
- Activity timeline ordering is newest first and completed follow-ups remain visible.
- Deleting or editing records renders the specified confirmation or cleared-link behavior.
- Mockup 2 shell components expose brand colors, local date context, navigation, and the primary metric hierarchy.

### End-to-end tests

- `npm run dev` starts both services and the first browser page is a populated mockup 2 Dashboard.
- Organization, contact, and deal add/edit/delete flows work in real Chrome.
- Organization delete is blocked until linked records are deleted or reassigned.
- Tables search and sort, and contact status filtering works.
- Contact and deal detail pages show linked records and timelines.
- Pipeline card drag changes stage, updates totals, and applies or preserves probability.
- Pipeline card reorder within a column persists after refresh and restart.
- A deal created in a column starts in that stage and appears in the correct position.
- Late deals are visible in deal tables and pipeline cards.
- Activity creation, editing, and deletion persist and appear newest first.
- Activities may link to both a contact and a deal.
- Stage moves create one timeline entry and one Dashboard recent-activity entry.
- Follow-up creation appears in Dashboard upcoming or overdue tasks until marked done.
- Marking a follow-up done removes it from Dashboard tasks and keeps it in the timeline.
- Refresh and application restart preserve every successful change.
- `npm run seed` restores the original sample dataset.
- Every exercised page is checked at the 1024 px minimum and standard desktop sizes.
- Playwright exercises no console errors and reports none on the final browser run.

### Manual proof

- A non-technical person starts Accountable with one documented command and reaches populated sample data.
- A salesperson completes CRM CRUD, detail navigation, pipeline movement, activity logging, follow-up completion, refresh, restart, and seed reset.
- The person checks each screen visually against mockup 2 and the brand.
- The browser console remains free of errors through the full workflow.
