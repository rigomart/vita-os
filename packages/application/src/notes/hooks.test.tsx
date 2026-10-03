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
  useArchivedNotes,
  useArchiveNote,
  useCaptureNote,
  useDiscardNote,
  useOpenNotes,
  useUnarchiveNote,
  useUpdateNoteFollowUp,
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

function seedOpenNotes(notes: Note[]) {
  return (cache: {
    setQueryData: (key: readonly unknown[], value: unknown) => unknown;
  }) => {
    cache.setQueryData(queryKeys.notes.open(), notes);
  };
}

describe("reading Notes", () => {
  it("reads the Open Notes", async () => {
    const client = createFakeApplicationClient({
      listOpenNotes: async () => success([note, older]),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useOpenNotes(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([note, older]));
  });

  it("searches Archived Notes on the service, within its bounds", async () => {
    const match = aNote({
      _id: "archived-1" as NoteId,
      state: "done",
      completedAt: 9,
    });
    const requests: unknown[] = [];
    const client = createFakeApplicationClient({
      getDoneNotePage: async (request) => {
        requests.push(request);
        return success({ entries: [match] });
      },
    });
    const { wrapper } = createHarness(client);

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useArchivedNotes({ query, limit: 5 }),
      { wrapper, initialProps: { query: "" } },
    );
    await waitFor(() => expect(result.current.notes).toEqual([match]));
    rerender({ query: "  milk   eggs a b c d e f g h " });
    await waitFor(() => expect(requests).toHaveLength(2));

    expect(requests).toEqual([
      { limit: 5 },
      { limit: 5, query: "milk eggs a b c d e f" },
    ]);
  });

  it("reads nothing until History asks", async () => {
    let calls = 0;
    const client = createFakeApplicationClient({
      getDoneNotePage: async () => {
        calls += 1;
        return success({ entries: [] });
      },
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useArchivedNotes({ enabled: false }), {
      wrapper,
    });

    expect(result.current.notes).toEqual([]);
    expect(calls).toBe(0);
  });

  it("keeps the Archived Notes already read while reading more", async () => {
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

    const { result } = renderHook(() => useArchivedNotes({ limit: 1 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.notes).toEqual([first]));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.notes).toEqual([first, second]));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useCaptureNote", () => {
  it("puts the captured Note at the top of the Open Notes", async () => {
    const stored = aNote({ _id: "note-stored" as NoteId, body: "Refill" });
    const pending = deferred<ReturnType<typeof success<Note>>>();
    const client = createFakeApplicationClient({
      createNote: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedOpenNotes([older]));
    const { result } = renderHook(() => useCaptureNote(), { wrapper });

    act(() => result.current.mutate({ body: "Refill" }));

    await waitFor(() => {
      const notes = cache.getQueryData<Note[]>(queryKeys.notes.open());
      expect(notes?.map((entry) => entry.body)).toEqual(["Refill", "Older"]);
    });

    pending.resolve(success(stored));
    await waitFor(() =>
      expect(cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]).toEqual(
        stored,
      ),
    );
  });
});

describe("editing a Note", () => {
  it("rewrites the body in place", async () => {
    const pending = deferred<ReturnType<typeof success<Note>>>();
    const client = createFakeApplicationClient({
      updateNoteBody: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, seedOpenNotes([note]));
    const { result } = renderHook(() => useUpdateNoteBody(), { wrapper });

    act(() => result.current.mutate({ noteId: note._id, body: "Refill both" }));

    await waitFor(() =>
      expect(
        cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]?.body,
      ).toBe("Refill both"),
    );
    pending.resolve(success({ ...note, body: "Refill both" }));
  });

  it("sets and clears the Follow-up date", async () => {
    const client = createFakeApplicationClient({
      updateNoteFollowUp: async () => success({ ...note, followUp: 5_000 }),
    });
    const { wrapper, cache } = createHarness(client, seedOpenNotes([note]));
    const { result } = renderHook(() => useUpdateNoteFollowUp(), {
      wrapper,
    });

    act(() => result.current.mutate({ noteId: note._id, followUp: 5_000 }));
    await waitFor(() =>
      expect(
        cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]?.followUp,
      ).toBe(5_000),
    );

    act(() => result.current.mutate({ noteId: note._id, followUp: null }));
    await waitFor(() =>
      expect(
        cache.getQueryData<Note[]>(queryKeys.notes.open())?.[0]?.followUp,
      ).toBeUndefined(),
    );
  });
});

describe("archiving, unarchiving, and discarding", () => {
  it.each([
    ["an archived", true],
    ["a discarded", false],
  ] as const)("%s Note leaves the Open Notes", async (_label, archive) => {
    const client = createFakeApplicationClient({
      markNoteDone: async () =>
        success({ ...note, state: "done" as const, completedAt: 9 }),
      removeNote: async () => success({ acknowledged: true as const }),
    });
    const { wrapper, cache } = createHarness(
      client,
      seedOpenNotes([note, older]),
    );
    const { result } = renderHook(
      () => ({ archive: useArchiveNote(), discard: useDiscardNote() }),
      { wrapper },
    );

    await act(async () => {
      await (archive
        ? result.current.archive.mutateAsync({ noteId: note._id })
        : result.current.discard.mutateAsync({ noteId: note._id }));
    });

    expect(cache.getQueryData(queryKeys.notes.open())).toEqual([older]);
  });

  it("puts an unarchived Note back in creation order", async () => {
    const done = aNote({
      _id: "note-done" as NoteId,
      state: "done",
      completedAt: 9,
      createdAt: 2_000,
    });
    const client = createFakeApplicationClient({
      markNoteOpen: async () => success({ ...done, state: "open" as const }),
    });
    const { wrapper, cache } = createHarness(
      client,
      seedOpenNotes([note, older]),
    );
    const { result } = renderHook(() => useUnarchiveNote(), { wrapper });

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

  it("puts the Open Notes back when archiving fails", async () => {
    const client = createFakeApplicationClient({
      markNoteDone: async () => ({ ok: false, error: unavailable }),
      listOpenNotes: async () => success([note, older]),
    });
    const { wrapper, cache } = createHarness(
      client,
      seedOpenNotes([note, older]),
    );
    const { result } = renderHook(() => useArchiveNote(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ noteId: note._id })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.notes.open())).toEqual([note, older]);
  });
});

describe("Archived Note optimistic changes", () => {
  it.each(["edit", "unarchive", "discard"] as const)(
    "updates cached history for %s and restores it on failure",
    async (operation) => {
      const done = aNote({ state: "done", completedAt: 5000 });
      const pending = deferred<{ ok: false; error: ApplicationError }>();
      const client = createFakeApplicationClient({
        updateNoteBody: () => pending.promise,
        markNoteOpen: () => pending.promise,
        removeNote: () => pending.promise,
      });
      const key = queryKeys.notes.done(20, "milk");
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
          unarchive: useUnarchiveNote(),
          discard: useDiscardNote(),
        }),
        { wrapper },
      );
      act(() => {
        if (operation === "edit")
          result.current.edit.mutate({ noteId: done._id, body: "Changed" });
        else if (operation === "unarchive")
          result.current.unarchive.mutate({ note: done });
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
