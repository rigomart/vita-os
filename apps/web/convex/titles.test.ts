import { beforeEach, describe, expect, it } from "vitest";

import type { Fixture, SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { seed, setupTest, signIn } from "./test.helpers";

/**
 * Every surface that names something rejects a blank name and stores the
 * trimmed one. These run through `api.*` rather than against
 * `lib/validation` directly, because what matters is that no mutation was
 * left out — `lib/validation.test.ts` already covers the rule itself.
 */

const BLANK = ["", "   ", "\t", "\n", " \t\n "];

/** `generateSlug` appends 8 random hex characters to the slugified name. */
const slugFor = (base: string) => new RegExp(`^${base}-[0-9a-f]{8}$`);

describe("titles", () => {
  let t: TestApi;
  let owner: SignedIn;
  let owned: Fixture;

  beforeEach(async () => {
    t = setupTest();
    owner = await signIn(t, "owner@example.com");
    owned = await seed(owner);
  });

  describe("Area name", () => {
    it.each(BLANK)("is refused on create: %j", async (name) => {
      await expect(
        owner.mutation(api.areas.create, {
          name,
          condition: "healthy",
          icon: "HeartPulse",
        }),
      ).rejects.toThrow("Area name cannot be empty");
    });

    it.each(BLANK)("is refused on rename: %j", async (name) => {
      await expect(
        owner.mutation(api.areas.update, { id: owned.areaId, name }),
      ).rejects.toThrow("Area name cannot be empty");
    });

    it("is stored trimmed on create, and slugged from the trimmed name", async () => {
      const created = await owner.mutation(api.areas.create, {
        name: "  Deep Work  ",
        condition: "healthy",
        icon: "HeartPulse",
      });

      const area = await owner.query(api.areas.get, { id: created.id });
      expect(area?.name).toBe("Deep Work");
      expect(area?.slug).toMatch(slugFor("deep-work"));
      expect(created.slug).toBe(area?.slug);
    });

    it("is stored trimmed on rename", async () => {
      const { slug } = await owner.mutation(api.areas.update, {
        id: owned.areaId,
        name: "  Deep Work  ",
      });

      const area = await owner.query(api.areas.get, { id: owned.areaId });
      expect(area?.name).toBe("Deep Work");
      expect(area?.slug).toMatch(slugFor("deep-work"));
      expect(slug).toBe(area?.slug);
    });

    it("still refuses a reserved name that only trimming reveals", async () => {
      await expect(
        owner.mutation(api.areas.create, {
          name: "  Settings  ",
          condition: "healthy",
          icon: "HeartPulse",
        }),
      ).rejects.toThrow('"Settings" is reserved');
    });
  });

  describe("Thread title", () => {
    it.each(BLANK)("is refused on create: %j", async (title) => {
      await expect(
        owner.mutation(api.threads.create, { title, areaId: owned.areaId }),
      ).rejects.toThrow("Thread title cannot be empty");
    });

    it.each(BLANK)("is refused on rename: %j", async (title) => {
      await expect(
        owner.mutation(api.threads.update, { id: owned.threadId, title }),
      ).rejects.toThrow("Thread title cannot be empty");
    });

    it("is stored trimmed on create, and slugged from the trimmed title", async () => {
      const created = await owner.mutation(api.threads.create, {
        title: "  Renew passport  ",
        areaId: owned.areaId,
      });

      const thread = await owner.query(api.threads.get, { id: created.id });
      expect(thread?.title).toBe("Renew passport");
      expect(thread?.slug).toMatch(slugFor("renew-passport"));
      expect(created.slug).toBe(thread?.slug);
    });

    it("is stored trimmed on rename", async () => {
      const { slug } = await owner.mutation(api.threads.update, {
        id: owned.threadId,
        title: "  Renew passport  ",
      });

      const thread = await owner.query(api.threads.get, {
        id: owned.threadId,
      });
      expect(thread?.title).toBe("Renew passport");
      expect(thread?.slug).toMatch(slugFor("renew-passport"));
      expect(slug).toBe(thread?.slug);
    });

    it.each(BLANK)(
      "is refused when an Inbox Task becomes a Thread: %j",
      async (title) => {
        await expect(
          owner.mutation(api.tasks.process, {
            id: owned.taskId,
            action: { type: "create_thread", title, areaId: owned.areaId },
          }),
        ).rejects.toThrow("Thread title cannot be empty");
      },
    );

    it("is stored trimmed when an Inbox Task becomes a Thread", async () => {
      const result = await owner.mutation(api.tasks.process, {
        id: owned.taskId,
        action: {
          type: "create_thread",
          title: "  Renew passport  ",
          areaId: owned.areaId,
        },
      });

      if (result.type !== "created") {
        throw new Error(`Expected a created Thread, got "${result.type}"`);
      }
      expect(result.slug).toMatch(slugFor("renew-passport"));

      const thread = await owner.query(api.threads.getBySlug, {
        slug: result.slug,
      });
      expect(thread?.title).toBe("Renew passport");
    });
  });

  describe("Task text", () => {
    const openTaskTexts = async () =>
      (await owner.query(api.tasks.list, {})).map((task) => task.text);

    it.each(BLANK)("is refused on create: %j", async (text) => {
      await expect(owner.mutation(api.tasks.create, { text })).rejects.toThrow(
        "Task text cannot be empty",
      );
    });

    it.each(BLANK)("is refused on edit: %j", async (text) => {
      await expect(
        owner.mutation(api.tasks.updateText, { id: owned.taskId, text }),
      ).rejects.toThrow("Task text cannot be empty");
    });

    it("is stored trimmed on create", async () => {
      await owner.mutation(api.tasks.create, { text: "  Buy vitamins  " });

      expect(await openTaskTexts()).toContain("Buy vitamins");
    });

    it("is stored trimmed on edit", async () => {
      await owner.mutation(api.tasks.updateText, {
        id: owned.taskId,
        text: "  Buy vitamins  ",
      });

      expect(await openTaskTexts()).toContain("Buy vitamins");
    });
  });
});
