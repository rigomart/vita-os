-- Thread Notes are never completed (ADR 0049). Step one of retiring
-- thread_notes.state and completed_at: give state a default of 'open' and drop
-- its CHECK and indexes, so a later migration can drop both columns. The
-- columns and their values stay because the API serving during this deployment
-- still uses them. SQLite cannot change a default or drop a CHECK in place, so
-- the table is rebuilt.

CREATE TABLE thread_notes_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  state TEXT DEFAULT 'open' NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO thread_notes_new (
  id, user_id, thread_id, body, state, completed_at, created_at, updated_at
)
SELECT
  id, user_id, thread_id, body, state, completed_at, created_at, updated_at
FROM thread_notes;

DROP TABLE thread_notes;

ALTER TABLE thread_notes_new RENAME TO thread_notes;

CREATE INDEX thread_notes_by_owner_thread_created
  ON thread_notes (user_id, thread_id, created_at DESC, id DESC);
