import { describe, expect, it } from "vitest";

import type {
  ApplicationClient,
  AreaId,
  TaskId,
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
  tasks: [{ _id: "task-1" as TaskId, text: "Call clinic" }],
  focusedTaskId: "task-1" as TaskId,
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
  listResolvedThreads: async () => ({ ok: true, value: [] }),
  getThreadDetail: async () => ({ ok: true, value: { thread, area } }),
  createThread: async () => ({ ok: true, value: thread }),
  updateThread: async () => ({ ok: true, value: thread }),
  removeThread: async () => ({ ok: true, value: commandAcknowledged }),
  addTask: async (input) => ({
    ok: true,
    value: {
      ...thread,
      tasks: [...thread.tasks, { _id: input.taskId, text: input.text }],
    },
  }),
  editTask: async () => ({ ok: true, value: thread }),
  removeTask: async () => ({ ok: true, value: thread }),
  completeTask: async () => ({
    ok: true,
    value: { ...thread, tasks: [], focusedTaskId: undefined },
  }),
  focusTask: async (input) => ({
    ok: true,
    value:
      input.taskId === null
        ? { ...thread, focusedTaskId: undefined }
        : { ...thread, focusedTaskId: input.taskId },
  }),

  setTaskDate: async () => ({ ok: true, value: thread }),

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
  updateNoteFollowUp: async (input) => ({
    ok: true,
    value: {
      ...note,
      ...(input.followUp === null ? {} : { followUp: input.followUp }),
    },
  }),
  markNoteDone: async () => ({
    ok: true,
    value: { ...note, state: "done" as const, completedAt: 9 },
  }),
  markNoteOpen: async () => ({ ok: true, value: note }),
  removeNote: async () => ({ ok: true, value: commandAcknowledged }),
  addNoteToThread: async () => ({ ok: true, value: { thread, threadNote } }),
  createThreadFromNote: async () => ({
    ok: true,
    value: { thread, threadNote },
  }),

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
      client.addTask({
        threadId: thread._id,
        taskId: "task-2" as TaskId,
        text: "Book slot",
        expectedRevision: 3,
      }),
    ).resolves.toEqual({
      ok: true,
      value: {
        ...thread,
        tasks: [...thread.tasks, { _id: "task-2", text: "Book slot" }],
      },
    });

    await expect(
      contract.focusTask({
        threadId: thread._id,
        taskId: null,
        expectedRevision: 3,
      }),
    ).resolves.toEqual({
      ok: true,
      value: { ...thread, focusedTaskId: undefined },
    });
  });

  it("spells clearing an optional value as null", async () => {
    await expect(
      client.updateNoteFollowUp({ noteId: note._id, followUp: null }),
    ).resolves.toEqual({ ok: true, value: note });

    await expect(
      client.updateNoteFollowUp({ noteId: note._id, followUp: 12 }),
    ).resolves.toEqual({ ok: true, value: { ...note, followUp: 12 } });
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
