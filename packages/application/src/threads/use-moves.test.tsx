import type {
  ApplicationClient,
  MoveId,
  OperationResult,
  Thread,
  ThreadDetail,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  failure,
  success,
} from "../test/fake-application-client";
import { anArea, aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import { useCompleteMove, useMoves } from "./use-moves";

const callClinic = { _id: "move-1" as MoveId, text: "Call clinic" };
const bookSlot = { _id: "move-2" as MoveId, text: "Book slot" };
const thread = aThread({
  moves: [callClinic, bookSlot],
  focusedMoveId: callClinic._id,
  revision: 4,
});

function render<T>(client: ApplicationClient, hook: () => T) {
  const feedback = {
    success: vi.fn(),
    error: vi.fn(),
    undoable: vi.fn(async () => true),
  };
  const { cache, wrapper: application } = createHarness(client, (cache) => {
    cache.setQueryData(queryKeys.threads.open(), [thread]);
    cache.setQueryData<ThreadDetail>(queryKeys.threads.detail(thread.slug), {
      thread,
      area: anArea(),
    });
  });
  const Application = application;
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  const { result } = renderHook(hook, { wrapper });
  return { cache, feedback, result };
}

function shown(cache: ReturnType<typeof render>["cache"]) {
  return {
    open: cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0],
    rail: cache.getQueryData<ThreadDetail>(
      queryKeys.threads.detail(thread.slug),
    )?.thread,
  };
}

describe("useCompleteMove", () => {
  it("takes the Move off every read at once, and completing the Focused Move leaves the Thread unfocused", async () => {
    const pending = deferred<OperationResult<Thread>>();
    const completeMove = vi.fn(() => pending.promise);
    const { cache, result } = render(
      createFakeApplicationClient({ completeMove }),
      () => useCompleteMove(thread),
    );

    act(() => {
      void result.current(callClinic._id);
    });

    await waitFor(() => {
      const { open, rail } = shown(cache);
      expect(open?.moves).toEqual([bookSlot]);
      expect(open).not.toHaveProperty("focusedMoveId");
      expect(rail?.moves).toEqual([bookSlot]);
      expect(rail).not.toHaveProperty("focusedMoveId");
    });
    expect(completeMove).toHaveBeenCalledWith({
      threadId: thread._id,
      moveId: callClinic._id,
      expectedRevision: 4,
    });

    await act(async () => {
      pending.resolve(
        success({
          ...thread,
          moves: [bookSlot],
          focusedMoveId: undefined,
          revision: 5,
          lastActivityContent: 'Completed "Call clinic"',
        }),
      );
      await pending.promise;
    });
    await waitFor(() => expect(shown(cache).open?.revision).toBe(5));
  });

  it("rolls a refused completion back and says why", async () => {
    const { cache, feedback, result } = render(
      createFakeApplicationClient({
        completeMove: async () =>
          failure({
            code: "conflict",
            message: "The Thread's Moves have changed.",
            retryable: false,
          }),
        listOpenThreads: async () => success([thread]),
        getThreadDetail: async () => success({ thread, area: anArea() }),
        getThreadActivityPage: async () => success({ entries: [] }),
      }),
      () => useCompleteMove(thread),
    );

    await act(async () => {
      await result.current(bookSlot._id);
    });

    expect(shown(cache).open?.moves).toEqual([callClinic, bookSlot]);
    expect(shown(cache).rail?.focusedMoveId).toBe(callClinic._id);
    expect(feedback.error).toHaveBeenCalledWith(
      "This Thread changed elsewhere. It has been refreshed.",
    );
  });
});

describe("useMoves", () => {
  it("focuses and unfocuses without reordering the list", async () => {
    const focusMove = vi.fn(
      async (input: { moveId: MoveId | null; expectedRevision: number }) =>
        success({
          ...thread,
          ...(input.moveId === null
            ? { focusedMoveId: undefined }
            : { focusedMoveId: input.moveId }),
          revision: input.expectedRevision + 1,
        }),
    );
    const { cache, result } = render(
      createFakeApplicationClient({ focusMove }),
      () => useMoves(thread),
    );

    await act(async () => {
      await result.current.focus(bookSlot._id);
    });
    expect(shown(cache).open?.focusedMoveId).toBe(bookSlot._id);
    expect(shown(cache).open?.moves).toEqual([callClinic, bookSlot]);

    await act(async () => {
      await result.current.focus(null);
    });
    expect(shown(cache).rail).not.toHaveProperty("focusedMoveId");
    expect(focusMove).toHaveBeenLastCalledWith({
      threadId: thread._id,
      moveId: null,
      expectedRevision: 5,
    });
  });

  it("removes the Focused Move and clears the focus", async () => {
    const pending = deferred<OperationResult<Thread>>();
    const { cache, result } = render(
      createFakeApplicationClient({ removeMove: () => pending.promise }),
      () => useMoves(thread),
    );

    act(() => {
      void result.current.remove(callClinic._id);
    });

    await waitFor(() => {
      expect(shown(cache).rail?.moves).toEqual([bookSlot]);
      expect(shown(cache).rail).not.toHaveProperty("focusedMoveId");
    });
    pending.resolve(success({ ...thread, moves: [bookSlot], revision: 5 }));
  });

  it("queues commands for one Thread, each carrying the revision the one before brought back", async () => {
    const added = deferred<OperationResult<Thread>>();
    const addMove = vi.fn(() => added.promise);
    const completeMove = vi.fn(
      async (input: { moveId: MoveId; expectedRevision: number }) =>
        success({
          ...thread,
          moves: [bookSlot],
          focusedMoveId: undefined,
          revision: input.expectedRevision + 1,
        }),
    );
    const { cache, result } = render(
      createFakeApplicationClient({ addMove, completeMove }),
      () => useMoves(thread),
    );

    act(() => {
      void result.current.add("  Pay the bill  ");
      void result.current.complete(callClinic._id);
    });

    // Both changes show at once, but only the first has reached the service.
    await waitFor(() =>
      expect(shown(cache).open?.moves?.map((move) => move.text)).toEqual([
        "Book slot",
        "Pay the bill",
      ]),
    );
    expect(addMove).toHaveBeenCalledTimes(1);
    expect(completeMove).not.toHaveBeenCalled();
    const newMove = shown(cache).open?.moves?.[1];
    expect(addMove).toHaveBeenCalledWith({
      threadId: thread._id,
      moveId: newMove?._id,
      text: "Pay the bill",
      expectedRevision: 4,
    });

    await act(async () => {
      added.resolve(
        success({
          ...thread,
          moves: [callClinic, bookSlot, newMove!],
          revision: 5,
        }),
      );
      await added.promise;
    });

    await waitFor(() =>
      expect(completeMove).toHaveBeenCalledWith({
        threadId: thread._id,
        moveId: callClinic._id,
        expectedRevision: 5,
      }),
    );
  });

  it("captures nothing blank", async () => {
    const addMove = vi.fn();
    const { result } = render(createFakeApplicationClient({ addMove }), () =>
      useMoves(thread),
    );

    await act(async () => {
      await result.current.add("   ");
    });

    expect(addMove).not.toHaveBeenCalled();
  });
});
