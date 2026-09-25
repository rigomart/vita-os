-- Standalone Notes and Thread Notes, under canonical names.
--
-- Standalone Notes were stored under the physical name `tasks` with
-- the body in a column called `text`; neither name survives here. The migration
-- importer translates that compatibility storage into these tables.

CREATE TABLE notes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  -- The Attention Date the user gave the Note, if any.
  attention_date INTEGER,
  state TEXT NOT NULL CHECK (state IN ('open', 'done')),
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Open Notes read newest first; Done Notes page by completion, newest first.
-- Both carry the owner first so a read never crosses accounts, and both end in
-- `id` so tied timestamps neither duplicate nor skip an entry across pages.
CREATE INDEX notes_by_owner_state_created
  ON notes (user_id, state, created_at DESC, id DESC);

CREATE INDEX notes_by_owner_state_completed
  ON notes (user_id, state, completed_at DESC, id DESC);

CREATE TABLE thread_notes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'done')),
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX thread_notes_by_owner_thread_state_created
  ON thread_notes (user_id, thread_id, state, created_at DESC, id DESC);

CREATE INDEX thread_notes_by_owner_thread_state_completed
  ON thread_notes (user_id, thread_id, state, completed_at DESC, id DESC);

-- Ownership-aware reads for the inventories that predate this migration.
CREATE INDEX areas_by_owner_order ON areas (user_id, sort_order, id);

CREATE INDEX threads_by_owner_state_order
  ON threads (user_id, state, sort_order, id);

CREATE INDEX threads_by_owner_area_state
  ON threads (user_id, area_id, state, created_at, id);

-- Canonical naming: the token stamped by the most recent Thread change guards
-- every Activity Log entry that change writes, not only a Next Move completion.
ALTER TABLE threads RENAME COLUMN last_completion_token TO last_change_token;
