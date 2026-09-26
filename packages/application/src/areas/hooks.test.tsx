import type {
  AreaId,
  ApplicationError,
  AreaSummary,
  Thread,
  ThreadDetail,
} from "@vita-os/contracts";

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { anArea, aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import {
  useAreas,
  useCreateArea,
  useRemoveArea,
  useReorderAreas,
  useUpdateArea,
} from "./hooks";

const health = anArea();
const home = anArea({
  _id: "area-2" as AreaId,
  name: "Home",
  slug: "home-0011aabb",
  order: 1,
});
const unavailable: ApplicationError = {
  code: "unavailable",
  message: "Temporarily unavailable.",
  retryable: true,
};

describe("useAreas", () => {
  it("reads the Area inventory", async () => {
    const client = createFakeApplicationClient({
      listAreas: async () => success([health, home]),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useAreas(), { wrapper });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual([health, home]));
  });
});

describe("useCreateArea", () => {
  it("shows the pending Area, then replaces it with the stored one", async () => {
    const stored: AreaSummary = {
      ...anArea({ _id: "area-stored" as AreaId, name: "Fitness" }),
      order: 1,
      slug: "fitness-deadbeef",
    };
    const pending = deferred<ReturnType<typeof success<AreaSummary>>>();
    const client = createFakeApplicationClient({
      createArea: () => pending.promise,
      listAreas: async () => success([health, stored]),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health]);
    });
    const { result } = renderHook(() => useCreateArea(), { wrapper });

    act(() => {
      result.current.mutate({
        name: "Fitness",
        icon: "Dumbbell",
      });
    });

    await waitFor(() => {
      const areas = cache.getQueryData<AreaSummary[]>(queryKeys.areas.list());
      expect(areas).toHaveLength(2);
      expect(areas?.[1]).toMatchObject({ name: "Fitness", order: 1 });
    });
    // The pending slug is a placeholder, not the one the service will choose.
    expect(
      cache.getQueryData<AreaSummary[]>(queryKeys.areas.list())?.[1]?.slug,
    ).not.toBe(stored.slug);

    pending.resolve(success(stored));
    await waitFor(() =>
      expect(
        cache.getQueryData<AreaSummary[]>(queryKeys.areas.list())?.[1],
      ).toEqual(stored),
    );
  });

  it("drops the placeholder when the service answers with an Area already listed", async () => {
    const client = createFakeApplicationClient({
      createArea: async () => success(health),
      listAreas: async () => success([health]),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health]);
    });
    const { result } = renderHook(() => useCreateArea(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "health", icon: "Compass" });
    });

    expect(cache.getQueryData(queryKeys.areas.list())).toEqual([health]);
  });

  it("puts the inventory back when the create fails", async () => {
    const client = createFakeApplicationClient({
      createArea: async () => ({ ok: false, error: unavailable }),
      listAreas: async () => success([health]),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health]);
    });
    const { result } = renderHook(() => useCreateArea(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({
          name: "Fitness",
          icon: "Dumbbell",
        })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.areas.list())).toEqual([health]);
  });
});

describe("useUpdateArea", () => {
  it("renames the Area in the list at once", async () => {
    const pending = deferred<ReturnType<typeof success<AreaSummary>>>();
    const client = createFakeApplicationClient({
      updateArea: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health, home]);
    });
    const { result } = renderHook(() => useUpdateArea(), { wrapper });

    act(() => {
      result.current.mutate({ areaId: health._id, name: "Wellbeing" });
    });

    await waitFor(() =>
      expect(cache.getQueryData<AreaSummary[]>(queryKeys.areas.list())).toEqual(
        [{ ...health, name: "Wellbeing" }, home],
      ),
    );

    pending.resolve(success({ ...health, name: "Wellbeing" }));
  });

  it("updates embedded Areas in Thread panes and rolls them back on failure", async () => {
    const pending = deferred<{ ok: false; error: ApplicationError }>();
    const thread = aThread();
    const key = queryKeys.threads.detail(thread.slug);
    const unrelatedKey = queryKeys.threads.detail("other-thread");
    const { wrapper, cache } = createHarness(
      createFakeApplicationClient({
        updateArea: () => pending.promise,
      }),
      (seeded) => {
        seeded.setQueryData(key, { thread, area: health });
        seeded.setQueryData(unrelatedKey, {
          thread: aThread({ areaId: home._id }),
          area: home,
        });
      },
    );
    const { result } = renderHook(() => useUpdateArea(), { wrapper });
    act(() => result.current.mutate({ areaId: health._id, name: "Wellbeing" }));
    await waitFor(() =>
      expect(cache.getQueryData<ThreadDetail>(key)?.area?.name).toBe(
        "Wellbeing",
      ),
    );
    expect(cache.getQueryData<ThreadDetail>(unrelatedKey)?.area).toEqual(home);
    await act(async () => pending.resolve({ ok: false, error: unavailable }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cache.getQueryData<ThreadDetail>(key)?.area).toEqual(health);
    expect(cache.getQueryState(key)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });
});

describe("useReorderAreas", () => {
  it("shows the new order at once, renumbering every Area", async () => {
    const pending = deferred<ReturnType<typeof success<AreaSummary[]>>>();
    const client = createFakeApplicationClient({
      reorderAreas: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health, home]);
    });
    const { result } = renderHook(() => useReorderAreas(), { wrapper });

    act(() => {
      result.current.mutate({ areaIds: [home._id, health._id] });
    });

    await waitFor(() =>
      expect(
        cache
          .getQueryData<AreaSummary[]>(queryKeys.areas.list())
          ?.map((area) => [area._id, area.order]),
      ).toEqual([
        [home._id, 0],
        [health._id, 1],
      ]),
    );

    pending.resolve(
      success([
        { ...home, order: 0 },
        { ...health, order: 1 },
      ]),
    );
  });
});

describe("useRemoveArea", () => {
  it("takes the Area out of the list and its label off every cached Thread", async () => {
    const labeled = aThread();
    const elsewhere = aThread({
      _id: "thread-2" as Thread["_id"],
      slug: "fix-gate-0011aabb",
      areaId: home._id,
    });
    const client = createFakeApplicationClient({
      removeArea: async () => success({ acknowledged: true as const }),
      listAreas: async () => success([home]),
      listOpenThreads: async () =>
        success([(({ areaId: _a, ...rest }) => rest)(labeled), elsewhere]),
    });
    const detailKey = queryKeys.threads.detail(labeled.slug);
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health, home]);
      seeded.setQueryData(queryKeys.threads.open(), [labeled, elsewhere]);
      seeded.setQueryData(detailKey, { thread: labeled, area: health });
    });
    const { result } = renderHook(() => useRemoveArea(), { wrapper });

    act(() => {
      result.current.mutate({ areaId: health._id });
    });

    await waitFor(() =>
      expect(cache.getQueryData(queryKeys.areas.list())).toEqual([home]),
    );
    const threads = cache.getQueryData<Thread[]>(queryKeys.threads.open());
    expect(threads?.[0]).not.toHaveProperty("areaId");
    expect(threads?.[1]?.areaId).toBe(home._id);
    expect(cache.getQueryData<ThreadDetail>(detailKey)).toEqual({
      thread: (({ areaId: _a, ...rest }) => rest)(labeled),
    });
  });

  it("puts the Area back when the deletion is refused", async () => {
    const client = createFakeApplicationClient({
      removeArea: async () => ({ ok: false, error: unavailable }),
      listAreas: async () => success([health, home]),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health, home]);
    });
    const { result } = renderHook(() => useRemoveArea(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ areaId: health._id })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.areas.list())).toEqual([health, home]);
  });
});
