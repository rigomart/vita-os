import type { AreaSummary, Note, Thread, ThreadNote } from "@vita-os/contracts";
import type { ExportFile } from "@vita-os/operations";

import { ExportFileSchema } from "@vita-os/operations";
import { env } from "cloudflare:test";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

const TABLES = [
  "areas",
  "threads",
  "activity_log_entries",
  "notes",
  "thread_notes",
] as const;

const checkupDate = new Date(2026, 10, 3).getTime();

/** One of each record kind, written the way the browser writes them. */
async function recordsOf(session: Session, label: string) {
  const area = await succeed<AreaSummary>("/v1/areas", {
    method: "POST",
    session,
    body: { name: `${label} Health`, icon: "HeartPulse" },
  });
  const open = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: `${label} checkup`, areaId: area._id },
  });
  await succeed(`/v1/threads/${open._id}/tasks`, {
    method: "POST",
    session,
    body: { taskId: "book", text: "Book the checkup", date: checkupDate },
  });

  const resolved = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: `${label} passport` },
  });
  for (const [taskId, text] of [
    ["photos", "Get photos"],
    ["form", "Fill the form"],
  ]) {
    await succeed(`/v1/threads/${resolved._id}/tasks`, {
      method: "POST",
      session,
      body: { taskId, text },
    });
  }
  await succeed(`/v1/threads/${resolved._id}/tasks/photos/complete`, {
    method: "POST",
    session,
    body: { expectedOccurrence: null },
  });
  await succeed(`/v1/threads/${resolved._id}`, {
    method: "PATCH",
    session,
    body: { state: "resolved" },
  });

  const note = await succeed<Note>("/v1/notes", {
    method: "POST",
    session,
    body: { body: `${label} idea` },
  });
  await succeed(`/v1/notes/${note._id}/state`, {
    method: "PATCH",
    session,
    body: { state: "done" },
  });
  const threadNote = await succeed<ThreadNote>(
    `/v1/threads/${open._id}/notes`,
    { method: "POST", session, body: { body: `${label} clinic hours` } },
  );

  return { area, open, resolved, note, threadNote };
}

/** The owner's rows as D1 holds them, in the export's order, without the owner. */
async function storedRows(session: Session, table: (typeof TABLES)[number]) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${table} WHERE user_id = ? ORDER BY created_at, id`,
  )
    .bind(session.actorId)
    .all<Record<string, unknown>>();
  return results.map(({ user_id: _owner, ...row }) => row);
}

async function exportOf(session: Session): Promise<ExportFile> {
  return succeed<ExportFile>("/v1/export", { session });
}

describe("Download my data", () => {
  it("holds every record kind exactly as stored", async () => {
    const owner = await createSession("export-every-kind");
    const { area, open, resolved, note, threadNote } = await recordsOf(
      owner,
      "Mine",
    );

    const file = await exportOf(owner);

    for (const table of TABLES) {
      expect(file[table]).toEqual(await storedRows(owner, table));
    }
    expect(file.areas).toEqual([
      expect.objectContaining({ id: area._id, name: "Mine Health" }),
    ]);
    const [openRow, resolvedRow] = file.threads;
    expect(openRow).toMatchObject({
      id: open._id,
      area_id: area._id,
      state: "open",
    });
    expect(JSON.parse(openRow!.moves_json!)).toEqual([
      { id: "book", text: "Book the checkup", date: checkupDate },
    ]);
    // Resolving discards the open Tasks into the Activity Log entry.
    expect(resolvedRow).toMatchObject({
      id: resolved._id,
      state: "resolved",
      moves_json: null,
    });
    expect(resolvedRow!.revision).toBeGreaterThan(0);
    expect(resolvedRow).toHaveProperty("last_change_token");
    expect(file.activity_log_entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          thread_id: resolved._id,
          type: "move_completed",
          content: expect.stringContaining("Get photos"),
        }),
        expect.objectContaining({
          thread_id: resolved._id,
          type: "state_change",
          content: expect.stringContaining("Fill the form"),
        }),
      ]),
    );
    expect(file.notes).toEqual([
      expect.objectContaining({
        id: note._id,
        state: "done",
        completed_at: expect.any(Number),
      }),
    ]);
    expect(file.thread_notes).toEqual([
      expect.objectContaining({
        id: threadNote._id,
        thread_id: open._id,
        body: "Mine clinic hours",
      }),
    ]);
  });

  it("decodes with the file's schema and names the latest migration", async () => {
    const owner = await createSession("export-schema");
    await recordsOf(owner, "Decoded");

    const file = v.parse(ExportFileSchema, await exportOf(owner));

    expect(file.format).toBe("vita-os-export");
    expect(file.migration).toBe(env.TEST_MIGRATIONS.at(-1)!.name);
    expect(file.exportedAt).toEqual(expect.any(Number));
  });

  it("never includes another owner's records", async () => {
    const owner = await createSession("export-owner");
    const other = await createSession("export-other");
    await recordsOf(owner, "Mine");
    await recordsOf(other, "Theirs");

    const file = await exportOf(owner);

    for (const table of TABLES) {
      expect(file[table].length).toBeGreaterThan(0);
      expect(file[table]).toEqual(await storedRows(owner, table));
    }
    expect(JSON.stringify(file)).not.toContain("Theirs");

    const empty = await exportOf(await createSession("export-empty"));
    for (const table of TABLES) expect(empty[table]).toEqual([]);
  });

  it("refuses an unauthenticated request", async () => {
    expectError(await call("/v1/export"), {
      status: 401,
      code: "unauthorized",
    });
  });
});
