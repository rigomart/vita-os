import { describe, expect, it } from "vitest";

import type {
  ApplicationClient,
  AreaId,
  NoteId,
  ThreadId,
  ThreadNoteId,
} from "./index";

import { commandAcknowledged, isApplicationError } from "./index";

const area = {
  _id: "area-1" as AreaId,
  name: "Health",
  slug: "health-0011aabb",
  icon: "HeartPulse" as const,
  order: 0,
  createdAt: 1,
};

const thread = {
  _id: "thread-1" as ThreadId,
  title: "Annual checkup",
  slug: "annual-checkup-0011aabb",
  areaId: area._id,
  order: 0,
  state: "open" as const,
  nextMove: "Call clinic",
  createdAt: 2,
  revision: 3,
};

const note = {
  _id: "note-1" as NoteId,
  body: "Refill prescription",
  state: "open" as const,
  createdAt: 3,
};

const threadNote = {
  _id: "thread-note-1" as ThreadNoteId,
  body: "Clinic opens at nine",
  state: "open" as const,
  createdAt: 4,
  updatedAt: 4,
};

/**
 * One complete client. `satisfies` is the assertion: an operation missing from
 * the contract, or one whose input or output drifts, fails to compile here.
 */
const client = {
  listAreas: async () => ({ ok: true, value: [area] }),
  createArea: async () => ({ ok: true, value: area }),
  updateArea: async (input) => ({
    ok: true,
    value: {
      ...area,
      ...(input.name === undefined ? {} : { name: input.name }),
    },
  }),
  reorderAreas: async () => ({ ok: true, value: [area] }),
  removeArea: async () => ({ ok: true, value: commandAcknowledged }),

  listOpenThreads: async () => ({ ok: true, value: [thread] }),
  getThreadDetail: async () => ({ ok: true, value: { thread, area } }),
  createThread: async () => ({ ok: true, value: thread }),
  updateThread: async () => ({ ok: true, value: thread }),
  removeThread: async () => ({ ok: true, value: commandAcknowledged }),
  replaceUpNext: async (input) => ({
    ok: true,
    value: { ...thread, upNext: input.moves },
  }),
  completeNextMove: async (input) => ({
    ok: true,
    value:
      input.expectedNextMove === null
        ? { status: "unchanged" as const }
        : { status: "completed" as const },
  }),

  getThreadActivityPage: async () => ({
    ok: true,
    value: { entries: [], nextCursor: "cursor-2" },
  }),

  listOpenNotes: async () => ({ ok: true, value: [note] }),
  getDoneNotePage: async () => ({ ok: true, value: { entries: [] } }),
  countOpenNotes: async () => ({ ok: true, value: 1 }),
  createNote: async (input) => ({
    ok: true,
    value: { ...note, body: input.body },
  }),
  updateNoteBody: async () => ({ ok: true, value: note }),
  updateNoteAttentionDate: async (input) => ({
    ok: true,
    value: {
      ...note,
      ...(input.attentionDate === null
        ? {}
        : { attentionDate: input.attentionDate }),
    },
  }),
  markNoteDone: async () => ({
    ok: true,
    value: { ...note, state: "done" as const, completedAt: 9 },
  }),
  markNoteOpen: async () => ({ ok: true, value: note }),
  removeNote: async () => ({ ok: true, value: commandAcknowledged }),

  listOpenThreadNotes: async () => ({ ok: true, value: [threadNote] }),
  getDoneThreadNotePage: async () => ({ ok: true, value: { entries: [] } }),
  createThreadNote: async () => ({ ok: true, value: threadNote }),
  updateThreadNoteBody: async () => ({ ok: true, value: threadNote }),
  markThreadNoteDone: async () => ({
    ok: true,
    value: { ...threadNote, state: "done" as const, completedAt: 9 },
  }),
  markThreadNoteOpen: async () => ({ ok: true, value: threadNote }),
  removeThreadNote: async () => ({ ok: true, value: commandAcknowledged }),
} satisfies ApplicationClient;

/**
 * The same client seen through the contract. `satisfies` proves the literal
 * fits; calling through this reference proves each operation is reachable with
 * the input the contract declares, which a zero-argument stub would otherwise
 * hide.
 */
const contract: ApplicationClient = client;

describe("the application contract", () => {
  it("names each workflow as one asynchronous operation", async () => {
    await expect(
      client.completeNextMove({
        threadId: thread._id,
        expectedNextMove: "Call clinic",
        expectedRevision: 3,
      }),
    ).resolves.toEqual({ ok: true, value: { status: "completed" } });

    await expect(
      client.replaceUpNext({ threadId: thread._id, moves: ["Book slot"] }),
    ).resolves.toEqual({
      ok: true,
      value: { ...thread, upNext: ["Book slot"] },
    });
  });

  it("spells clearing an optional value as null", async () => {
    await expect(
      client.updateNoteAttentionDate({ noteId: note._id, attentionDate: null }),
    ).resolves.toEqual({ ok: true, value: note });

    await expect(
      client.updateNoteAttentionDate({ noteId: note._id, attentionDate: 12 }),
    ).resolves.toEqual({ ok: true, value: { ...note, attentionDate: 12 } });
  });

  it("acknowledges commands that hand nothing back", async () => {
    await expect(contract.removeArea({ areaId: area._id })).resolves.toEqual({
      ok: true,
      value: { acknowledged: true },
    });
  });

  it("recognizes only complete stable application errors", () => {
    expect(
      isApplicationError({
        code: "not_found",
        message: "Thread not found.",
        retryable: false,
      }),
    ).toBe(true);
    expect(
      isApplicationError({ code: "teapot", message: "", retryable: false }),
    ).toBe(false);
    expect(isApplicationError({ code: "not_found", message: "x" })).toBe(false);
    expect(isApplicationError(null)).toBe(false);
  });
});
