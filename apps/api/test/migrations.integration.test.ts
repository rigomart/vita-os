import type {
  ActivityLogPage,
  AreaSummary,
  ThreadDetail,
  ThreadNote,
} from "@vita-os/contracts";

import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import worker from "../src/worker";

/**
 * Data migrations, checked the way a user would notice them: apply the schema
 * as it stood, write rows in that old shape, apply the migration under test,
 * and read everything back through the Worker.
 *
 * `MIGRATION_DB` is a database of its own, so migrations can be applied one
 * step at a time without disturbing the database every other test shares.
 */
const database = env.MIGRATION_DB;
const migrationEnv = { ...env, DB: database };

/** A migration's number, from its `0004_name.sql` file name. */
function numberOf(migration: { name: string }): number {
  return Number.parseInt(migration.name, 10);
}

function migrationsBefore(number: number) {
  return env.TEST_MIGRATIONS.filter(
    (migration) => numberOf(migration) < number,
  );
}

function migrationsThrough(number: number) {
  const migrations = env.TEST_MIGRATIONS.filter(
    (migration) => numberOf(migration) <= number,
  );
  expect(migrations.map(numberOf)).toContain(number);
  return migrations;
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", "http://browser.test");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return worker.fetch(
    new Request(`http://api.test${path}`, { ...init, headers }),
    migrationEnv,
  );
}

async function signUp(label: string) {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      name: label,
      email: `${label}-${crypto.randomUUID()}@example.com`,
      password: "correct horse battery staple",
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  return {
    actorId: body.user.id,
    cookie: response.headers.get("set-cookie") ?? "",
  };
}

async function read<T>(path: string, cookie: string): Promise<T> {
  const response = await request(path, { headers: { cookie } });
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

describe("0004: Areas become optional labels", () => {
  let owner: { actorId: string; cookie: string };

  beforeAll(async () => {
    await applyD1Migrations(database, migrationsBefore(4));
    owner = await signUp("migration-owner");

    await database.batch([
      database
        .prepare(
          `INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          "area-health",
          owner.actorId,
          "Health",
          "health-00000000",
          "Checkups are current",
          "critical",
          "HeartPulse",
          1,
          1_500_000_000_000,
        ),
      database
        .prepare(
          `INSERT INTO areas (id, user_id, name, slug, standard, condition, icon, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          "area-home",
          owner.actorId,
          "Home",
          "home-00000000",
          null,
          "healthy",
          "Home",
          0,
          1_500_000_000_001,
        ),
      database
        .prepare(
          `INSERT INTO threads (id, user_id, area_id, title, slug, summary, sort_order, state, next_move, up_next_json, follow_up, last_activity_at, last_activity_content, created_at, revision, last_change_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          "thread-checkup",
          owner.actorId,
          "area-health",
          "Book checkup",
          "book-checkup-00000000",
          "Annual",
          3,
          "open",
          "Call clinic",
          JSON.stringify(["Book appointment"]),
          1_800_000_000_000,
          1_700_000_000_000,
          "Next move set",
          1_600_000_000_000,
          7,
          "token-7",
        ),
      database
        .prepare(
          `INSERT INTO threads (id, user_id, area_id, title, slug, sort_order, state, created_at, revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          "thread-gate",
          owner.actorId,
          "area-home",
          "Fix the gate",
          "fix-the-gate-00000000",
          4,
          "resolved",
          1_600_000_000_001,
          2,
        ),
      database
        .prepare(
          `INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, previous_value, new_value, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          "log-1",
          owner.actorId,
          "thread-checkup",
          "next_move_change",
          'Next move set to "Call clinic"',
          null,
          "Call clinic",
          1_700_000_000_000,
        ),
      database
        .prepare(
          `INSERT INTO thread_notes (id, user_id, thread_id, body, state, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          "note-1",
          owner.actorId,
          "thread-checkup",
          "Clinic opens at nine",
          "open",
          null,
          1_700_000_000_001,
          1_700_000_000_001,
        ),
    ]);

    await applyD1Migrations(database, migrationsThrough(4));
  });

  it("keeps every Area's name, icon, and order, without Condition or Standard", async () => {
    const areas = await read<AreaSummary[]>("/v1/areas", owner.cookie);

    expect(areas).toEqual([
      {
        _id: "area-home",
        name: "Home",
        slug: "home-00000000",
        icon: "Home",
        order: 0,
        createdAt: 1_500_000_000_001,
      },
      {
        _id: "area-health",
        name: "Health",
        slug: "health-00000000",
        icon: "HeartPulse",
        order: 1,
        createdAt: 1_500_000_000_000,
      },
    ]);
  });

  it("keeps every Thread's Area and every other field", async () => {
    const checkup = await read<ThreadDetail>(
      "/v1/threads/book-checkup-00000000",
      owner.cookie,
    );
    const gate = await read<ThreadDetail>(
      "/v1/threads/fix-the-gate-00000000",
      owner.cookie,
    );

    expect(checkup.thread).toEqual({
      _id: "thread-checkup",
      title: "Book checkup",
      slug: "book-checkup-00000000",
      summary: "Annual",
      areaId: "area-health",
      order: 3,
      state: "open",
      nextMove: "Call clinic",
      upNext: ["Book appointment"],
      followUp: 1_800_000_000_000,
      lastActivityAt: 1_700_000_000_000,
      lastActivityContent: "Next move set",
      createdAt: 1_600_000_000_000,
      revision: 7,
    });
    expect(checkup.area?._id).toBe("area-health");
    expect(gate.thread).toMatchObject({
      areaId: "area-home",
      state: "resolved",
      revision: 2,
    });
  });

  it("keeps each Thread's Activity Log and Thread Notes", async () => {
    const activity = await read<ActivityLogPage>(
      "/v1/threads/thread-checkup/activity",
      owner.cookie,
    );
    const notes = await read<ThreadNote[]>(
      "/v1/threads/thread-checkup/notes",
      owner.cookie,
    );

    expect(activity.entries.map((entry) => entry._id)).toEqual(["log-1"]);
    expect(notes.map((note) => note.body)).toEqual(["Clinic opens at nine"]);
  });

  it("lets a Thread lose its Area afterwards", async () => {
    const response = await request("/v1/threads/thread-gate", {
      method: "PATCH",
      headers: { cookie: owner.cookie },
      body: JSON.stringify({ areaId: null }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("areaId");
  });

  it("creates Areas with a name and an icon alone afterwards", async () => {
    const response = await request("/v1/areas", {
      method: "POST",
      headers: { cookie: owner.cookie },
      body: JSON.stringify({ name: "Career", icon: "BriefcaseBusiness" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: "Career", order: 2 });
  });
});
