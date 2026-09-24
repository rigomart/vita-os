import { QueryObserver } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  renderHook,
} from "../test/render-with-providers";
import { useApplicationMutation } from "./use-application-mutation";

function deferred() {
  let resolve!: (value: { ok: true; value: string }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ ok: true; value: string }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const key = ["concurrent-edit"];

function setup() {
  const cache = createTestQueryClient();
  cache.setQueryData(key, [
    { _id: "a", body: "original" },
    { _id: "b", body: "original" },
  ]);
  const requests = [deferred(), deferred()];
  const { result } = renderHook(
    () =>
      useApplicationMutation({
        run: (_client, input: { index: number; id: string; body: string }) =>
          requests[input.index]!.promise,
        affected: () => [key],
        optimistic: (client, input) =>
          client.setQueryData<Array<{ _id: string; body: string }>>(
            key,
            (rows) =>
              rows?.map((row) =>
                row._id === input.id ? { ...row, body: input.body } : row,
              ),
          ),
      }),
    { queryClient: cache },
  );
  return { cache, requests, result };
}

describe("concurrent application commands", () => {
  it("keeps pending IDs stable across replay and reconciles the server result", async () => {
    const cache = createTestQueryClient();
    cache.setQueryData<string[]>(key, []);
    const requests = [deferred(), deferred()];
    let sequence = 0;
    const { result } = renderHook(
      () =>
        useApplicationMutation<number, string, string>({
          run: (_client, index) => requests[index]!.promise,
          affected: () => [key],
          optimistic: (client, _index, previousLocal) => {
            const id = previousLocal ?? `pending-${++sequence}`;
            client.setQueryData<string[]>(key, (rows) => [...(rows ?? []), id]);
            return id;
          },
          reconcile: (client, value, _index, id) => {
            client.setQueryData<string[]>(key, (rows) =>
              rows?.map((row) => (row === id ? value : row)),
            );
          },
        }),
      { queryClient: cache },
    );
    act(() => result.current.mutate(0));
    await waitFor(() => expect(cache.getQueryData(key)).toEqual(["pending-1"]));
    act(() => result.current.mutate(1));
    await waitFor(() =>
      expect(cache.getQueryData(key)).toEqual(["pending-1", "pending-2"]),
    );
    await act(async () => requests[0]!.reject(new Error("failed")));
    expect(cache.getQueryData(key)).toEqual(["pending-2"]);
    await act(async () => requests[1]!.resolve({ ok: true, value: "saved" }));
    expect(cache.getQueryData(key)).toEqual(["saved"]);
  });

  it("keeps another pending edit when an earlier command fails", async () => {
    const { cache, requests, result } = setup();
    act(() => result.current.mutate({ index: 0, id: "a", body: "first" }));
    await waitFor(() =>
      expect(cache.getQueryData(key)).toEqual([
        { _id: "a", body: "first" },
        { _id: "b", body: "original" },
      ]),
    );
    act(() => result.current.mutate({ index: 1, id: "b", body: "second" }));
    await waitFor(() =>
      expect(cache.getQueryData(key)).toEqual([
        { _id: "a", body: "first" },
        { _id: "b", body: "second" },
      ]),
    );
    await act(async () => requests[0]!.reject(new Error("failed")));
    await waitFor(() =>
      expect(cache.getQueryData(key)).toEqual([
        { _id: "a", body: "original" },
        { _id: "b", body: "second" },
      ]),
    );
    await act(async () => requests[1]!.resolve({ ok: true, value: "second" }));
  });
  it.each([
    [0, 1],
    [1, 0],
  ])(
    "restores the original when same-record edits both fail (%s then %s)",
    async (first, second) => {
      const { cache, requests, result } = setup();
      for (const index of [0, 1]) {
        act(() => result.current.mutate({ index, id: "a", body: "same edit" }));
        await waitFor(() => expect(cache.isMutating()).toBe(index + 1));
        await act(async () => {});
      }
      await act(async () => requests[first]!.reject(new Error("failed")));
      await act(async () => requests[second]!.reject(new Error("failed")));
      await waitFor(() => expect(cache.isMutating()).toBe(0));
      expect(cache.getQueryData(key)).toEqual([
        { _id: "a", body: "original" },
        { _id: "b", body: "original" },
      ]);
    },
  );

  it("retains a newer success when an older edit fails", async () => {
    const { cache, requests, result } = setup();
    act(() => result.current.mutate({ index: 0, id: "a", body: "first" }));
    await act(async () => {});
    act(() => result.current.mutate({ index: 1, id: "a", body: "second" }));
    await act(async () => {});
    await act(async () => requests[1]!.resolve({ ok: true, value: "second" }));
    await act(async () => requests[0]!.reject(new Error("failed")));
    await waitFor(() => expect(cache.isMutating()).toBe(0));
    expect(cache.getQueryData(key)).toEqual([
      { _id: "a", body: "second" },
      { _id: "b", body: "original" },
    ]);
  });

  it("waits for the other pending command before refetching active reads", async () => {
    const { cache, requests, result } = setup();
    const fetch = vi.fn(async () => [{ _id: "a", body: "server" }]);
    const observer = new QueryObserver(cache, {
      queryKey: key,
      queryFn: fetch,
    });
    const unsubscribe = observer.subscribe(() => {});
    act(() => result.current.mutate({ index: 0, id: "a", body: "first" }));
    await act(async () => {});
    act(() => result.current.mutate({ index: 1, id: "b", body: "second" }));
    await act(async () => {});
    await act(async () => requests[0]!.resolve({ ok: true, value: "first" }));
    expect(fetch).not.toHaveBeenCalled();
    expect(cache.getQueryData(key)).toEqual([
      { _id: "a", body: "first" },
      { _id: "b", body: "second" },
    ]);
    await act(async () => requests[1]!.resolve({ ok: true, value: "second" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    unsubscribe();
  });
});
