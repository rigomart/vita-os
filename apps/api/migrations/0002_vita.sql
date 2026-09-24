CREATE TABLE areas (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  standard TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('healthy', 'needs_attention', 'critical')),
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, slug)
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  area_id TEXT NOT NULL REFERENCES areas(id),
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
  last_completion_token TEXT,
  UNIQUE (user_id, slug)
);

CREATE TABLE activity_log_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('area_move', 'next_move_change', 'state_change', 'follow_up_change')),
  content TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX activity_log_entries_by_owner_thread_time
  ON activity_log_entries (user_id, thread_id, created_at DESC, id DESC);
