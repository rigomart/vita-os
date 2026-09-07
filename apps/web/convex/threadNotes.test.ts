import { describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { FIRST_PAGE, setupTest, signIn } from "./test.helpers";

async function setupThread(email: string) {
  const t = setupTest();
  const owner = await signIn(t, email);
  const area = await owner.mutation(api.areas.create, {
    name: "Family Health",
    condition: "healthy",
    icon: "HeartPulse",
  });
  const thread = await owner.mutation(api.threads.create, {
    title: "Book checkup",
    areaId: area.id,
  });
  return { t, owner, threadId: thread.id };
}

describe("Thread Notes", () => {
  it("keeps legacy manual entries out of the read-only Activity Log", async () => {
    const { t, owner, threadId } = await setupThread("legacy-log@example.com");
    await t.run(async (ctx) => {
      const thread = await ctx.db.get("threads", threadId);
      await ctx.db.insert("activityLogs", {
        userId: thread!.userId,
        threadId,
        type: "note",
        content: "Hand-written note",
        createdAt: 100,
      });
      await ctx.db.insert("activityLogs", {
        userId: thread!.userId,
        threadId,
        type: "next_action_change",
        content: "Next move set",
        createdAt: 200,
      });
    });

    expect(
      (
        await owner.query(api.activityLogs.listByThread, {
          threadId,
          paginationOpts: FIRST_PAGE,
        })
      ).page.map((entry) => entry.content),
    ).toEqual(["Next move set"]);
  });

  it("captures a body only on its Thread and records that capture as Thread activity", async () => {
    const { owner, threadId } = await setupThread("capture@example.com");
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);

    try {
      const id = await owner.mutation(api.threadNotes.create, {
        threadId,
        body: "Called the clinic\nWaiting for a reply",
      });

      expect(await owner.query(api.notes.list, {})).toEqual([]);
      expect(await owner.query(api.threadNotes.list, { threadId })).toEqual([
        expect.objectContaining({
          _id: id,
          body: "Called the clinic\nWaiting for a reply",
          state: "open",
          createdAt: 1_000,
          updatedAt: 1_000,
        }),
      ]);
      expect(await owner.query(api.threads.get, { id: threadId })).toEqual(
        expect.objectContaining({
          lastActivityAt: 1_000,
          lastActivityContent: "Called the clinic\nWaiting for a reply",
        }),
      );
      expect(
        (
          await owner.query(api.activityLogs.listByThread, {
            threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([]);
    } finally {
      clock.mockRestore();
    }
  });

  it("edits, completes, reopens, and deletes without changing Thread activity", async () => {
    const { owner, threadId } = await setupThread("lifecycle@example.com");
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);

    try {
      const id = await owner.mutation(api.threadNotes.create, {
        threadId,
        body: "Initial note",
      });
      const activityAfterCapture = await owner.query(api.threads.get, {
        id: threadId,
      });

      clock.mockReturnValue(2_000);
      await owner.mutation(api.threadNotes.updateBody, {
        id,
        body: "Edited note",
      });
      expect(await owner.query(api.threadNotes.list, { threadId })).toEqual([
        expect.objectContaining({
          _id: id,
          body: "Edited note",
          createdAt: 1_000,
          updatedAt: 2_000,
        }),
      ]);

      clock.mockReturnValue(3_000);
      await owner.mutation(api.threadNotes.markDone, { id });
      expect(await owner.query(api.threadNotes.list, { threadId })).toEqual([]);
      expect(
        (
          await owner.query(api.threadNotes.listDone, {
            threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([
        expect.objectContaining({
          _id: id,
          body: "Edited note",
          state: "done",
          completedAt: 3_000,
          createdAt: 1_000,
          updatedAt: 3_000,
        }),
      ]);

      clock.mockReturnValue(4_000);
      await owner.mutation(api.threadNotes.markOpen, { id });
      await owner.mutation(api.threadNotes.remove, { id });

      expect(await owner.query(api.threadNotes.list, { threadId })).toEqual([]);
      expect(await owner.query(api.threads.get, { id: threadId })).toEqual(
        activityAfterCapture,
      );
      expect(
        (
          await owner.query(api.activityLogs.listByThread, {
            threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([]);
    } finally {
      clock.mockRestore();
    }
  });
});
