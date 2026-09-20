import type { ThreadId } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoreResult } from "../src/store";

import { D1AreaStore } from "../src/d1-area-store";
import { D1ThreadStore } from "../src/d1-thread-store";
const clock = { now: () => Date.now(), newId: () => crypto.randomUUID() };
function value<T>(result: StoreResult<T>): T {
  if (result.status !== "ok") throw new Error(result.status);
  return result.value;
}
async function setup() {
  const actorId = crypto.randomUUID();
  const areas = new D1AreaStore(env.DB, clock);
  const threads = new D1ThreadStore(env.DB, clock);
  const area = value(
    await areas.createArea({
      actorId,
      name: "Home",
      condition: "healthy",
      icon: "Home",
    }),
  );
  return { actorId, areas, threads, area };
}
afterEach(() => vi.restoreAllMocks());
describe("slug collision recovery", () => {
  it.each(["area", "thread"] as const)(
    "retries a colliding %s slug on create and rename",
    async (kind) => {
      const { actorId, areas, threads, area } = await setup();
      const random = vi
        .spyOn(crypto, "getRandomValues")
        .mockImplementation((array) => {
          (array as Uint8Array).fill(0);
          return array;
        });
      const create = async (
        name: string,
      ): Promise<{ _id: string; slug: string }> =>
        kind === "area"
          ? value(
              await areas.createArea({
                actorId,
                name,
                condition: "healthy",
                icon: "Home",
              }),
            )
          : value(
              await threads.createThread({
                actorId,
                title: name,
                areaId: area._id,
              }),
            );
      const first = await create("Repeated");
      random.mockImplementation((array) => {
        (array as Uint8Array).fill(1);
        return array;
      });
      random.mockImplementationOnce((array) => {
        (array as Uint8Array).fill(0);
        return array;
      });
      const second = await create("Repeated");
      expect(second.slug).not.toBe(first.slug);
      const other = await create("Different");
      random.mockImplementation((array) => {
        (array as Uint8Array).fill(2);
        return array;
      });
      random.mockImplementationOnce((array) => {
        (array as Uint8Array).fill(0);
        return array;
      });
      const renamed =
        kind === "area"
          ? await areas.updateArea({
              actorId,
              areaId: other._id,
              name: "Repeated",
            })
          : await threads.updateThread({
              actorId,
              threadId: other._id as ThreadId,
              title: "Repeated",
            });
      expect(value<{ slug: string }>(renamed).slug).toBe("repeated-02020202");
    },
  );
});

// Run a competing write at the database boundary, while retaining real D1
// statements and transactions on both sides of the race.
function beforeDelete(action: () => Promise<unknown>) {
  const prepare = env.DB.prepare.bind(env.DB);
  let pending = true;
  function wrap(statement: D1PreparedStatement): D1PreparedStatement {
    return new Proxy(statement, {
      get(target, key) {
        if (key === "bind")
          return (...args: unknown[]) => wrap(target.bind(...args));
        if (key === "first")
          return async (...args: Parameters<D1PreparedStatement["first"]>) => {
            if (pending) {
              pending = false;
              await action();
            }
            return target.first(...args);
          };
        const member = Reflect.get(target, key);
        return typeof member === "function" ? member.bind(target) : member;
      },
    });
  }
  vi.spyOn(env.DB, "prepare").mockImplementation((sql) =>
    sql.trim().startsWith("DELETE FROM areas")
      ? wrap(prepare(sql))
      : prepare(sql),
  );
}

describe("Area contention", () => {
  it("refuses deletion when a Thread arrives after the Area was checked", async () => {
    const { actorId, areas, threads, area } = await setup();
    beforeDelete(() =>
      threads.createThread({ actorId, areaId: area._id, title: "Arrived" }),
    );
    await expect(
      areas.removeArea({ actorId, areaId: area._id }),
    ).rejects.toThrow("Cannot delete an area that has threads");
    expect(
      value(await areas.getAreaDetail({ actorId, slug: area.slug })).threads,
    ).toHaveLength(1);
  });

  it("reports a missing destination when an Area disappears during a Thread move", async () => {
    const { actorId, areas, threads, area } = await setup();
    const destination = value(
      await areas.createArea({
        actorId,
        name: "Destination",
        condition: "healthy",
        icon: "Home",
      }),
    );
    const thread = value(
      await threads.createThread({
        actorId,
        areaId: area._id,
        title: "Moving",
      }),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      await areas.removeArea({ actorId, areaId: destination._id });
      return batch(statements);
    });
    await expect(
      threads.updateThread({
        actorId,
        threadId: thread._id,
        areaId: destination._id,
      }),
    ).resolves.toEqual({ status: "not_found", subject: "area" });
    expect(
      value(await threads.getThreadDetail({ actorId, slug: thread.slug }))
        .thread.areaId,
    ).toBe(area._id);
    expect(
      value(
        await threads.getThreadActivityPage({
          actorId,
          threadId: thread._id,
          limit: 20,
        }),
      ).entries,
    ).toEqual([]);
  });
});
