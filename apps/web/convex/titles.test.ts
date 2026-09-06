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
  });

  describe("Note body", () => {
    const openNoteTexts = async () =>
      (await owner.query(api.notes.list, {})).map((note) => note.body);

    it.each(BLANK)("is refused on create: %j", async (body) => {
      await expect(owner.mutation(api.notes.create, { body })).rejects.toThrow(
        "Note body cannot be empty",
      );
    });

    it.each(BLANK)("is refused on edit: %j", async (body) => {
      await expect(
        owner.mutation(api.notes.updateBody, { id: owned.noteId, body }),
      ).rejects.toThrow("Note body cannot be empty");
    });

    it("is stored trimmed on create", async () => {
      await owner.mutation(api.notes.create, { body: "  Buy vitamins  " });

      expect(await openNoteTexts()).toContain("Buy vitamins");
    });

    it("is stored trimmed on edit", async () => {
      await owner.mutation(api.notes.updateBody, {
        id: owned.noteId,
        body: "  Buy vitamins  ",
      });

      expect(await openNoteTexts()).toContain("Buy vitamins");
    });
  });
});
