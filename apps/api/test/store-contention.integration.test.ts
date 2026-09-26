import type { OperationResult, ThreadId } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestScope } from "../src/platform/request-scope";

import { getThreadActivityPage } from "../src/features/activity-log/operations";
import { areaNotFound } from "../src/features/areas/errors";
import * as areas from "../src/features/areas/operations";
import * as threads from "../src/features/threads/operations";
const clock = { now: () => Date.now(), newId: () => crypto.randomUUID() };
function value<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
async function setup() {
  const scope: RequestScope = {
    db: env.DB,
    clock,
    actorId: crypto.randomUUID(),
  };
  const area = value(
    await areas.createArea(scope, {
      name: "Home",
      icon: "Home",
    }),
  );
  return { scope, area };
}
afterEach(() => vi.restoreAllMocks());
describe("slug collision recovery", () => {
  it.each(["area", "thread"] as const)(
    "retries a colliding %s slug on create and rename",
    async (kind) => {
      const { scope, area } = await setup();
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
              await areas.createArea(scope, {
                name,
                icon: "Home",
              }),
            )
          : value(
              await threads.createThread(scope, {
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
      if (kind === "area") {
        // A same-named Area is the existing one, never a colliding new one.
        expect(second._id).toBe(first._id);
      } else {
        expect(second.slug).not.toBe(first.slug);
      }
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
          ? await areas.updateArea(scope, {
              areaId: other._id as typeof area._id,
              name: "Repeated",
            })
          : await threads.updateThread(scope, {
              threadId: other._id as ThreadId,
              title: "Repeated",
            });
      expect(value<{ slug: string }>(renamed).slug).toBe("repeated-02020202");
    },
  );
});

describe("Area contention", () => {
  it("reports a missing destination when an Area disappears during a Thread move", async () => {
    const { scope, area } = await setup();
    const destination = value(
      await areas.createArea(scope, {
        name: "Destination",
        icon: "Home",
      }),
    );
    const thread = value(
      await threads.createThread(scope, {
        areaId: area._id,
        title: "Moving",
      }),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      await areas.removeArea(scope, { areaId: destination._id });
      return batch(statements);
    });
    await expect(
      threads.updateThread(scope, {
        threadId: thread._id,
        areaId: destination._id,
      }),
    ).resolves.toEqual({ ok: false, error: areaNotFound });
    expect(
      value(await threads.getThreadDetail(scope, { slug: thread.slug })).thread
        .areaId,
    ).toBe(area._id);
    expect(
      value(
        await getThreadActivityPage(scope, {
          threadId: thread._id,
          limit: 20,
        }),
      ).entries,
    ).toEqual([]);
  });
});
