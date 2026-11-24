# Accountable MVP Specification

## Concerns

- The intent leaves the exact dashboard layout and chart types free. This spec chooses a restrained desktop layout and assigns a clear purpose to each visualization.
- Organization deletion is intentionally blocked when linked records exist; the UI must name the blockers and offer edit/reassignment paths rather than silently cascading.
- Close probability can be set manually, so moving a stage must distinguish a manual probability from the stage default. The API must preserve manual values until the next stage change.
- The pipeline needs stable card ordering, including moves within one column. The implementation must persist an explicit position per stage and update it transactionally.
- Activities may be linked to a contact, a deal, or both. Delete confirmation and timeline queries must account for both links.
- The dashboard's 12-month revenue and activity ranges need a timezone and calendar definition. This spec uses the user's local calendar month and local dates, not UTC dates.

## Product design

### Purpose and audience

Accountable is a private, local CRM for one salesperson. The interface prioritizes fast scanning, record lookup, and clear next actions rather than reporting depth or account-team collaboration.

### Visual direction

- Light mode only, for laptop and desktop viewports.
- Base surface: `#F0F4F5`; panels: white.
- Ink: Midnight `#073B4C`.
- Actions and positive values: Sea Green `#06D6A0`, with a sufficiently dark text treatment.
- Secondary emphasis: Marigold `#FFC145`; risk and overdue state: Raspberry `#EF476F`.
- Supporting categories and charts: Coral `#F78C6B`, Cerulean `#118AB2`, then the remaining brand colors.
- Headings and body: Instrument Sans. Quotes or short accent copy: Instrument Serif. Data, IDs, dates in compact numeric contexts: JetBrains Mono.
- Fonts load locally or from Google Fonts only as a product asset; the app remains usable if the network is unavailable by providing system fallbacks.
- Panels use rounded corners and no outlines. Separate sections through spacing, surface color, and content hierarchy rather than edge borders.
- Keep Sea Green and Marigold text darkened for contrast on light surfaces. Raspberry remains reserved for errors and overdue states.

### Navigation and page frame

- A fixed left sidebar is the primary navigation for Dashboard, Organizations, Contacts, Deals, and Pipeline.
- The sidebar shows the Accountable name and a compact active indicator. Page headings use Instrument Sans with a clear add/action button on the right.
- Main content sits on the pale page background with 24-32 px gutters. Desktop density stays information-rich without reducing touch targets.
- Show concise toast confirmation for create, update, delete, stage move, follow-up completion, and seed reset.
- Use modal dialogs for add/edit forms and destructive confirmations. Record-detail pages use a full page layout rather than nested drawers.

## Global behavior

### Tables

Organizations, Contacts, and Deals use searchable, sortable tables.

- A text search box filters visible rows by display-name and key identifying fields:
  - Organizations: name, website, industry
  - Contacts: name, email, phone, organization name
  - Deals: name, organization name, contact name
- Clicking a column heading toggles ascending/descending. Show a clear sort indicator. Default sorting is record name ascending.
- Every table includes a primary Add button and edit/delete actions on each row.
- Search and sort happen in the frontend against the API's returned collection, unless collection size requires server-side query parameters. The API contract should support `search`, `sort`, and `direction` for predictable growth.
- Edit opens the record form prefilled. Save updates the record and returns to the table or detail view.
- Empty search results show a direct "Clear search" action.
- Delete asks for confirmation and states every linked record that will change or prevents deletion.

### Forms

- Required fields are marked and validated inline.
- Submit uses the record action name: "Create organization," "Save changes," "Create contact," "Save deal," or "Save activity."
- Closing an unsaved form does not persist changes.
- Organization, contact, and deal selectors show searchable options with clear names.
- Dates use the browser's local date format and are stored as ISO dates.
- Money is entered and stored in US dollars. Display always includes `$`, such as `$125,000`.

### Persistence

