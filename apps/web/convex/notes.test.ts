import { describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { FIRST_PAGE, seed, setupTest, signIn } from "./test.helpers";

describe("standalone Notes", () => {
  it("captures a body without classification and preserves creation time when edited", async () => {
    const t = setupTest();
    const owner = await signIn(t, "notes@example.com");
    const id = await owner.mutation(api.notes.create, {
      body: "A thought\nwith context",
    });
    const [created] = await owner.query(api.notes.list, {});
    expect(created).toMatchObject({
      _id: id,
      body: "A thought\nwith context",
      state: "open",
    });
    expect(created.updatedAt).toBe(created.createdAt);
    const later = created.createdAt + 1000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      await owner.mutation(api.notes.updateBody, {
        id,
        body: "Revised\nthought",
      });
      expect(await owner.query(api.notes.list, {})).toEqual([
        { ...created, body: "Revised\nthought", updatedAt: later },
      ]);
    } finally {
      clock.mockRestore();
    }
  });
  it("keeps optional attention dates editable, completes, reopens, and permanently deletes Notes", async () => {
    const t = setupTest();
    const owner = await signIn(t, "lifecycle@example.com");
    const id = await owner.mutation(api.notes.create, {
      body: "Keep for later",
    });
    const [created] = await owner.query(api.notes.list, {});
    for (const when of [1000, 2000, undefined]) {
      await owner.mutation(api.notes.updateWhen, { id, when });
      const [note] = await owner.query(api.notes.list, {});
      expect(note.when).toBe(when);
      expect(note.createdAt).toBe(created.createdAt);
      expect(note.updatedAt).toBeGreaterThanOrEqual(created.updatedAt!);
    }
    await owner.mutation(api.notes.markDone, { id });
    expect(await owner.query(api.notes.list, {})).toEqual([]);
    expect(
      (await owner.query(api.notes.listDone, { paginationOpts: FIRST_PAGE }))
        .page,
    ).toEqual([
      expect.objectContaining({
        _id: id,
        body: "Keep for later",
        state: "done",
        createdAt: created.createdAt,
      }),
    ]);
    await owner.mutation(api.notes.markOpen, { id });
    expect(await owner.query(api.notes.count, {})).toBe(1);
    expect(
      (await owner.query(api.notes.listDone, { paginationOpts: FIRST_PAGE }))
        .page,
    ).toEqual([]);
    await owner.mutation(api.notes.remove, { id });
    expect(await owner.query(api.notes.list, {})).toEqual([]);
    const doneId = await owner.mutation(api.notes.create, {
      body: "Delete from history",
    });
    await owner.mutation(api.notes.markDone, { id: doneId });
    await owner.mutation(api.notes.remove, { id: doneId });
    expect(
      (await owner.query(api.notes.listDone, { paginationOpts: FIRST_PAGE }))
        .page,
    ).toEqual([]);
    await expect(
      owner.mutation(api.notes.markOpen, { id: doneId }),
    ).rejects.toThrow("Note not found");
  });

  it("migrates legacy Tasks in place without changing content, dates, states, IDs, or timestamps", async () => {
    const t = setupTest();
    const owner = await signIn(t, "legacy@example.com");
    const fixture = await seed(owner);
    await owner.mutation(api.notes.remove, { id: fixture.noteId });
    const legacy = await t.run(async (ctx) => {
      const area = await ctx.db.get(fixture.areaId);
      const userId = area!.userId;
      const open = await ctx.db.insert("tasks", {
        userId,
        text: "  Old thought\nwith all its context  ",
        when: 1234,
        state: "open",
        createdAt: 100,
      });
      const done = await ctx.db.insert("tasks", {
        userId,
        text: "Finished action",
        when: 2345,
        state: "done",
        createdAt: 200,
        completedAt: 300,
        updatedAt: 250,
      });
      return {
        open: (await ctx.db.get(open))!,
        done: (await ctx.db.get(done))!,
      };
    });
    const [open] = await owner.query(api.notes.list, {});
    const [done] = (
      await owner.query(api.notes.listDone, { paginationOpts: FIRST_PAGE })
    ).page;
    expect(open).toEqual({
      _id: legacy.open._id,
      _creationTime: legacy.open._creationTime,
      body: "  Old thought\nwith all its context  ",
      when: 1234,
      state: "open",
      createdAt: 100,
    });
    expect(done).toEqual({
      _id: legacy.done._id,
      _creationTime: legacy.done._creationTime,
      body: "Finished action",
      when: 2345,
      state: "done",
      createdAt: 200,
      completedAt: 300,
      updatedAt: 250,
    });
    // The fixture includes a Thread Activity Log note, which never joins Notes.
    expect(await owner.query(api.notes.count, {})).toBe(1);
    expect(
      (
        await owner.query(api.activityLogs.listByThread, {
          threadId: fixture.threadId,
          paginationOpts: FIRST_PAGE,
        })
      ).page.some((entry) => entry._id === fixture.logId),
    ).toBe(true);
    await owner.mutation(api.notes.updateBody, {
      id: open._id,
      body: "Edited legacy note",
    });
    const [edited] = await owner.query(api.notes.list, {});
    expect(edited.createdAt).toBe(100);
    expect(edited._creationTime).toBe(legacy.open._creationTime);
    expect(edited.updatedAt).toEqual(expect.any(Number));
  });

  it("orders completed history by completion time across pages", async () => {
    const t = setupTest();
    const owner = await signIn(t, "history@example.com");
    const first = await owner.mutation(api.notes.create, {
      body: "Created first",
    });
    const second = await owner.mutation(api.notes.create, {
      body: "Created second",
    });
    const clock = vi.spyOn(Date, "now");
    try {
      clock.mockReturnValue(Date.now() + 1000);
      await owner.mutation(api.notes.markDone, { id: second });
      clock.mockReturnValue(Date.now() + 1000);
      await owner.mutation(api.notes.markDone, { id: first });
      const page = await owner.query(api.notes.listDone, {
        paginationOpts: { numItems: 1, cursor: null },
      });
      expect(page.page.map((note) => note._id)).toEqual([first]);
      const next = await owner.query(api.notes.listDone, {
        paginationOpts: { numItems: 1, cursor: page.continueCursor },
      });
      expect(next.page.map((note) => note._id)).toEqual([second]);
    } finally {
      clock.mockRestore();
    }
  });
});
