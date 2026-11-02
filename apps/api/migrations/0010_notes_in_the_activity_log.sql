-- The Activity Log tells when Thread Notes were added (issue 525, ADR 0053).
--
-- The log learns the `note_added` type and a nullable `thread_note_id` naming
-- the Thread Note an entry is about. It holds no Note words: the line reads
-- the Note as it is now. It is not a foreign key, because the entry outlives
-- the Note.
--
-- SQLite cannot change a CHECK constraint in place, so the table is rebuilt,
-- as 0005 did. It has no children, so dropping the old table deletes nothing
-- but itself. Every existing entry is copied as stored, with no Note.
--
-- The API serving while this runs names only the columns it knows, so its
-- inserts leave `thread_note_id` NULL and its reads skip it.

CREATE TABLE activity_log_entries_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('area_move', 'next_move_change', 'move_completed', 'note_added', 'state_change', 'follow_up_change')),
  content TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at INTEGER NOT NULL,
  thread_note_id TEXT
);

INSERT INTO activity_log_entries_new (
  id, user_id, thread_id, type, content, previous_value, new_value, created_at
)
SELECT
  id, user_id, thread_id, type, content, previous_value, new_value, created_at
FROM activity_log_entries;

DROP TABLE activity_log_entries;

ALTER TABLE activity_log_entries_new RENAME TO activity_log_entries;

CREATE INDEX activity_log_entries_by_owner_thread_time
  ON activity_log_entries (user_id, thread_id, created_at DESC, id DESC);

-- Backfill, step one: a Note written while completing a Task was saved in the
-- same batch as the completion's entry, with the same timestamp, in the same
-- Thread. That completion entry carries it.

UPDATE activity_log_entries
SET thread_note_id = (
  SELECT thread_notes.id
  FROM thread_notes
  WHERE thread_notes.user_id = activity_log_entries.user_id
    AND thread_notes.thread_id = activity_log_entries.thread_id
    AND thread_notes.created_at = activity_log_entries.created_at
  ORDER BY thread_notes.id
  LIMIT 1
)
WHERE type = 'move_completed';

-- Step two: every other Thread Note gets one `note_added` entry at its
-- creation time.

INSERT INTO activity_log_entries (
  id, user_id, thread_id, type, content, previous_value, new_value,
  created_at, thread_note_id
)
SELECT
  lower(hex(randomblob(16))), user_id, thread_id, 'note_added', 'Note added',
  NULL, NULL, created_at, id
FROM thread_notes
WHERE id NOT IN (
  SELECT thread_note_id
  FROM activity_log_entries
  WHERE thread_note_id IS NOT NULL
);
