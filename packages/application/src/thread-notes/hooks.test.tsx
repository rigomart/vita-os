import type {
  ApplicationError,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { aThreadNote } from "../test/fixtures";
import { createHarness } from "../test/harness";
import {
  useCaptureThreadNote,
  useCompleteThreadNote,
  useDiscardThreadNote,
  useDoneThreadNotes,
  useReopenThreadNote,
  useThreadNotes,
  useUpdateThreadNoteBody,
} from "./hooks";

const threadId = "thread-1" as ThreadId;
const note = aThreadNote();
const unavailable: ApplicationError = {
  code: "unavailable",
  message: "Temporarily unavailable.",
  retryable: true,
};

function seedNotes(notes: ThreadNote[]) {
  return (cache: {
    setQueryData: (key: readonly unknown[], value: unknown) => unknown;
  }) => {
    cache.setQueryData(queryKeys.threadNotes.open(threadId), notes);
  };
}

describe("reading a Thread's Notes", () => {
  it("reads the Open Notes", async () => {
    const client = createFakeApplicationClient({
      listOpenThreadNotes: async () => success([note]),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useThreadNotes(threadId), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([note]));
  });

  it("reads a Thread that is not there as absent", async () => {
    const client = createFakeApplicationClient({
      listOpenThreadNotes: async () => ({
        ok: false,
        error: {
          code: "not_found" as const,
          message: "Thread not found.",
          retryable: false,
        },
      }),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useThreadNotes(threadId), { wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it("keeps the Done Notes already read while reading more", async () => {
    const first = aThreadNote({
      _id: "done-1" as ThreadNoteId,
      state: "done",
      completedAt: 9,
    });
    const second = aThreadNote({
      _id: "done-2" as ThreadNoteId,
      state: "done",
      completedAt: 8,
    });
    const client = createFakeApplicationClient({
      getDoneThreadNotePage: async ({ cursor }) =>
        cursor === undefined
          ? success({ entries: [first], nextCursor: "page-2" })
          : success({ entries: [second] }),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useDoneThreadNotes(threadId, 1), {
      wrapper,
    });

    await waitFor(() => expect(result.current.notes).toEqual([first]));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.notes).toEqual([first, second]));
  });
});

describe("capturing a Thread Note", () => {
  it("shows it immediately, then replaces it with the stored one", async () => {
    const stored = aThreadNote({ _id: "stored" as ThreadNoteId });
    const pending = deferred<ReturnType<typeof success<ThreadNote>>>();
    const client = createFakeApplicationClient({
      createThreadNote: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedNotes([]));
    const { result } = renderHook(() => useCaptureThreadNote(), { wrapper });

    act(() => result.current.mutate({ threadId, body: "Opens at nine" }));

    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadNote[]>(
          queryKeys.threadNotes.open(threadId),
        )?.[0]?.body,
      ).toBe("Opens at nine"),
    );

    pending.resolve(success(stored));
    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadNote[]>(queryKeys.threadNotes.open(threadId)),
      ).toEqual([stored]),
    );
  });

  it("puts the list back when the capture fails", async () => {
    const client = createFakeApplicationClient({
      createThreadNote: async () => ({ ok: false, error: unavailable }),
      listOpenThreadNotes: async () => success([note]),
    });
    const { wrapper, cache } = createHarness(client, seedNotes([note]));
    const { result } = renderHook(() => useCaptureThreadNote(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ threadId, body: "Opens at nine" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.threadNotes.open(threadId))).toEqual([
      note,
    ]);
  });
});

describe("changing a Thread Note", () => {
  it("rewrites the body in place", async () => {
    const client = createFakeApplicationClient({
      updateThreadNoteBody: async () => success({ ...note, body: "Eight" }),
    });
    const { wrapper, cache } = createHarness(client, seedNotes([note]));
    const { result } = renderHook(() => useUpdateThreadNoteBody(), { wrapper });

    act(() =>
      result.current.mutate({
        threadId,
        threadNoteId: note._id,
        body: "Eight",
      }),
    );

    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadNote[]>(
          queryKeys.threadNotes.open(threadId),
        )?.[0]?.body,
      ).toBe("Eight"),
    );
  });

  it.each([
    ["completed", true],
    ["discarded", false],
  ] as const)("a %s Note leaves the open list", async (_label, complete) => {
    const client = createFakeApplicationClient({
      markThreadNoteDone: async () =>
        success({ ...note, state: "done" as const, completedAt: 9 }),
      removeThreadNote: async () => success({ acknowledged: true as const }),
    });
    const { wrapper, cache } = createHarness(client, seedNotes([note]));
    const { result } = renderHook(
      () => ({
        complete: useCompleteThreadNote(),
        discard: useDiscardThreadNote(),
      }),
      { wrapper },
    );

    await act(async () => {
      await (complete
        ? result.current.complete.mutateAsync({
            threadId,
            threadNoteId: note._id,
          })
        : result.current.discard.mutateAsync({
            threadId,
            threadNoteId: note._id,
          }));
    });

    expect(cache.getQueryData(queryKeys.threadNotes.open(threadId))).toEqual(
      [],
    );
  });

  it("puts a reopened Note back on the open list", async () => {
    const done = aThreadNote({
      _id: "done-1" as ThreadNoteId,
      state: "done",
      completedAt: 9,
    });
    const client = createFakeApplicationClient({
      markThreadNoteOpen: async () =>
        success({ ...done, state: "open" as const }),
    });
    const { wrapper, cache } = createHarness(client, seedNotes([note]));
    const { result } = renderHook(() => useReopenThreadNote(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ threadId, note: done });
    });

    const notes = cache.getQueryData<ThreadNote[]>(
      queryKeys.threadNotes.open(threadId),
    );
    expect(notes?.map((entry) => entry._id)).toEqual([done._id, note._id]);
    expect(notes?.[0]).toMatchObject({ state: "open", completedAt: undefined });
  });
});
