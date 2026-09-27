-- Next Move and Up Next become peer Moves with an optional Focus (issue 366,
-- ADR 0022).
--
-- A Thread's Moves are one JSON array of {id, text} in capture order, and the
-- Focused Move is named by ID. Existing Threads convert without visibly
-- changing: the Next Move becomes the first Move and is focused, and each Up
-- Next move follows, unfocused, in queue order. Every Move gets a new ID.
-- Threads with neither — resolved ones included — get no Moves and no focus.
-- Activity Log entries are left exactly as they were written.

ALTER TABLE threads ADD COLUMN moves_json TEXT
  CHECK (moves_json IS NULL OR json_valid(moves_json));
ALTER TABLE threads ADD COLUMN focused_move_id TEXT;

UPDATE threads
SET focused_move_id = lower(hex(randomblob(16)))
WHERE next_move IS NOT NULL;

UPDATE threads
SET moves_json = (
  SELECT json_group_array(json_object('id', move.id, 'text', move.text))
  FROM (
    SELECT threads.focused_move_id AS id, threads.next_move AS text,
           -1 AS position
    WHERE threads.next_move IS NOT NULL
    UNION ALL
    SELECT lower(hex(randomblob(16))), queued.value, queued.key
    FROM json_each(threads.up_next_json) AS queued
    ORDER BY position
  ) AS move
)
WHERE next_move IS NOT NULL OR up_next_json IS NOT NULL;

ALTER TABLE threads DROP COLUMN next_move;
ALTER TABLE threads DROP COLUMN up_next_json;

-- The Activity Log learns the `move_completed` type. SQLite cannot change a
-- CHECK constraint in place, so the table is rebuilt. It has no children, so
-- dropping the old table deletes nothing but itself.

CREATE TABLE activity_log_entries_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('area_move', 'next_move_change', 'move_completed', 'state_change', 'follow_up_change')),
  content TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at INTEGER NOT NULL
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
