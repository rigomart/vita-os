# Inbox item processing redesign

Processing an Item now exclusively means consuming it into a Project (as a note, next action, or new Project). Adding a date, editing text, completing, and discarding are inline row actions — not part of processing. The process dialog uses a continuous search-based flow instead of tabs, and all Items live in a single Inbox view regardless of date or completion status.

## Considered Options

- **Tabs vs. continuous flow for processing**: Tabs presented all options equally but required extra clicks when the user already knew their target Project. The search-based flow lets users find by Project or Area name and narrows the choices dynamically.
- **add_date as processing vs. inline row action**: Making date a processing step mixed a lightweight edit (which keeps the Item) with heavy actions (which delete it). Inline row editing keeps the distinction clean.
- **Separate /completed route vs. collapsible section in Inbox**: Two routes for the same entity created navigation overhead. A collapsible section keeps all Items in one place while still deprioritizing completed ones.

## Consequences

- All Items appear in a single `items.list` query; `items.listCompleted` is removed.
- The `/completed` route and sidebar entry are removed.
- The process dialog is now a Project search + selection flow, fetching areas/projects lazily on open.
- Item rows use a two-row layout: actions on top, metadata on bottom.