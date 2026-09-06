import { beforeEach, describe, expect, it } from "vitest";

import type { ProjectedThread } from "./lib/validators";
import type { Fixture, SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { FIRST_PAGE, seed, setupTest, signIn } from "./test.helpers";

/**
 * Up Next — the ordered list of upcoming moves a Thread holds behind its
 * Next Move (ADR 0010), exercised through `api.*` exactly as a client would.
 *
 * The seeded Thread starts with "Call the clinic" as its Next Move and no
 * upcoming moves, so every test states the Up Next it needs.
 */

describe("Up Next", () => {
  let t: TestApi;
  let owner: SignedIn;
  let owned: Fixture;

  beforeEach(async () => {
    t = setupTest();
    owner = await signIn(t, "owner@example.com");
    owned = await seed(owner);
  });

  /** Seed Up Next straight onto the document, ahead of any editing path. */
  async function storeUpNext(moves: string[]): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.patch(owned.threadId, { upNext: moves });
    });
  }

  async function readThread() {
    return owner.query(api.threads.get, { id: owned.threadId });
  }

  /** The Thread's Activity Log, newest first. */
  async function readActivityLog() {
    const { page } = await owner.query(api.activityLogs.listByThread, {
      threadId: owned.threadId,
      paginationOpts: FIRST_PAGE,
    });
    return page;
  }

  it("hands the Thread's upcoming moves back from the detail query, in order", async () => {
    await storeUpNext(["Book the appointment", "Collect the results"]);

    const detail = await owner.query(api.threads.detailBySlug, {
      slug: owned.threadSlug,
    });

    expect(detail?.thread.upNext).toEqual([
      "Book the appointment",
      "Collect the results",
    ]);
  });

  it("promotes the front upcoming move when the Next Move is completed, on the completion entry", async () => {
    await storeUpNext(["Book the appointment", "Collect the results"]);
    const before = await readActivityLog();

    await owner.mutation(api.threads.completeNextMoveMutation, {
      id: owned.threadId,
    });

    const thread = await readThread();
    expect(thread?.nextMove).toBe("Book the appointment");
    expect(thread?.upNext).toEqual(["Collect the results"]);

    const after = await readActivityLog();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toEqual(
      expect.objectContaining({
        type: "next_action_change",
        content:
          'Completed "Call the clinic" — next move set to "Book the appointment"',
        previousValue: "Call the clinic",
        newValue: "Book the appointment",
      }),
    );
  });

  it("promotes the front upcoming move when the Next Move is cleared, on the clearing entry", async () => {
    await storeUpNext(["Book the appointment", "Collect the results"]);
    const before = await readActivityLog();

    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      nextMove: null,
    });

    const thread = await readThread();
    expect(thread?.nextMove).toBe("Book the appointment");
    expect(thread?.upNext).toEqual(["Collect the results"]);

    const after = await readActivityLog();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toEqual(
      expect.objectContaining({
        type: "next_action_change",
        content:
          'Next move changed from "Call the clinic" to "Book the appointment"',
        previousValue: "Call the clinic",
        newValue: "Book the appointment",
      }),
    );
  });

  it("leaves the Next Move empty when it is completed with nothing lined up", async () => {
    const before = await readActivityLog();

    await owner.mutation(api.threads.completeNextMoveMutation, {
      id: owned.threadId,
    });

    const thread = await readThread();
    expect(thread?.nextMove).toBeUndefined();
    expect(thread?.upNext).toBeUndefined();

    const after = await readActivityLog();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toEqual(
      expect.objectContaining({
        content: 'Completed "Call the clinic" — next move cleared',
        previousValue: "Call the clinic",
      }),
    );
    expect(after[0]?.newValue).toBeUndefined();
  });

  it("leaves the Next Move empty when it is cleared with nothing lined up", async () => {
    const before = await readActivityLog();

    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      nextMove: null,
    });

    const thread = await readThread();
    expect(thread?.nextMove).toBeUndefined();
    expect(thread?.upNext).toBeUndefined();

    const after = await readActivityLog();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toEqual(
      expect.objectContaining({
        content: "Next move cleared",
        previousValue: "Call the clinic",
      }),
    );
    expect(after[0]?.newValue).toBeUndefined();
  });

  it("rewrites the whole line of upcoming moves without writing to the Activity Log", async () => {
    await storeUpNext(["Book the appointment", "Collect the results"]);
    const before = await readActivityLog();

    await owner.mutation(api.threads.replaceUpNext, {
      id: owned.threadId,
      moves: ["Collect the results", "Book the appointment ", "File the form"],
    });

    const thread = await readThread();
    expect(thread?.upNext).toEqual([
      "Collect the results",
      "Book the appointment",
      "File the form",
    ]);
    expect(thread?.nextMove).toBe("Call the clinic");
    expect(await readActivityLog()).toEqual(before);
  });

  it("refuses a blank upcoming move and leaves the line as it was", async () => {
    await storeUpNext(["Book the appointment"]);

    await expect(
      owner.mutation(api.threads.replaceUpNext, {
        id: owned.threadId,
        moves: ["Book the appointment", "   "],
      }),
    ).rejects.toThrow(/Upcoming move cannot be empty/);

    expect((await readThread())?.upNext).toEqual(["Book the appointment"]);
  });

  it("fills an empty Next Move slot from a new line of upcoming moves, and logs the move it set", async () => {
    await owner.mutation(api.threads.completeNextMoveMutation, {
      id: owned.threadId,
    });
    const before = await readActivityLog();

    await owner.mutation(api.threads.replaceUpNext, {
      id: owned.threadId,
      moves: ["Book the appointment", "Collect the results"],
    });

    const thread = await readThread();
    expect(thread?.nextMove).toBe("Book the appointment");
    expect(thread?.upNext).toEqual(["Collect the results"]);

    const after = await readActivityLog();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toEqual(
      expect.objectContaining({
        type: "next_action_change",
        content: 'Next move set to "Book the appointment"',
        newValue: "Book the appointment",
      }),
    );
  });

  it("never leaves a Thread with upcoming moves and an empty Next Move slot", async () => {
    await storeUpNext(["Book the appointment", "Collect the results"]);

    const emptySlotWithMovesLeft = async (): Promise<boolean> => {
      const thread = await readThread();
      return !thread?.nextMove && (thread?.upNext?.length ?? 0) > 0;
    };

    await owner.mutation(api.threads.completeNextMoveMutation, {
      id: owned.threadId,
    });
    expect(await emptySlotWithMovesLeft()).toBe(false);

    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      nextMove: null,
    });
    expect(await emptySlotWithMovesLeft()).toBe(false);

    await owner.mutation(api.threads.replaceUpNext, {
      id: owned.threadId,
      moves: ["File the form"],
    });
    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      nextMove: null,
    });
    expect(await emptySlotWithMovesLeft()).toBe(false);
    expect((await readThread())?.nextMove).toBe("File the form");
  });

  it("discards the upcoming moves when the Thread is resolved, naming them in the resolution entry", async () => {
    await storeUpNext(["Book the appointment", "Collect the results"]);

    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      state: "resolved",
      resolutionNote: "Clinic confirmed no further action",
    });

    const resolved = await readThread();
    expect(resolved?.upNext).toBeUndefined();
    expect(resolved?.nextMove).toBeUndefined();

    const resolution = (await readActivityLog()).find(
      (entry) => entry.type === "state_change",
    );
    expect(resolution?.content).toBe(
      'Resolved thread: Clinic confirmed no further action — discarded upcoming moves: "Book the appointment", "Collect the results"',
    );
  });

  it("does not bring the discarded upcoming moves back when the Thread is reopened", async () => {
    await storeUpNext(["Book the appointment"]);
    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      state: "resolved",
    });

    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      state: "open",
    });

    const reopened = await readThread();
    expect(reopened?.state).toBe("open");
    expect(reopened?.upNext).toBeUndefined();
  });

  it("refuses to line up moves on a resolved Thread", async () => {
    await owner.mutation(api.threads.update, {
      id: owned.threadId,
      state: "resolved",
    });

    await expect(
      owner.mutation(api.threads.replaceUpNext, {
        id: owned.threadId,
        moves: ["Book the appointment"],
      }),
    ).rejects.toThrow(/resolved/i);

    const thread = await readThread();
    expect(thread?.upNext).toBeUndefined();
    expect(thread?.nextMove).toBeUndefined();
  });

  it("changes nothing the attention surfaces read", async () => {
    /** Everything the Dashboard and the Area lanes order Threads from. */
    const readAttentionSurfaces = async () => ({
      threads: await owner.query(api.threads.list, {}),
      areaDetail: await owner.query(api.areas.detailBySlug, {
        slug: owned.areaSlug,
      }),
    });
    const withoutUpNextMoves = ({
      upNext: _upNext,
      ...thread
    }: ProjectedThread) => thread;
    const withoutTheLine = (
      surfaces: Awaited<ReturnType<typeof readAttentionSurfaces>>,
    ) => ({
      threads: surfaces.threads.map(withoutUpNextMoves),
      areaThreads: surfaces.areaDetail?.threads.map(withoutUpNextMoves),
    });

    const before = await readAttentionSurfaces();
    await storeUpNext(["Book the appointment", "Collect the results"]);
    const after = await readAttentionSurfaces();

    expect(withoutTheLine(after)).toEqual(withoutTheLine(before));
    // Guard against a vacuous pass: the Thread really is carrying the line.
    expect(after.threads[0]).toEqual(
      expect.objectContaining({
        upNext: ["Book the appointment", "Collect the results"],
      }),
    );
    expect(before.threads.length).toBe(1);
  });
});