- FastAPI serves the React application and JSON API.
- SQLite stores all records, relationships, stage positions, and activity metadata.
- SQLAlchemy Core operations manage all database access; no raw SQL is used.
- Every successful create, update, delete, stage move, card reorder, and follow-up change persists immediately.
- The database is initialized with sample data only when it is new.
- `npm run dev` starts frontend and backend with no internet requirement.
- `npm run seed` replaces the database data with a fresh sample dataset.
- Tests use isolated databases and never alter user data.

## Dashboard

The Dashboard is the default route and the first screen after startup.

### Layout

Use a 12-column desktop grid:

1. The top row has open pipeline value and expected revenue as paired headline metrics.
2. The next row has won deal count and won revenue for the current and previous month.
3. The largest visualization is a 12-month line chart of won revenue.
4. A bar chart shows deal count or revenue by stage for the open pipeline.
5. A compact pipeline funnel shows value remaining after each stage.
6. Recent activity and follow-up tasks occupy the lower two columns.

No visualization is decorative. Every chart has a direct data value in a tooltip or legend. A user can navigate from a recent stage-change or deal activity to the relevant deal.

### Metrics

- Open pipeline: sum of `value` for deals in New, Qualified, Proposal, and Negotiation.
- Open expected revenue: sum of `value * probability / 100` for those four stages.
- Won revenue: sum of deal value for Won deals closed in the selected month.
- Won deals: count of Won deals closed in the selected month.
- Revenue and won-deal charts cover the most recent 12 calendar months in the user's local timezone.
- Each stage bar displays open deal count and total value.
- Late deals are open deals with an expected close date before today.

### Charts

- Use Recharts or an equivalent maintained chart library.
- The line chart shows monthly won revenue, one point per month.
- The bar chart shows open pipeline value by stage; stage colors follow Sea Green, Marigold, Coral, and Cerulean.
- The funnel uses a stage sequence from New through Won and is a non-interactive visual summary. It shows total value, expected revenue, or deal count consistently across the stages.
- Empty periods show a zero value and still keep the month label visible.

### Recent activity

- Show the most recent 10 meaningful activity records and deal stage changes.
- Newest entries come first.
- Group data into one entry per stage-change event. Do not also expose an underlying activity row for the stage move.
- Entry content includes type/icon, related record name, description, and timestamp.
- Stage changes and activity records navigate to the related deal or contact when possible.

### Follow-ups

- Show pending follow-up activities on the Dashboard.
- Separate overdue follow-ups from upcoming follow-ups.
- An overdue follow-up has a follow-up date before today. A follow-up due today is upcoming.
- Sort overdue entries by oldest first and upcoming entries by soonest first.
- Each entry shows the activity description, linked contact/deal name, and follow-up date.
- Mark done updates the activity immediately, removes it from the Dashboard, and leaves it in the source timeline as a completed activity.

## Organizations

### Fields

- Name: required, text
- Website: optional, text or URL
- Industry: optional, text
- Notes: optional, multiline text

### Table

Columns include Name, Industry, Contact count, Deal count, and actions.

### Detail page

Show organization details, edit/delete actions, linked contacts, and linked deals.

- Contacts and deals are links to their detail pages.
- Delete is disabled or rejected with a confirmation that lists the linked contacts and deals.
- The user must delete or reassign each linked contact and deal before organization deletion succeeds.

## Contacts

### Fields

- Name: required, text
- Email: optional, email
- Phone: optional, text
- Job title: optional, text
- Organization: optional
- Status: required, one of Lead, Qualified, Customer

### Table

Columns include Name, Status, Organization, Email, Phone, and actions.

- A status filter provides All, Lead, Qualified, and Customer.
- Default sort is Name ascending.
- Status uses a restrained text badge: Lead in Cerulean, Qualified in Marigold, Customer in Sea Green.

### Detail page

Show contact details and linked organization.

- The page includes linked deals and a newest-first timeline of activities.
- Activities may be logged here.
- Deleting a contact keeps its linked deals and activities. The contact link and main-contact link are cleared. The organization link is retained.
- The confirmation states these consequences before deletion.

