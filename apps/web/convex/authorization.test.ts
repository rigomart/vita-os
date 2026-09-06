import { beforeEach, describe, expect, it } from "vitest";

import type { Fixture, SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { FIRST_PAGE, seed, setupTest, signIn } from "./test.helpers";

/**
 * Authorization tests for every public Convex function, exercised through
 * `api.*` exactly as a client would. Sign-in and fixtures come from
 * `test.helpers`, which stands up a real Better Auth session.
 */

describe("owned-document authorization", () => {
  let t: TestApi;
  let owner: SignedIn;
  let intruder: SignedIn;
  let owned: Fixture;

  beforeEach(async () => {
    t = setupTest();
    owner = await signIn(t, "owner@example.com");
    intruder = await signIn(t, "intruder@example.com");
    owned = await seed(owner);
  });

  describe("areas", () => {
    it("hides another user's Area from every read", async () => {
      // Assert the owner's side first: an isolation check alone would pass
      // against a function that returned nothing to anybody.
      expect(
        (await owner.query(api.areas.list, {})).map((area) => area._id),
      ).toEqual([owned.areaId]);
      expect(await owner.query(api.areas.get, { id: owned.areaId })).toEqual(
        expect.objectContaining({ _id: owned.areaId }),
      );
      expect(
        await owner.query(api.areas.getBySlug, { slug: owned.areaSlug }),
      ).toEqual(expect.objectContaining({ _id: owned.areaId }));

      expect(await intruder.query(api.areas.list, {})).toEqual([]);
      expect(await intruder.query(api.areas.get, { id: owned.areaId })).toBe(
        null,
      );
      expect(
        await intruder.query(api.areas.getBySlug, { slug: owned.areaSlug }),
      ).toBe(null);
    });

    it("refuses another user's Area in every mutation", async () => {
      await expect(
        intruder.mutation(api.areas.update, {
          id: owned.areaId,
          name: "Stolen",
        }),
      ).rejects.toThrow(/Area not found/);
      await expect(
        intruder.mutation(api.areas.remove, { id: owned.areaId }),
      ).rejects.toThrow(/Area not found/);

      expect(await owner.query(api.areas.get, { id: owned.areaId })).toEqual(
        expect.objectContaining({ name: "Family Health" }),
      );
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.areas.create, {
          name: "Anon",
          condition: "healthy",
          icon: "HeartPulse",
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.areas.update, { id: owned.areaId, name: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.areas.remove, { id: owned.areaId }),
      ).rejects.toThrow();
    });
  });

  describe("threads", () => {
    it("hides another user's Thread from every read", async () => {
      expect(
        (await owner.query(api.threads.list, {})).map((thread) => thread._id),
      ).toEqual([owned.threadId]);
      expect(
        await owner.query(api.threads.get, { id: owned.threadId }),
      ).toEqual(expect.objectContaining({ _id: owned.threadId }));
      expect(
        await owner.query(api.threads.getBySlug, { slug: owned.threadSlug }),
      ).toEqual(expect.objectContaining({ _id: owned.threadId }));
      expect(
        await owner.query(api.threads.detailBySlug, { slug: owned.threadSlug }),
      ).toEqual(
        expect.objectContaining({
          thread: expect.objectContaining({ _id: owned.threadId }),
          area: expect.objectContaining({ _id: owned.areaId }),
        }),
      );

      expect(await intruder.query(api.threads.list, {})).toEqual([]);
      expect(
        await intruder.query(api.threads.get, { id: owned.threadId }),
      ).toBe(null);
      expect(
        await intruder.query(api.threads.getBySlug, { slug: owned.threadSlug }),
      ).toBe(null);
      expect(
        await intruder.query(api.threads.detailBySlug, {
          slug: owned.threadSlug,
        }),
      ).toBe(null);
    });

    it("refuses another user's Thread in every mutation", async () => {
      await expect(
        intruder.mutation(api.threads.update, {
          id: owned.threadId,
          title: "Stolen",
        }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.threads.remove, { id: owned.threadId }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.threads.completeNextMoveMutation, {
          id: owned.threadId,
        }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.threads.replaceUpNext, {
          id: owned.threadId,
          moves: ["Stolen"],
        }),
      ).rejects.toThrow(/Thread not found/);
    });

    it("refuses filing a Thread under another user's Area", async () => {
      await expect(
        intruder.mutation(api.threads.create, {
          title: "Squatting",
          areaId: owned.areaId,
        }),
      ).rejects.toThrow(/Area not found/);
    });

    it("refuses moving one's own Thread into another user's Area", async () => {
      const theirs = await seed(intruder);

      await expect(
        intruder.mutation(api.threads.update, {
          id: theirs.threadId,
          areaId: owned.areaId,
        }),
      ).rejects.toThrow(/Area not found/);
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.threads.create, {
          title: "Anon",
          areaId: owned.areaId,
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.update, { id: owned.threadId, title: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.remove, { id: owned.threadId }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.completeNextMoveMutation, {
          id: owned.threadId,
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.replaceUpNext, {
          id: owned.threadId,
          moves: ["Anon"],
        }),
      ).rejects.toThrow();
    });
  });

  describe("notes", () => {
    it("hides another user's Note from every read", async () => {
      await owner.mutation(api.notes.markDone, { id: owned.noteId });

      expect(
        (
          await owner.query(api.notes.listDone, {
            paginationOpts: FIRST_PAGE,
          })
        ).page.map((note) => note._id),
      ).toEqual([owned.noteId]);

      expect(
        (
          await intruder.query(api.notes.listDone, {
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([]);

      await owner.mutation(api.notes.markOpen, { id: owned.noteId });

      expect(
        (await owner.query(api.notes.list, {})).map((note) => note._id),
      ).toEqual([owned.noteId]);
      expect(await owner.query(api.notes.count, {})).toBe(1);

      expect(await intruder.query(api.notes.list, {})).toEqual([]);
      expect(await intruder.query(api.notes.count, {})).toBe(0);
    });

    it("refuses another user's Note in every mutation", async () => {
      await expect(
        intruder.mutation(api.notes.remove, { id: owned.noteId }),
      ).rejects.toThrow(/Note not found/);
      await expect(
        intruder.mutation(api.notes.updateBody, {
          id: owned.noteId,
          body: "Stolen",
        }),
      ).rejects.toThrow(/Note not found/);
      await expect(
        intruder.mutation(api.notes.updateWhen, {
          id: owned.noteId,
          when: Date.now(),
        }),
      ).rejects.toThrow(/Note not found/);
      await expect(
        intruder.mutation(api.notes.markDone, { id: owned.noteId }),
      ).rejects.toThrow(/Note not found/);
      await expect(
        intruder.mutation(api.notes.markOpen, { id: owned.noteId }),
      ).rejects.toThrow(/Note not found/);

      expect(await owner.query(api.notes.count, {})).toBe(1);
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.notes.updateWhen, { id: owned.noteId, when: 123 }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.notes.markOpen, { id: owned.noteId }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.notes.create, { body: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.notes.remove, { id: owned.noteId }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.notes.updateBody, { id: owned.noteId, body: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.notes.markDone, { id: owned.noteId }),
      ).rejects.toThrow();
    });
  });

  describe("activityLogs", () => {
    it("hides another user's Activity Log from every read", async () => {
      expect(
        (
          await owner.query(api.activityLogs.listByThread, {
            threadId: owned.threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page.map((log) => log._id),
      ).toContain(owned.logId);

      expect(
        (
          await intruder.query(api.activityLogs.listByThread, {
            threadId: owned.threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([]);
    });

    it("refuses writing to another user's Thread", async () => {
      await expect(
        intruder.mutation(api.activityLogs.create, {
          threadId: owned.threadId,
          content: "Injected",
        }),
      ).rejects.toThrow(/Thread not found/);

      const logs = await owner.query(api.activityLogs.listByThread, {
        threadId: owned.threadId,
        paginationOpts: FIRST_PAGE,
      });
      expect(logs.page.map((log) => log._id)).toContain(owned.logId);
      expect(logs.page.map((log) => log.content)).not.toContain("Injected");
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.activityLogs.create, {
          threadId: owned.threadId,
          content: "Anon",
        }),
      ).rejects.toThrow();
    });
  });

  describe("composite details", () => {
    it("shows another user nothing of the owner's data", async () => {
      const areaDetail = await owner.query(api.areas.detailBySlug, {
        slug: owned.areaSlug,
      });
      expect(areaDetail?.area._id).toBe(owned.areaId);
      expect(areaDetail?.threads.map((thread) => thread._id)).toEqual([
        owned.threadId,
      ]);

      expect(
        await intruder.query(api.areas.detailBySlug, { slug: owned.areaSlug }),
      ).toBe(null);
      expect(
        await intruder.query(api.threads.detailBySlug, {
          slug: owned.threadSlug,
        }),
      ).toBe(null);
    });

    it("shows an unauthenticated caller nothing", async () => {
      expect(
        await t.query(api.areas.detailBySlug, { slug: owned.areaSlug }),
      ).toBe(null);
      expect(
        await t.query(api.threads.detailBySlug, { slug: owned.threadSlug }),
      ).toBe(null);
    });
  });

  describe("duplicate slugs", () => {
    it("resolves an Area slug shared by two documents to the oldest", async () => {
      const ids = await t.run(async (ctx) => {
        const base = {
          userId: (await ctx.db.get("areas", owned.areaId))?.userId ?? "",
          slug: "shared-slug",
          condition: "healthy" as const,
          icon: "Compass" as const,
          createdAt: 0,
        };
        const first = await ctx.db.insert("areas", {
          ...base,
          name: "First",
          order: 10,
        });
        const second = await ctx.db.insert("areas", {
          ...base,
          name: "Second",
          order: 11,
        });
        return { first, second };
      });

      const found = await owner.query(api.areas.getBySlug, {
        slug: "shared-slug",
      });
      expect(found?._id).toBe(ids.first);
    });

    it("resolves a Thread slug shared by two documents to the oldest", async () => {
      const ids = await t.run(async (ctx) => {
        const base = {
          userId: (await ctx.db.get("threads", owned.threadId))?.userId ?? "",
          slug: "shared-slug",
          areaId: owned.areaId,
          state: "open" as const,
          createdAt: 0,
        };
        const first = await ctx.db.insert("threads", {
          ...base,
          title: "First",
          order: 10,
        });
        const second = await ctx.db.insert("threads", {
          ...base,
          title: "Second",
          order: 11,
        });
        return { first, second };
      });

      const found = await owner.query(api.threads.getBySlug, {
        slug: "shared-slug",
      });
      expect(found?._id).toBe(ids.first);
    });
  });
});
