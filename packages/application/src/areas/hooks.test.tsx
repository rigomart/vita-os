import type {
  AreaDetail,
  AreaId,
  ApplicationError,
  AreaSummary,
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
  useAreaDetail,
  useAreas,
  useCreateArea,
  useRemoveArea,
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

describe("useAreaDetail", () => {
  it("reads an Area with its Open Threads", async () => {
    const detail: AreaDetail = { area: health, threads: [aThread()] };
    const client = createFakeApplicationClient({
      getAreaDetail: async () => success(detail),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useAreaDetail(health.slug), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(detail));
  });

  it("reads an Area that is not there as absent", async () => {
    const client = createFakeApplicationClient({
      getAreaDetail: async () => ({
        ok: false,
        error: {
          code: "not_found",
          message: "Area not found.",
          retryable: false,
        },
      }),
    });
    const { wrapper } = createHarness(client);

    const { result } = renderHook(() => useAreaDetail("missing"), { wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeNull();
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
        condition: "healthy",
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
          condition: "healthy",
          icon: "Dumbbell",
        })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error).toEqual(unavailable));
    expect(cache.getQueryData(queryKeys.areas.list())).toEqual([health]);
  });
});

describe("useUpdateArea", () => {
  it("changes the Area in the inventory and on its own page at once", async () => {
    const pending = deferred<ReturnType<typeof success<AreaSummary>>>();
    const client = createFakeApplicationClient({
      updateArea: () => pending.promise,
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health, home]);
      seeded.setQueryData(queryKeys.areas.detail(health.slug), {
        area: health,
        threads: [],
      });
      seeded.setQueryData(queryKeys.areas.detail(home.slug), {
        area: home,
        threads: [],
      });
    });
    const { result } = renderHook(() => useUpdateArea(), { wrapper });

    act(() => {
      result.current.mutate({ areaId: health._id, condition: "critical" });
    });

    await waitFor(() => {
      expect(
        cache.getQueryData<AreaSummary[]>(queryKeys.areas.list())?.[0],
      ).toMatchObject({ condition: "critical" });
      expect(
        cache.getQueryData<AreaDetail>(queryKeys.areas.detail(health.slug))
          ?.area.condition,
      ).toBe("critical");
    });
    // Another Area's page is not touched.
    expect(
      cache.getQueryData<AreaDetail>(queryKeys.areas.detail(home.slug))?.area,
    ).toEqual(home);

    pending.resolve(success({ ...health, condition: "critical" }));
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
      expect(cache.getQueryData<ThreadDetail>(key)?.area.name).toBe(
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

  it("clears the Standard when the change carries null", async () => {
    const withStandard = anArea({ standard: "Appointments are current" });
    const client = createFakeApplicationClient({
      updateArea: async () => success({ ...withStandard, standard: undefined }),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [withStandard]);
    });
    const { result } = renderHook(() => useUpdateArea(), { wrapper });

    act(() => {
      result.current.mutate({ areaId: withStandard._id, standard: null });
    });

    await waitFor(() =>
      expect(
        cache.getQueryData<AreaSummary[]>(queryKeys.areas.list())?.[0]
          ?.standard,
      ).toBeUndefined(),
    );
  });
});

describe("useRemoveArea", () => {
  it("takes the Area out of the inventory and empties its page", async () => {
    const client = createFakeApplicationClient({
      removeArea: async () => success({ acknowledged: true as const }),
    });
    const { wrapper, cache } = createHarness(client, (seeded) => {
      seeded.setQueryData(queryKeys.areas.list(), [health, home]);
      seeded.setQueryData(queryKeys.areas.detail(health.slug), {
        area: health,
        threads: [],
      });
    });
    const { result } = renderHook(() => useRemoveArea(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ areaId: health._id });
    });

    expect(cache.getQueryData(queryKeys.areas.list())).toEqual([home]);
    expect(cache.getQueryData(queryKeys.areas.detail(health.slug))).toBeNull();
  });

  it("puts the Area back when the deletion is refused", async () => {
    const conflict: ApplicationError = {
      code: "conflict",
      message:
        "Cannot delete an area that has threads. Move or delete the threads first.",
      retryable: false,
    };
    const client = createFakeApplicationClient({
      removeArea: async () => ({ ok: false, error: conflict }),
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

    await waitFor(() => expect(result.current.error).toEqual(conflict));
    expect(cache.getQueryData(queryKeys.areas.list())).toEqual([health, home]);
  });
});
