import type { InfiniteData } from "@tanstack/react-query";
import type { Page } from "@vita-os/contracts";
import type { ApplicationError, Note, NoteId } from "@vita-os/contracts";

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { aNote } from "../test/fixtures";
import { createHarness } from "../test/harness";
import {
  useCaptureNote,
  useCompleteNote,
  useDiscardNote,
  useDoneNotes,
  useOpenNoteCount,
  useOpenNotes,
  useReopenNote,
  useUpdateNoteAttentionDate,
  useUpdateNoteBody,
} from "./hooks";

const note = aNote();
const older = aNote({
  _id: "note-0" as NoteId,
  body: "Older",
  createdAt: 1_000,
});
const unavailable: ApplicationError = {
  code: "unavailable",
  message: "Temporarily unavailable.",
  retryable: true,
};

function seedInbox(notes: Note[]) {
  return (cache: {
    setQueryData: (key: readonly unknown[], value: unknown) => unknown;
  }) => {
    cache.setQueryData(queryKeys.notes.open(), notes);
    cache.setQueryData(queryKeys.notes.openCount(), notes.length);
  };
}

describe("reading Notes", () => {
  it("reads the Open Notes and their count", async () => {
    const client = createFakeApplicationClient({
      listOpenNotes: async () => success([note, older]),
      countOpenNotes: async () => success(2),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(
      () => ({ notes: useOpenNotes(), count: useOpenNoteCount() }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.notes.data).toEqual([note, older]);
      expect(result.current.count.data).toBe(2);
    });
  });

  it("keeps the Done Notes already read while reading more", async () => {
    const first = aNote({
      _id: "done-1" as NoteId,
      state: "done",
      completedAt: 9,
    });
    const second = aNote({
      _id: "done-2" as NoteId,
      state: "done",
      completedAt: 8,
    });
    const client = createFakeApplicationClient({
      getDoneNotePage: async ({ cursor }) =>
        cursor === undefined
          ? success({ entries: [first], nextCursor: "page-2" })
          : success({ entries: [second] }),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useDoneNotes(1), { wrapper });

    await waitFor(() => expect(result.current.notes).toEqual([first]));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.notes).toEqual([first, second]));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useCaptureNote", () => {
  it("puts the captured Note at the top of the Inbox and counts it", async () => {
    const stored = aNote({ _id: "note-stored" as NoteId, body: "Refill" });
    const pending = deferred<ReturnType<typeof success<Note>>>();
    const client = createFakeApplicationClient({
      createNote: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedInbox([older]));
    const { result } = renderHook(() => useCaptureNote(), { wrapper });

    act(() => result.current.mutate({ body: "Refill" }));

    await waitFor(() => {
      const notes = cache.getQueryData<Note[]>(queryKeys.notes.open());
      expect(notes?.[0]?.body).toBe("Refill");
      expect(cache.getQueryData(queryKeys.notes.openCount())).toBe(2);
    });

    pending.resolve(success(stored));
    await waitFor(() =>
      expect(cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]).toEqual(
        stored,
      ),
    );
  });

  it("still counts a Note captured with the Inbox unread", async () => {
    const client = createFakeApplicationClient({
      createNote: async () => success(note),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.notes.openCount(), 4);
    });
    const { result } = renderHook(() => useCaptureNote(), { wrapper });

    act(() => result.current.mutate({ body: "Refill" }));

    await waitFor(() =>
      expect(cache.getQueryData(queryKeys.notes.openCount())).toBe(5),
    );
  });
});

describe("editing a Note", () => {
  it("rewrites the body in place", async () => {
    const pending = deferred<ReturnType<typeof success<Note>>>();
    const client = createFakeApplicationClient({
      updateNoteBody: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedInbox([note]));
    const { result } = renderHook(() => useUpdateNoteBody(), { wrapper });

    act(() => result.current.mutate({ noteId: note._id, body: "Refill both" }));

    await waitFor(() =>
      expect(
        cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]?.body,
      ).toBe("Refill both"),
    );
    pending.resolve(success({ ...note, body: "Refill both" }));
  });

  it("sets and clears the Attention Date", async () => {
    const client = createFakeApplicationClient({
      updateNoteAttentionDate: async () =>
        success({ ...note, attentionDate: 5_000 }),
    });
    const { wrapper, cache } = createHarness(client, seedInbox([note]));
    const { result } = renderHook(() => useUpdateNoteAttentionDate(), {
      wrapper,
    });

    act(() =>
      result.current.mutate({ noteId: note._id, attentionDate: 5_000 }),
    );
    await waitFor(() =>
      expect(
        cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]?.attentionDate,
      ).toBe(5_000),
    );

    act(() => result.current.mutate({ noteId: note._id, attentionDate: null }));
    await waitFor(() =>
      expect(
        cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]?.attentionDate,
      ).toBeUndefined(),
    );
  });
});

