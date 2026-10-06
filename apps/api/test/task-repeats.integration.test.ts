import type { ActivityLogPage, Repeat, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { parseTasks, serializeTasks } from "../src/features/threads/rows";
import { createTestApp } from "./app";
import { call, createSession, expectError, succeed } from "./sessions";

const date = Date.parse("2026-10-06T15:30Z");
const daily: Repeat = { kind: "days", every: 1 };
const conflict = { status: 409, code: "conflict" };
const validation = { status: 400, code: "validation" };

async function dated(session: Session, withDate = true, initialDate = date) {
  const thread = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Check" },
  });
  return succeed<Thread>(`/v1/threads/${thread._id}/tasks`, {
    method: "POST",
    session,
    body: {
      taskId: "a",
      text: "Check",
      ...(withDate ? { date: initialDate } : {}),
      expectedRevision: thread.revision,
    },
  });
}
function command(
  session: Session,
  thread: Thread,
  action: string,
  change: object,
  taskId = "a",
) {
  return call(`/v1/threads/${thread._id}/tasks/${taskId}/${action}`, {
    method: action === "complete" || action === "skip" ? "POST" : "PUT",
    session,
    body: { ...change, expectedRevision: thread.revision },
  });
}
async function repeating(session: Session, repeat: Repeat = daily) {
  const thread = await dated(session);
  const answer = await command(session, thread, "repeat", {
    repeat,
    timeZone: "UTC",
  });
  expect(answer.status).toBe(200);
  return answer.body as Thread;
}
async function read(session: Session, thread: Thread) {
  return (await succeed<Thread[]>("/v1/threads", { session })).find(
    (item) => item._id === thread._id,
  );
}
async function activity(session: Session, thread: Thread) {
  return (
    await succeed<ActivityLogPage>(
      `/v1/threads/${thread._id}/activity?limit=50`,
      { session },
    )
  ).entries;
}
// A real authenticated HTTP request with the existing service clock fixed.
async function advance(
  session: Session,
  thread: Thread,
  action: "skip" | "complete",
  timeZone = "UTC",
  now = Date.parse("2026-10-10T20:00Z"),
) {
  const app = createTestApp({
    createScope: (authenticated) => ({
      ...authenticated,
      clock: {
        now: () => now,
        newId: () => crypto.randomUUID(),
      },
    }),
  });
  const response = await app.request(
    `/v1/threads/${thread._id}/tasks/a/${action}`,
    {
      method: "POST",
      headers: { cookie: session.cookie, "content-type": "application/json" },
      body: JSON.stringify({ timeZone, expectedRevision: thread.revision }),
    },
    env,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Thread;
}

describe("repeating Tasks over HTTP", () => {
  it("sets, reads, stores and clears a Repeat, with revisions and no Activity Log entry", async () => {
    const owner = await createSession("repeat-cycle");
    const before = await dated(owner);
    const set = await command(owner, before, "repeat", {
      repeat: { kind: "weekly", weekdays: [4, 2] },
      timeZone: "UTC",
    });
    expect(set.status).toBe(200);
    const thread = set.body as Thread;
    expect(thread.tasks?.[0]).toEqual({
      _id: "a",
      text: "Check",
      date,
      repeat: { kind: "weekly", weekdays: [2, 4] },
    });
    expect(thread.revision).toBe(before.revision + 1);
    expect(await read(owner, thread)).toEqual(thread);
    const stored = await env.DB.prepare(
      "SELECT moves_json FROM threads WHERE id = ?",
    )
      .bind(thread._id)
      .first<{ moves_json: string }>();
    expect(JSON.parse(stored!.moves_json)).toEqual([
      {
        id: "a",
        text: "Check",
        date,
        repeat: { kind: "weekly", weekdays: [2, 4] },
      },
    ]);
    const again = await command(owner, thread, "repeat", {
      repeat: { kind: "weekly", weekdays: [4, 2] },
      timeZone: "UTC",
    });
    expect(again.body).toEqual(thread);
    const cleared = await command(owner, thread, "repeat", {
      repeat: null,
      timeZone: "UTC",
    });
    expect(cleared.status).toBe(200);
    expect((cleared.body as Thread).tasks).toEqual(before.tasks);
    expect((cleared.body as Thread).revision).toBe(thread.revision + 1);
    expect(await activity(owner, thread)).toEqual([]);
  });

  it("snaps a weekly Repeat and changed date to the caller's weekdays and time", async () => {
    const owner = await createSession("repeat-snap");
    const thread = await repeating(owner, { kind: "weekly", weekdays: [0] });
    expect(thread.tasks?.[0]?.date).toBe(Date.parse("2026-10-11T15:30Z"));
    const changed = await command(owner, thread, "date", {
      date: Date.parse("2026-10-12T15:30Z"),
      timeZone: "UTC",
    });
    expect(changed.status).toBe(200);
    expect((changed.body as Thread).tasks?.[0]?.date).toBe(
      Date.parse("2026-10-18T15:30Z"),
    );
  });

  it("clearing a date also clears its Repeat without a zone", async () => {
    const owner = await createSession("repeat-clear-date");
    const thread = await repeating(owner);
    const cleared = await command(owner, thread, "date", {
      date: null,
    });
    expect(cleared.status).toBe(200);
    expect((cleared.body as Thread).tasks).toEqual([
      { _id: "a", text: "Check" },
    ]);
    expect((cleared.body as Thread).revision).toBe(thread.revision + 1);
    expect(await activity(owner, thread)).toEqual([]);
  });

  it("clears a weekly Task's date without a zone", async () => {
    const owner = await createSession("repeat-clear-weekly");
    const thread = await repeating(owner, { kind: "weekly", weekdays: [2] });
    const cleared = await command(owner, thread, "date", { date: null });
    expect(cleared.status).toBe(200);
    expect((cleared.body as Thread).tasks).toEqual([
      { _id: "a", text: "Check" },
    ]);
    expect((cleared.body as Thread).revision).toBe(thread.revision + 1);
    expect(await activity(owner, thread)).toEqual([]);
  });

  it("changes an every-N-days date without a zone, preserving the repeat", async () => {
    const owner = await createSession("repeat-redate-days");
    const thread = await repeating(owner, { kind: "days", every: 3 });
    const next = Date.parse("2026-10-08T09:15Z");
    const changed = await command(owner, thread, "date", { date: next });
    expect(changed.status).toBe(200);
    expect((changed.body as Thread).tasks).toEqual([
      { ...thread.tasks![0], date: next },
    ]);
    expect((changed.body as Thread).revision).toBe(thread.revision + 1);
    const unchanged = await command(owner, changed.body as Thread, "date", {
      date: next,
    });
    expect(unchanged.body).toEqual(changed.body);
    expect(await activity(owner, thread)).toEqual([]);
  });

  it("refuses a repeat on the add route", async () => {
    const owner = await createSession("repeat-capture");
    const thread = await dated(owner);
    expectError(
      await call(`/v1/threads/${thread._id}/tasks`, {
        method: "POST",
        session: owner,
        body: {
          taskId: "b",
          text: "Check",
          date,
          repeat: daily,
          expectedRevision: thread.revision,
        },
      }),
      validation,
    );
    expect(await read(owner, thread)).toEqual(thread);
  });

  it.each(["complete", "date"])(
    "validates invalid zones before stale revisions on %s",
    async (action) => {
      const owner = await createSession("repeat-zone-stale");
      const thread = await repeating(owner);
      for (const timeZone of ["Invalid/Zone", "+02:00", ""]) {
        expectError(
          await command(
            owner,
            { ...thread, revision: thread.revision - 1 },
            action,
            {
              ...(action === "date" ? { date: null } : {}),
              timeZone,
            },
          ),
          { ...validation, message: "Invalid Task change." },
        );
      }
      expect(await read(owner, thread)).toEqual(thread);
      expect(await activity(owner, thread)).toEqual([]);
    },
  );

  it("completion keeps the Task and focus, collapses missed dates using the service clock, and writes one entry", async () => {
    const owner = await createSession("repeat-complete");
    const thread = await repeating(owner);
    const focused = await succeed<Thread>(`/v1/threads/${thread._id}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "a", expectedRevision: thread.revision },
    });
    const completed = await advance(owner, focused, "complete");
    expect(completed.tasks).toEqual([
      { ...thread.tasks![0], date: Date.parse("2026-10-10T15:30Z") },
    ]);
    expect(completed.focusedTaskId).toBe("a");
    expect(completed.revision).toBe(focused.revision + 1);
    expect(await activity(owner, thread)).toMatchObject([
      { type: "move_completed", previousValue: "Check" },
    ]);
    expect(completed.lastActivityAt).toBe(Date.parse("2026-10-10T20:00Z"));
    expect(await read(owner, thread)).toEqual(completed);
    expectError(
      await command(owner, focused, "complete", { timeZone: "UTC" }),
      conflict,
    );
    expect(await activity(owner, thread)).toHaveLength(1);
    const skipped = await advance(owner, completed, "skip");
    expect(skipped.lastActivityAt).toBe(completed.lastActivityAt);
    expect(skipped.lastActivityContent).toBe(completed.lastActivityContent);
    expect(skipped.focusedTaskId).toBe("a");
    expect(skipped.revision).toBe(completed.revision + 1);
    expect(await activity(owner, thread)).toHaveLength(1);
  });

  it("skip moves the date and revision without writing or stamping activity", async () => {
    const owner = await createSession("repeat-skip");
    const thread = await repeating(owner, { kind: "days", every: 3 });
    const skipped = await advance(owner, thread, "skip");
    expect(skipped.tasks?.[0]?.date).toBe(Date.parse("2026-10-12T15:30Z"));
    expect(skipped.revision).toBe(thread.revision + 1);
    expect(skipped).not.toHaveProperty("lastActivityAt");
    expect(await activity(owner, thread)).toEqual([]);
  });

  it.each([
    ["America/New_York", "2026-03-07T02:30-05:00", "2026-03-08T03:30-04:00"],
    ["America/New_York", "2026-10-31T01:30-04:00", "2026-11-01T01:30-04:00"],
    ["Europe/Berlin", "2026-03-28T00:00+01:00", "2026-03-29T00:00+01:00"],
    ["Europe/Berlin", "2026-10-24T02:30+02:00", "2026-10-25T02:30+02:00"],
    ["Pacific/Auckland", "2026-09-26T23:55+12:00", "2026-09-27T23:55+13:00"],
  ])(
    "uses the caller's calendar across DST in the Worker: %s %s",
    async (timeZone, initial, next) => {
      const owner = await createSession("repeat-worker-dst");
      for (const action of ["complete", "skip"] as const) {
        const before = await dated(owner, true, Date.parse(initial));
        const set = await command(owner, before, "repeat", {
          repeat: daily,
          timeZone,
        });
        expect(set.status).toBe(200);
        const advanced = await advance(
          owner,
          set.body as Thread,
          action,
          timeZone,
          Date.parse(initial),
        );
        expect(advanced.tasks?.[0]?.date).toBe(Date.parse(next));
        expect(advanced.revision).toBe(before.revision + 2);
        expect(await activity(owner, advanced)).toHaveLength(
          action === "complete" ? 1 : 0,
        );
      }
    },
  );

  it("refuses repeat without a date and skip without a Repeat; one-off completion needs no zone", async () => {
    const owner = await createSession("repeat-one-off");
    const thread = await dated(owner, false);
    expectError(
      await command(owner, thread, "repeat", {
        repeat: daily,
        timeZone: "UTC",
      }),
      validation,
    );
    expectError(
      await command(owner, thread, "skip", { timeZone: "UTC" }),
      validation,
    );
    expect(await read(owner, thread)).toEqual(thread);
    const completed = await command(owner, thread, "complete", {});
    expect(completed.status).toBe(200);
    expect(completed.body).not.toHaveProperty("tasks");
    expect(await activity(owner, thread)).toHaveLength(1);
  });

  it("refuses missing and invalid zones, leaving a repeating Task untouched", async () => {
    const owner = await createSession("repeat-zone");
    const thread = await repeating(owner);
    for (const timeZone of [undefined, "Invalid/Zone", "+02:00", ""]) {
      const zone = timeZone === undefined ? {} : { timeZone };
      const changes = [
        ["complete", zone],
        ["skip", zone],
        ["repeat", { repeat: daily, ...zone }],
        ["repeat", { repeat: null, ...zone }],
        ...(timeZone === undefined
          ? []
          : ([
              ["date", { date, ...zone }],
              ["date", { date: null, ...zone }],
            ] as const)),
      ] as const;
      for (const [action, body] of changes) {
        expectError(await command(owner, thread, action, body), validation);
      }
    }
    expect(await read(owner, thread)).toEqual(thread);
    expect(await activity(owner, thread)).toEqual([]);
    // The retired route cannot complete or strip a Repeat.
    expect(
      (
        await call(`/v1/threads/${thread._id}/moves/a/complete`, {
          method: "POST",
          session: owner,
          body: { expectedRevision: thread.revision },
        })
      ).status,
    ).toBe(404);
  });

  it("refuses stale revisions, missing Tasks, and another owner for every new command", async () => {
    const owner = await createSession("repeat-refusals");
    const other = await createSession("repeat-other");
    const thread = await repeating(owner);
    for (const [action, body] of [
      ["complete", { timeZone: "UTC" }],
      ["skip", { timeZone: "UTC" }],
      ["repeat", { repeat: null, timeZone: "UTC" }],
      ["date", { date: null, timeZone: "UTC" }],
    ] as const) {
      expectError(
        await command(
          owner,
          { ...thread, revision: thread.revision - 1 },
          action,
          body,
        ),
        conflict,
      );
      expectError(
        await command(owner, thread, action, body, "missing"),
        conflict,
      );
      expectError(await command(other, thread, action, body), {
        status: 404,
        code: "not_found",
      });
    }
    expect(await read(owner, thread)).toEqual(thread);
    expect(await activity(owner, thread)).toEqual([]);
  });

  it.each([
    { kind: "days", every: 0 },
    { kind: "days", every: 366 },
    { kind: "days", every: 1.5 },
    { kind: "weekly", weekdays: [] },
    { kind: "weekly", weekdays: [2, 2] },
    { kind: "weekly", weekdays: [-1] },
    { kind: "weekly", weekdays: [7] },
    { kind: "weekly", weekdays: [1.5] },
    { kind: "monthly", every: 1 },
  ])("refuses invalid Repeat %j in the HTTP schema", async (repeat) => {
    const owner = await createSession("repeat-shape");
    const thread = await dated(owner);
    expectError(
      await command(owner, thread, "repeat", { repeat, timeZone: "UTC" }),
      { ...validation, message: "Invalid Task change." },
    );
    expect(await read(owner, thread)).toEqual(thread);
  });
});

describe("stored Repeats", () => {
  it.each([-1, 253_402_300_800_000, Number.MAX_SAFE_INTEGER])(
    "reads a legacy stored safe-integer date outside write bounds: %s",
    (date) => {
      const tasks = [{ _id: "a", text: "Follow up", date }];
      expect(
        parseTasks(JSON.stringify([{ id: "a", text: "Follow up", date }])),
      ).toEqual(tasks);
      expect(parseTasks(serializeTasks(tasks as Thread["tasks"]))).toEqual(
        tasks,
      );
    },
  );

  it("round-trips and sorts a valid Repeat", () => {
    const stored =
      '[{"id":"a","text":"Check","date":1,"repeat":{"kind":"weekly","weekdays":[4,2]}}]';
    const tasks = parseTasks(stored);
    expect(tasks?.[0]?.repeat).toEqual({ kind: "weekly", weekdays: [2, 4] });
    expect(JSON.parse(serializeTasks(tasks)!)[0].repeat).toEqual({
      kind: "weekly",
      weekdays: [2, 4],
    });
  });
  it.each([
    { kind: "days", every: 0 },
    { kind: "weekly", weekdays: [1, 1] },
    { kind: "weekly", weekdays: [] },
    null,
    "daily",
  ])("rejects malformed stored Repeat %j", (repeat) => {
    expect(() =>
      parseTasks(JSON.stringify([{ id: "a", text: "Check", date: 1, repeat }])),
    ).toThrow();
  });
  it("rejects a stored Repeat with no date", () => {
    expect(() =>
      parseTasks(JSON.stringify([{ id: "a", text: "Check", repeat: daily }])),
    ).toThrow();
  });
});