## Deals

### Fields

- Name: required, text
- Organization: required
- Main contact: optional
- Stage: required, one of New, Qualified, Proposal, Negotiation, Won, Lost
- Value: required, numeric USD
- Probability: optional numeric from 0 to 100 percent
- Expected close date: optional
- Actual close date: optional

The organization and main contact may be changed by editing the deal.

### Stage probabilities

- New: 10%
- Qualified: 25%
- Proposal: 50%
- Negotiation: 75%
- Won: 100%
- Lost: 0%

Stage changes automatically apply the new stage default unless the deal's probability has been manually set. A manual probability remains unchanged when related non-stage fields are edited.

The API must expose whether a probability is manual or stage-derived. For a new deal:

- If probability is omitted, use the stage default.
- If probability is supplied, store it as manual.
- If stage is changed, replace a stage-derived probability with the target stage default.
- If stage is changed, preserve a manual probability.
- Moving to Won or Lost does not erase a manual probability.

### Table

Columns include Name, Organization, Main contact, Stage, Value, Probability, Close date, and actions.

- Late deals are open deals with an expected close date before today. Highlight the close date with Raspberry text and an overdue label.
- Search includes deal name and linked organization/contact names.

### Detail page

Show deal details, organization, main contact, and newest-first timeline.

- The timeline includes activities and stage-change entries.
- Logging an activity here links it to the deal and optionally the main contact.
- Deleting a deal deletes the deal and all activities linked to it.
- The confirmation names the activity count that will be deleted.

## Pipeline

### Board layout

- Six columns in fixed stage order: New, Qualified, Proposal, Negotiation, Won, Lost.
- On desktop, the board may scroll horizontally if all columns cannot fit at the target viewport width.
- Each column shows open or won/lost status and a card count.
- Column header shows:
  - Total value for deals in that stage
  - Expected revenue for deals in that stage
- Board header shows totals and expected revenue for open deals only.
- Won and Lost cards remain in their columns and contribute to their column value but not open pipeline totals.

### Card behavior

- Each card shows deal name, organization, value, probability, and late state.
- A late card uses a Raspberry label or date accent and retains it in each stage.
- Dragging across columns changes stage and applies or preserves probability according to the deal rules.
- Dragging within a column changes its explicit position.
- Dropping anywhere in a column, including before or after the current card, persists that exact position.
- A card can return to an earlier or later position after refresh.
- Stage totals and board totals update optimistically only after a successful API response? No: update immediately from the server-verified response, with rollback on failure.
- Concurrent edits use the latest server state rather than stale card order.

### Add deal

- Each column has an Add deal action.
- The form opens with the column's stage preselected.
- Create persists the deal and inserts it at the bottom of the target stage until the user reorders it.

## Activities

### Fields

- Type: Note, Call, Email
- Description: required, multiline text
- Happened at: required local date/time
- Follow-up date: optional local date
- Done: required internally, default false
- Contact: optional
- Deal: optional
- At least one of Contact or Deal must be selected.

### Create and edit

- "Add activity" is available on contact and deal detail pages.
- If launched from a contact, preselect that contact.
- If launched from a deal, preselect that deal.
- The form may allow both links.
- Editing an activity may change or remove one of its links if at least one remains.
- Timestamp is a local date/time shown in the timeline; storage is ISO 8601.
- Deleting an activity removes it and all follow-up visibility for it.
- A stage-change entry is system generated and not editable or deletable.

### Timeline

- Show activities and stage changes newest first.
- For a contact, include activities linked directly to the contact.
- For a deal, include activities linked directly to the deal and stage-change entries.
- Completed follow-ups remain visible in the timeline and display a Done state.
- Pending follow-ups display their due date and Due/Overdue state.

## Data relationships

```text
Organization 1 ─── many ─── Contact
Organization 1 ─── many ─── Deal
Contact 0 or 1 ─── many ─── Deal (main contact)
Contact 0 or many ─── many ─── Activity
Deal 0 or many ─── many ─── Activity
```

