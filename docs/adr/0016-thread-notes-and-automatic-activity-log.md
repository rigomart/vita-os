# Thread Notes and an automatic Activity Log

Issue #315 separates prose from change history inside a Thread. Body-only Thread Notes have their own lifecycle and remain visible only on their parent Thread, while the Activity Log becomes a read-only list of changes the product records automatically. This keeps Notes editable without rewriting history and keeps the changelog trustworthy without turning ordinary Note edits into Thread activity.

## Migration

Existing hand-written Activity Log entries are copied into Thread Notes with their content and creation time intact, then removed from the log. Activity Log reads hide those legacy entries while the paginated migration is in progress. The compatibility `note` entry type remains in storage until the migration has run everywhere, but no public operation can write it.

## Activity

Capturing a Thread Note advances the Thread's last-activity timestamp without adding an Activity Log entry. Editing, completing, reopening, and deleting an existing Thread Note update only that Note. Thread Notes have no Attention Date because the parent Thread's Follow-up already provides resurfacing.
