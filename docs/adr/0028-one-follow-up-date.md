# One Follow-up date for Threads and standalone Notes

**Status:** Accepted
**Date:** 2026-10-01

Threads called their resurfacing date a Follow-up, while standalone Notes called the same signal an Attention Date. Both already share the Dashboard's time columns and the date-and-time picker. Two names suggest different behavior where there is one user intention: return to this around a chosen date.

## Decision

Use **Follow-up date** on both Threads and standalone Notes. Controls use “Set follow-up date”, “Change follow-up date”, and “Clear follow-up date”, with the same calendar-and-clock icon. The shared picker explains: “Bring this back into view around this date.”

Both models and their commands use `followUp`. The date remains optional. Its day determines Dashboard placement; its optional time orders items within that day. It is a soft resurfacing point, with no deadline or notification. Reading content does not clear it.

Keep the content-specific rules: Thread Notes have no independent Follow-up date; changes to a Thread's date enter its Activity Log; resolving a Thread clears its date, and reopening does not restore it. Done Notes retain their date, and reopening uses that saved date. No new Note Activity Log is introduced.

The Note API uses `followUp` and `/v1/notes/:noteId/follow-up`. It temporarily accepts the former `attentionDate` field and `/attention-date` route, and returns the former response field alongside `followUp`, because the API deploys before the web app and existing browser sessions may keep running the previous client. Supplying both request fields is rejected as ambiguous.

The existing D1 `notes.attention_date` column and historical migration files stay intact. Mapping that column to `followUp` preserves every saved timestamp without a data migration. Historical Activity Log entries keep their wording and `follow_up_change` type.

## Consequences

- Replaces the separate Follow-up and Attention Date glossary entries with one Follow-up date.
- Amends the terminology in ADRs 0016, 0017, and 0027; their ownership, grouping, and time behavior remain in effect.
- Future date controls share their labels and explanation rather than choosing names per content type.
- Removing the compatibility API names is a separate change after older clients no longer need them.
