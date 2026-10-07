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
type Row = { _id: string; body: string; title?: string };
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
        optimistic: (client, input) => {
          const previous = client
            .getQueryData<Row[]>(key)!
            .find((row) => row._id === input.id)!.body;
          client.setQueryData<Row[]>(key, (rows) =>
            rows?.map((row) =>
              row._id === input.id ? { ...row, body: input.body } : row,
            ),
          );
          return {
            rollback: () =>
              client.setQueryData<Row[]>(key, (rows) =>
                rows?.map((row) =>
                  row._id === input.id ? { ...row, body: previous } : row,
                ),
              ),
          };
        },
      }),
    { queryClient: cache },
  );
  return { cache, requests, result };
}
async function issue(
  setupResult: ReturnType<typeof setup>,
  index: number,
  id: string,
) {
  act(() =>
    setupResult.result.current.mutate({
      index,
      id,
      body: index === 0 ? "first" : "second",
    }),
  );
  await waitFor(() =>
    expect(
      setupResult.cache.getQueryData<Row[]>(key)?.find((row) => row._id === id)
        ?.body,
    ).toBe(index === 0 ? "first" : "second"),
  );
}
describe("independent application commands", () => {
  it("refetches a settled command while an unrelated command remains pending", async () => {
    const state = setup();
    const fetch = vi.fn(async () => [
      { _id: "a", body: "server" },
      { _id: "b", body: "original" },
    ]);
    const observer = new QueryObserver(state.cache, {
      queryKey: key,
      queryFn: fetch,
    });
    const unsubscribe = observer.subscribe(() => {});
    await issue(state, 0, "a");
    await issue(state, 1, "b");
    await act(async () =>
      state.requests[0]!.resolve({ ok: true, value: "first" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(state.cache.isMutating()).toBe(1);
    await act(async () =>
      state.requests[1]!.resolve({ ok: true, value: "second" }),
    );
    unsubscribe();
  });
  it("a failed edit preserves a successful edit to another record in the shared list", async () => {
    const state = setup();
    await issue(state, 0, "a");
    await issue(state, 1, "b");
    await act(async () =>
      state.requests[1]!.resolve({ ok: true, value: "second" }),
    );
    await act(async () => state.requests[0]!.reject(new Error("failed")));
    expect(state.cache.getQueryData(key)).toEqual([
      { _id: "a", body: "original" },
      { _id: "b", body: "second" },
    ]);
  });
  it("a failed Task field change preserves a concurrent title edit", async () => {
    const state = setup();
    await issue(state, 0, "a");
    state.cache.setQueryData<Row[]>(key, (rows) =>
      rows?.map((row) =>
        row._id === "a" ? { ...row, title: "saved title" } : row,
      ),
    );
    await act(async () => state.requests[0]!.reject(new Error("failed")));
    expect(state.cache.getQueryData<Row[]>(key)?.[0]).toEqual({
      _id: "a",
      body: "original",
      title: "saved title",
    });
  });
});