describe("completing, reopening, and discarding", () => {
  it.each([
    ["completed", true],
    ["discarded", false],
  ] as const)(
    "a %s Note leaves the Inbox and the count",
    async (_label, complete) => {
      const client = createFakeApplicationClient({
        markNoteDone: async () =>
          success({ ...note, state: "done" as const, completedAt: 9 }),
        removeNote: async () => success({ acknowledged: true as const }),
      });
      const { wrapper, cache } = createHarness(
        client,
        seedInbox([note, older]),
      );
      const { result } = renderHook(
        () => ({ complete: useCompleteNote(), discard: useDiscardNote() }),
        { wrapper },
      );

      await act(async () => {
        await (complete
          ? result.current.complete.mutateAsync({ noteId: note._id })
          : result.current.discard.mutateAsync({ noteId: note._id }));
      });

      expect(cache.getQueryData(queryKeys.notes.open())).toEqual([older]);
      expect(cache.getQueryData(queryKeys.notes.openCount())).toBe(1);
    },
  );

  it("puts a reopened Note back where the Inbox orders it", async () => {
    const done = aNote({
      _id: "note-done" as NoteId,
      state: "done",
      completedAt: 9,
      createdAt: 2_000,
    });
    const client = createFakeApplicationClient({
      markNoteOpen: async () => success({ ...done, state: "open" as const }),
    });
    const { wrapper, cache } = createHarness(client, seedInbox([note, older]));
    const { result } = renderHook(() => useReopenNote(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ note: done });
    });

    const notes = cache.getQueryData<Note[]>(queryKeys.notes.open());
    expect(notes?.map((entry) => entry._id)).toEqual([
      note._id,
      done._id,
      older._id,
    ]);
    expect(notes?.[1]).toMatchObject({ state: "open", completedAt: undefined });
  });

  it("puts the Inbox back when a completion fails", async () => {
    const client = createFakeApplicationClient({
      markNoteDone: async () => ({ ok: false, error: unavailable }),
      listOpenNotes: async () => success([note, older]),
      countOpenNotes: async () => success(2),
    });
    const { wrapper, cache } = createHarness(client, seedInbox([note, older]));
    const { result } = renderHook(() => useCompleteNote(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ noteId: note._id })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.notes.open())).toEqual([note, older]);
    expect(cache.getQueryData(queryKeys.notes.openCount())).toBe(2);
  });
});

describe("Done Note optimistic changes", () => {
  it.each(["edit", "reopen", "discard"] as const)(
    "updates cached history for %s and restores it on failure",
    async (operation) => {
      const done = aNote({ state: "done", completedAt: 5000 });
      const pending = deferred<{ ok: false; error: ApplicationError }>();
      const client = createFakeApplicationClient({
        updateNoteBody: () => pending.promise,
        markNoteOpen: () => pending.promise,
        removeNote: () => pending.promise,
      });
      const key = queryKeys.notes.done(20);
      const original = {
        pages: [{ entries: [done], nextCursor: "next-page" }],
        pageParams: [undefined],
      };
      const { cache, wrapper } = createHarness(client, (seeded) =>
        seeded.setQueryData(key, original),
      );
      const { result } = renderHook(
        () => ({
          edit: useUpdateNoteBody(),
          reopen: useReopenNote(),
          discard: useDiscardNote(),
        }),
        { wrapper },
      );
      act(() => {
        if (operation === "edit")
          result.current.edit.mutate({ noteId: done._id, body: "Changed" });
        else if (operation === "reopen")
          result.current.reopen.mutate({ note: done });
        else result.current.discard.mutate({ noteId: done._id });
      });
      await waitFor(() => {
        const entries =
          cache.getQueryData<InfiniteData<Page<Note>>>(key)?.pages[0]?.entries;
        expect(entries).toEqual(
          operation === "edit" ? [{ ...done, body: "Changed" }] : [],
        );
      });
      expect(
        cache.getQueryData<InfiniteData<Page<Note>>>(key)?.pages[0]?.nextCursor,
      ).toBe("next-page");
      await act(async () => pending.resolve({ ok: false, error: unavailable }));
      await waitFor(() => expect(result.current[operation].isError).toBe(true));
      expect(cache.getQueryData(key)).toEqual(original);
    },
  );
});
