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
  useDiscardThreadNote,
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
    cache.setQueryData(queryKeys.threadNotes.list(threadId), notes);
  };
}

describe("reading a Thread's Notes", () => {
  it("reads the Notes", async () => {
    const client = createFakeApplicationClient({
      listThreadNotes: async () => success([note]),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useThreadNotes(threadId), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([note]));
  });

  it("reads a Thread that is not there as absent", async () => {
    const client = createFakeApplicationClient({
      listThreadNotes: async () => ({
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
          queryKeys.threadNotes.list(threadId),
        )?.[0]?.body,
      ).toBe("Opens at nine"),
    );

    pending.resolve(success(stored));
    await waitFor(() =>
      expect(
        cache.getQueryData<ThreadNote[]>(queryKeys.threadNotes.list(threadId)),
      ).toEqual([stored]),
    );
  });

  it("puts the list back when the capture fails", async () => {
    const client = createFakeApplicationClient({
      createThreadNote: async () => ({ ok: false, error: unavailable }),
      listThreadNotes: async () => success([note]),
    });
    const { wrapper, cache } = createHarness(client, seedNotes([note]));
    const { result } = renderHook(() => useCaptureThreadNote(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ threadId, body: "Opens at nine" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.threadNotes.list(threadId))).toEqual([
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
          queryKeys.threadNotes.list(threadId),
        )?.[0]?.body,
      ).toBe("Eight"),
    );
  });

  it("drops a discarded Note from the list", async () => {
    const client = createFakeApplicationClient({
      removeThreadNote: async () => success({ acknowledged: true as const }),
    });
    const { wrapper, cache } = createHarness(client, seedNotes([note]));
    const { result } = renderHook(() => useDiscardThreadNote(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ threadId, threadNoteId: note._id });
    });

    expect(cache.getQueryData(queryKeys.threadNotes.list(threadId))).toEqual(
      [],
    );
  });

  it.each(["edit", "discard"] as const)(
    "puts the list back when the %s fails",
    async (operation) => {
      const pending = deferred<{ ok: false; error: ApplicationError }>();
      const client = createFakeApplicationClient({
        updateThreadNoteBody: () => pending.promise,
        removeThreadNote: () => pending.promise,
      });
      const { wrapper, cache } = createHarness(client, seedNotes([note]));
      const { result } = renderHook(
        () => ({
          edit: useUpdateThreadNoteBody(),
          discard: useDiscardThreadNote(),
        }),
        { wrapper },
      );

      act(() => {
        if (operation === "edit")
          result.current.edit.mutate({
            threadId,
            threadNoteId: note._id,
            body: "Changed",
          });
        else
          result.current.discard.mutate({ threadId, threadNoteId: note._id });
      });
      await waitFor(() =>
        expect(
          cache.getQueryData(queryKeys.threadNotes.list(threadId)),
        ).toEqual(operation === "edit" ? [{ ...note, body: "Changed" }] : []),
      );
      await act(async () => pending.resolve({ ok: false, error: unavailable }));
      await waitFor(() => expect(result.current[operation].isError).toBe(true));
      expect(cache.getQueryData(queryKeys.threadNotes.list(threadId))).toEqual([
        note,
      ]);
    },
  );
});
