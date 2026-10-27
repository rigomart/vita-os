-- Thread Notes are never completed (ADR 0049). Step two of retiring
-- thread_notes.state and completed_at: the API serving since 0009 names
-- neither, and 0009 left no CHECK, index, view or trigger on them, so both
-- drop in place. Every other value stays as it was saved.

ALTER TABLE thread_notes DROP COLUMN state;
ALTER TABLE thread_notes DROP COLUMN completed_at;