- One organization may have many contacts and deals.
- One contact may be the main contact for many deals.
- One activity may relate to both one contact and one deal.
- An activity may not exist with no contact and no deal.

### Delete rules

| Record | Behavior |
|---|---|
| Organization | Block deletion while contacts or deals are linked |
| Contact | Delete contact; clear contact links on deals and activities; keep deals and activities |
| Deal | Delete deal and all activities linked to it |
| Activity | Delete activity only |

## API requirements

The backend exposes JSON resources for organizations, contacts, deals, activities, pipeline order, dashboard summaries, and timeline data.

Minimum resource operations:

- Organizations: list/search/sort, create, read, update, delete
- Contacts: list/search/sort/filter, create, read, update, delete
- Deals: list/search/sort, create, read, update, delete
- Activities: create, read, update, delete
- Pipeline: read board, move/reorder deal
- Dashboard: read current summary, 12-month chart data, recent activity, follow-ups
- Seed: reset database to sample data

Validation and error responses use HTTP 4xx for invalid input or blocked deletion and HTTP 5xx only for unexpected server failures. Delete responses include linked-record consequences. Record updates return the updated resource and related derived fields needed by the UI.

## Sample data

The initial dataset must make every screen useful immediately:

- Organizations across at least six industries.
- Contacts representing Lead, Qualified, and Customer statuses.
- Deals representing all six stages.
- Won and Lost deals spread across the previous 12 months.
- Open deals expected to close across the coming months.
- Several open deals whose expected close date is before today.
- Activities linked to contacts and deals.
- Follow-ups due today, due soon, and overdue.
- Some completed follow-ups.

The seed must be deterministic enough for tests and visual checks while still feeling realistic.

## Responsiveness and accessibility

- The MVP targets laptop and desktop screens; a phone layout is not a requirement.
- The minimum supported viewport is 1024 px wide.
- The pipeline may horizontally scroll below the full board width.
- Interactive elements have visible keyboard focus.
- Forms, tables, dialogs, and chart summaries expose usable labels and text alternatives.
- Native button and form semantics take priority over custom controls.
- Drag-and-drop also provides a keyboard and menu-based way to move a deal to another stage or reorder it.
- Dialog focus is contained and restored to the invoking control after close.
- Use Raspberry only where contrast and meaning are clear; status also includes text, not only color.
- Respect reduced-motion preferences.

## Testing requirements

### Unit tests

- Frontend: Vitest covers stage probabilities, dashboard calculations, late-deal state, activity ordering, filtering, and deletion constraints.
- Backend: pytest covers validation, CRUD behavior, relationship rules, stage moves, manual probability preservation, card ordering, seed/reset, and dashboard aggregations.

### End-to-end tests

Playwright Test with installed Google Chrome covers:

- Starting the app and landing on the Dashboard.
- Organization, contact, and deal CRUD with search and sorting.
- Contact status filtering.
- Detail-page linked records and timelines.
- Dragging between pipeline stages and reordering within a column.
- Creating a deal directly in a selected pipeline column.
- Activity and follow-up creation, editing, deletion, and completion.
- Stage-change timeline and dashboard recent-activity entries.
- Persistence after browser refresh and application restart.
- Seed reset restores sample data.
- No browser-console errors on any exercised page.

## Acceptance checklist

- A non-technical user can start with `npm run dev` and reach a populated Dashboard.
- Data persists after refresh and restart.
- `npm run seed` restores the sample dataset.
- Organization, contact, and deal tables support search, sort, add, edit, delete confirmation, and the specified link behavior.
- Pipeline moves and reorders persist, and expected revenue updates immediately.
- Manual probability and stage-default probability rules behave correctly.
- Activities and stage changes appear newest first in timelines.
- Pending follow-ups appear as overdue/upcoming tasks; completed follow-ups remain only in timelines.
- The Dashboard totals and charts match stored data over the 12-month window.
- A person completes the main workflow in a real browser and confirms the visual quality and console state.
