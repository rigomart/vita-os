import type { OperationResult, ThreadId } from "@vita-os/contracts";

import { Result } from "better-result";
import { env } from "cloudflare:test";
import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Operation } from "../src/platform/operation";
import type { RequestScope } from "../src/platform/request-scope";

import { getThreadActivityPage } from "../src/features/activity-log/operations";
import * as areas from "../src/features/areas/operations";
import * as threads from "../src/features/threads/operations";
import { toRefusal } from "../src/platform/http/errors";

const clock = { now: () => Date.now(), newId: () => crypto.randomUUID() };
function value<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
async function result<T>(operation: Operation<T>): Promise<OperationResult<T>> {
  const result = await operation;
  return Result.isOk(result)
    ? { ok: true, value: result.value }
    : { ok: false, error: toRefusal(result.error).error };
}

async function setup() {
  const scope: RequestScope = {
    db: env.DB,
    clock,
    actorId: crypto.randomUUID(),
  };
  const area = value(
    await result(areas.createArea(scope, { name: "Home", icon: "Home" })),
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
          ? value(await result(areas.createArea(scope, { name, icon: "Home" })))
          : value(
              await result(
                threads.createThread(scope, { title: name, areaId: area._id }),
              ),
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
          ? await result(
              areas.updateArea(scope, {
                areaId: other._id as typeof area._id,
                name: "Repeated",
              }),
            )
          : await result(
              threads.updateThread(scope, {
                threadId: other._id as ThreadId,
                title: "Repeated",
              }),
            );
      expect(value<{ slug: string }>(renamed).slug).toBe("repeated-02020202");
    },
  );
});

describe("slug write failures", () => {
  async function createAreaFailingWith(rejection: Error) {
    const { scope } = await setup();
    const prepare = env.DB.prepare.bind(env.DB);
    // The slug each insert attempt bound, in the insert's parameter order.
    const slugs: unknown[] = [];
    vi.spyOn(env.DB, "prepare").mockImplementation((sql) => {
      if (!/^insert into "areas" /i.test(sql)) return prepare(sql);
      return {
        bind: (...values: unknown[]) => {
          slugs.push(values[3]);
          return { raw: () => Promise.reject(rejection) };
        },
      } as unknown as D1PreparedStatement;
    });
    const result = await areas.createArea(scope, {
      name: "Rejected",
      icon: "Home",
    });
    if (Result.isOk(result)) throw new Error("Expected storage refusal");
    const failure = result.error;
    return { failure, slugs };
  }

  it("retries every slug collision, then reports a retryable conflict", async () => {
    const { failure, slugs } = await createAreaFailingWith(
      new Error(
        "D1_ERROR: UNIQUE constraint failed: areas.user_id, areas.slug",
      ),
    );

    expect(slugs).toHaveLength(3);
    expect(new Set(slugs).size).toBe(3);
    for (const slug of slugs) expect(slug).toMatch(/^rejected-[0-9a-f]{8}$/);
    expect(failure._tag).toBe("ChangeConflict");
    expect(toRefusal(failure).error).toEqual({
      code: "conflict",
      message: "The record changed while this request was in flight.",
      retryable: true,
    });
  });

  it("does not retry a storage error that is not a slug collision", async () => {
    const outage = new Error("D1_ERROR: database is locked");
    const { failure, slugs } = await createAreaFailingWith(outage);

    expect(slugs).toHaveLength(1);
    expect(failure).toMatchObject({ _tag: "Unexpected" });
    expect(failure).toHaveProperty("cause", expect.any(DrizzleQueryError));
    expect(failure).toHaveProperty("cause.cause", outage);
    expect(toRefusal(failure).error).toEqual({
      code: "unexpected",
      message: "Unexpected error.",
      retryable: false,
    });
  });
});

describe("Area contention", () => {
  it("reports a missing destination when an Area disappears during a Thread move", async () => {
    const { scope, area } = await setup();
    const destination = value(
      await result(
        areas.createArea(scope, { name: "Destination", icon: "Home" }),
      ),
    );
    const thread = value(
      await result(
        threads.createThread(scope, { areaId: area._id, title: "Moving" }),
      ),
    );
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      await result(areas.removeArea(scope, { areaId: destination._id }));
      return batch(statements);
    });
    await expect(
      result(
        threads.updateThread(scope, {
          threadId: thread._id,
          areaId: destination._id,
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "not_found",
        message: "Area not found.",
        retryable: false,
      },
    });
    expect(
      value(await result(threads.getThreadDetail(scope, { slug: thread.slug })))
        .thread.areaId,
    ).toBe(area._id);
    expect(
      value(
        await result(
          getThreadActivityPage(scope, { threadId: thread._id, limit: 20 }),
        ),
      ).entries,
    ).toEqual([]);
  });
});
