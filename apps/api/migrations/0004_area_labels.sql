-- Areas become optional labels on Threads (issue 371, ADR 0021).
--
-- An Area loses its Condition and Standard, and a Thread's Area becomes
-- nullable. Every existing Thread keeps its Area.
--
-- SQLite cannot relax NOT NULL in place, so `threads` is rebuilt. D1 enforces
-- foreign keys, and dropping a parent table deletes its rows first, which
-- would cascade through `activity_log_entries` and `thread_notes` and wipe
-- every Thread's history. So the two child tables are rebuilt against the new
-- `threads` table before the old one is dropped. Renaming `threads_new` then
-- rewrites their references to `threads`.

PRAGMA defer_foreign_keys = on;

ALTER TABLE areas DROP COLUMN standard;
ALTER TABLE areas DROP COLUMN condition;

CREATE TABLE threads_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  area_id TEXT REFERENCES areas(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT,
  sort_order INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'resolved')),
  next_move TEXT,
  up_next_json TEXT CHECK (up_next_json IS NULL OR json_valid(up_next_json)),
  follow_up INTEGER,
  last_activity_at INTEGER,
  last_activity_content TEXT,
  created_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  last_change_token TEXT,
  UNIQUE (user_id, slug)
);

INSERT INTO threads_new (
  id, user_id, area_id, title, slug, summary, sort_order, state, next_move,
  up_next_json, follow_up, last_activity_at, last_activity_content,
  created_at, revision, last_change_token
)
SELECT
  id, user_id, area_id, title, slug, summary, sort_order, state, next_move,
  up_next_json, follow_up, last_activity_at, last_activity_content,
  created_at, revision, last_change_token
FROM threads;

CREATE TABLE activity_log_entries_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads_new(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('area_move', 'next_move_change', 'state_change', 'follow_up_change')),
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

CREATE TABLE thread_notes_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads_new(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'done')),
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

DROP TABLE activity_log_entries;
DROP TABLE thread_notes;
DROP TABLE threads;

ALTER TABLE threads_new RENAME TO threads;
ALTER TABLE activity_log_entries_new RENAME TO activity_log_entries;
ALTER TABLE thread_notes_new RENAME TO thread_notes;

CREATE INDEX threads_by_owner_state_order
  ON threads (user_id, state, sort_order, id);

CREATE INDEX threads_by_owner_area_state
  ON threads (user_id, area_id, state, created_at, id);

CREATE INDEX activity_log_entries_by_owner_thread_time
  ON activity_log_entries (user_id, thread_id, created_at DESC, id DESC);

CREATE INDEX thread_notes_by_owner_thread_state_created
  ON thread_notes (user_id, thread_id, state, created_at DESC, id DESC);

CREATE INDEX thread_notes_by_owner_thread_state_completed
  ON thread_notes (user_id, thread_id, state, completed_at DESC, id DESC);
