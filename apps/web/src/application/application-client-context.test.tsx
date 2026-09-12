import type {
  ApplicationClient,
  LiveResource,
  QueryState,
  ThreadDetail,
} from "@vita-os/contracts";
import type { ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ApplicationClientProvider,
  useThreadDetail,
} from "./application-client-context";

class MutableResource<T> implements LiveResource<T> {
  private listeners = new Set<() => void>();
  private snapshot: T;

  constructor(snapshot: T) {
    this.snapshot = snapshot;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  getSnapshot = (): T => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  publish(snapshot: T): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

describe("ApplicationClientProvider", () => {
  it("publishes Thread detail and cleans up when the slug changes", () => {
    const resources = new Map<
      string,
      MutableResource<QueryState<ThreadDetail>>
    >();
    const client: ApplicationClient = {
      watchThreadDetail: ({ slug }) => {
        const resource = new MutableResource<QueryState<ThreadDetail>>({
          status: "loading",
        });
        resources.set(slug, resource);
        return resource;
      },
      watchThreadActivity: vi.fn(),
      completeNextMove: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApplicationClientProvider client={client}>
        {children}
      </ApplicationClientProvider>
    );
    const { result, rerender, unmount } = renderHook(
      ({ slug }) => useThreadDetail(slug),
      { initialProps: { slug: "first" }, wrapper },
    );

    expect(result.current).toEqual({ status: "loading" });
    expect(resources.get("first")?.listenerCount).toBe(1);

    const detail = {
      thread: {
        _id: "thread1",
        title: "Book checkup",
        slug: "book-checkup",
        areaId: "area1",
        order: 0,
        state: "open",
        createdAt: 1,
      },
      area: {
        _id: "area1",
        name: "Health",
        slug: "health",
        condition: "healthy",
        icon: "HeartPulse",
        order: 0,
        createdAt: 1,
      },
    } satisfies ThreadDetail;
    act(() =>
      resources.get("first")?.publish({ status: "ready", data: detail }),
    );
    expect(result.current).toEqual({ status: "ready", data: detail });

    rerender({ slug: "second" });
    expect(resources.get("first")?.listenerCount).toBe(0);
    expect(resources.get("second")?.listenerCount).toBe(1);

    unmount();
    expect(resources.get("second")?.listenerCount).toBe(0);
  });

  it("publishes the same live update to a second mounted consumer", () => {
    const resource = new MutableResource<QueryState<ThreadDetail>>({
      status: "loading",
    });
    const client: ApplicationClient = {
      watchThreadDetail: () => resource,
      watchThreadActivity: vi.fn(),
      completeNextMove: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApplicationClientProvider client={client}>
        {children}
      </ApplicationClientProvider>
    );
    const first = renderHook(() => useThreadDetail("book-checkup"), {
      wrapper,
    });
    const second = renderHook(() => useThreadDetail("book-checkup"), {
      wrapper,
    });
    const detail = {
      thread: {
        _id: "thread1",
        title: "Book checkup",
        slug: "book-checkup",
        areaId: "area1",
        order: 0,
        state: "open",
        nextMove: "Book appointment",
        createdAt: 1,
      },
      area: {
        _id: "area1",
        name: "Health",
        slug: "health",
        condition: "healthy",
        icon: "HeartPulse",
        order: 0,
        createdAt: 1,
      },
    } satisfies ThreadDetail;

    act(() => resource.publish({ status: "ready", data: detail }));

    expect(first.result.current).toEqual({ status: "ready", data: detail });
    expect(second.result.current).toEqual({ status: "ready", data: detail });

    first.unmount();
    expect(resource.listenerCount).toBe(1);
    second.unmount();
    expect(resource.listenerCount).toBe(0);
  });
});
