-- The Activity Log tells when Tasks were added and removed (issue 526,
-- ADR 0053).
--
-- The log learns the `task_added` and `task_removed` types. Nothing else
-- changes: no column, no backfill. Tasks carry no creation time, so a past
-- Task's line would need an invented date.
--
-- SQLite cannot change a CHECK constraint in place, so the table is rebuilt,
-- as 0005 and 0010 did. It has no children, so dropping the old table deletes
-- nothing but itself. Every entry is copied as stored, every column included.
--
-- The API serving while this runs writes and reads only the types it knows,
-- all still allowed, and names the same columns.

CREATE TABLE activity_log_entries_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('area_move', 'next_move_change', 'move_completed', 'note_added', 'task_added', 'task_removed', 'state_change', 'follow_up_change')),
  content TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at INTEGER NOT NULL,
  thread_note_id TEXT
);

INSERT INTO activity_log_entries_new (
  id, user_id, thread_id, type, content, previous_value, new_value,
  created_at, thread_note_id
)
SELECT
  id, user_id, thread_id, type, content, previous_value, new_value,
  created_at, thread_note_id
FROM activity_log_entries;

DROP TABLE activity_log_entries;

ALTER TABLE activity_log_entries_new RENAME TO activity_log_entries;

CREATE INDEX activity_log_entries_by_owner_thread_time
  ON activity_log_entries (user_id, thread_id, created_at DESC, id DESC);
