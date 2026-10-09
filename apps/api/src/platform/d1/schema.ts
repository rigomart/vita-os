import type {
  ActivityLogEntry,
  AreaSummary,
  Note,
  Thread,
  ThreadNote,
} from "@vita-os/contracts";

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

// This models the product tables after migration 0007. Better Auth owns its
// separate schema. Keep timestamps as integer milliseconds and Tasks as text:
// the row adapters validate the stored JSON and map it to the domain.
export const areas = sqliteTable(
  "areas",
  {
    id: text().primaryKey().notNull(),
    user_id: text().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    icon: text().$type<AreaSummary["icon"]>().notNull(),
    sort_order: integer().notNull(),
    created_at: integer().notNull(),
  },
  (table) => [
    unique().on(table.user_id, table.slug),
    index("areas_by_owner_order").on(table.user_id, table.sort_order, table.id),
  ],
);

export const threads = sqliteTable(
  "threads",
  {
    id: text().primaryKey().notNull(),
    user_id: text().notNull(),
    area_id: text().references(() => areas.id),
    title: text().notNull(),
    slug: text().notNull(),
    summary: text(),
    sort_order: integer().notNull(),
    state: text().$type<Thread["state"]>().notNull(),
    last_activity_at: integer(),
    last_activity_content: text(),
    created_at: integer().notNull(),
    revision: integer().notNull().default(0),
    last_change_token: text(),
    moves_json: text(),
    focused_move_id: text(),
  },
  (table) => [
    unique().on(table.user_id, table.slug),
    check("threads_state", sql`${table.state} IN ('open', 'resolved')`),
    check(
      "threads_moves_json",
      sql`${table.moves_json} IS NULL OR json_valid(${table.moves_json})`,
    ),
    index("threads_by_owner_state_order").on(
      table.user_id,
      table.state,
      table.sort_order,
      table.id,
    ),
    index("threads_by_owner_area_state").on(
      table.user_id,
      table.area_id,
      table.state,
      table.created_at,
      table.id,
    ),
  ],
);

export const activityLogEntries = sqliteTable(
  "activity_log_entries",
  {
    id: text().primaryKey().notNull(),
    user_id: text().notNull(),
    thread_id: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    type: text().$type<ActivityLogEntry["type"]>().notNull(),
    content: text().notNull(),
    previous_value: text(),
    new_value: text(),
    created_at: integer().notNull(),
  },
  (table) => [
    check(
      "activity_log_entries_type",
      sql`${table.type} IN ('area_move', 'next_move_change', 'move_completed', 'state_change', 'follow_up_change')`,
    ),
    index("activity_log_entries_by_owner_thread_time").on(
      table.user_id,
      table.thread_id,
      sql`${table.created_at} DESC`,
      sql`${table.id} DESC`,
    ),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: text().primaryKey().notNull(),
    user_id: text().notNull(),
    body: text().notNull(),
    attention_date: integer(),
    state: text().$type<Note["state"]>().notNull(),
    completed_at: integer(),
    created_at: integer().notNull(),
    updated_at: integer(),
  },
  (table) => [
    check("notes_state", sql`${table.state} IN ('open', 'done')`),
    index("notes_by_owner_state_created").on(
      table.user_id,
      table.state,
      sql`${table.created_at} DESC`,
      sql`${table.id} DESC`,
    ),
    index("notes_by_owner_state_completed").on(
      table.user_id,
      table.state,
      sql`${table.completed_at} DESC`,
      sql`${table.id} DESC`,
    ),
  ],
);

export const threadNotes = sqliteTable(
  "thread_notes",
  {
    id: text().primaryKey().notNull(),
    user_id: text().notNull(),
    thread_id: text()
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    body: text().notNull(),
    state: text().$type<ThreadNote["state"]>().notNull(),
    completed_at: integer(),
    created_at: integer().notNull(),
    updated_at: integer().notNull(),
  },
  (table) => [
    check("thread_notes_state", sql`${table.state} IN ('open', 'done')`),
    index("thread_notes_by_owner_thread_state_created").on(
      table.user_id,
      table.thread_id,
      table.state,
      sql`${table.created_at} DESC`,
      sql`${table.id} DESC`,
    ),
    index("thread_notes_by_owner_thread_state_completed").on(
      table.user_id,
      table.thread_id,
      table.state,
      sql`${table.completed_at} DESC`,
      sql`${table.id} DESC`,
    ),
  ],
);
