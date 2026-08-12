import { beforeEach, describe, expect, it } from "vitest";

import type { Fixture, SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { FIRST_PAGE, seed, setupTest, signIn } from "./test.helpers";

/**
 * The `returns:` validators already stop an undeclared field escaping. What
 * these add is that the projections *agree* on which fields they keep, and
 * that `userId` is absent from all of them at once — composites that nest
 * documents two deep included.
 */

/** Every object anywhere in a query result, including nested ones. */
function everyObject(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(everyObject);
  if (value === null || typeof value !== "object") return [];

  const self = value as Record<string, unknown>;
  return [self, ...Object.values(self).flatMap(everyObject)];
}

function expectNoOwner(label: string, result: unknown): void {
  const objects = everyObject(result);
  // Guard against a vacuous pass: an empty result would satisfy the loop.
  expect(
    objects.length,
    `${label} returned nothing to inspect`,
  ).toBeGreaterThan(0);
  for (const object of objects) {
    expect(Object.keys(object), label).not.toContain("userId");
  }
}

describe("query projections", () => {
  let t: TestApi;
  let owner: SignedIn;
  let owned: Fixture;

  beforeEach(async () => {
    t = setupTest();
    owner = await signIn(t, "owner@example.com");
    owned = await seed(owner);
    await owner.mutation(api.tasks.create, { text: "Done later" });
  });

  it("never puts userId on the wire", async () => {
    const doneTask = await owner.mutation(api.tasks.create, { text: "Filed" });
    await owner.mutation(api.tasks.markDone, { id: doneTask });

    const results: Array<[string, unknown]> = [
      ["areas.list", await owner.query(api.areas.list, {})],
      ["areas.get", await owner.query(api.areas.get, { id: owned.areaId })],
      [
        "areas.getBySlug",
        await owner.query(api.areas.getBySlug, { slug: owned.areaSlug }),
      ],
      [
        "areas.detailBySlug",
        await owner.query(api.areas.detailBySlug, { slug: owned.areaSlug }),
      ],
      ["threads.list", await owner.query(api.threads.list, {})],
      [
        "threads.get",
        await owner.query(api.threads.get, { id: owned.threadId }),
      ],
      [
        "threads.getBySlug",
        await owner.query(api.threads.getBySlug, { slug: owned.threadSlug }),
      ],
      [
        "threads.detailBySlug",
        await owner.query(api.threads.detailBySlug, {
          slug: owned.threadSlug,
        }),
      ],
      ["tasks.list", await owner.query(api.tasks.list, {})],
    ];

    // The paginated queries need their own vacuity guard: the pagination
    // wrapper is itself an object, so `expectNoOwner`'s non-empty check
    // passes even when `page` is empty and inspects no documents.
    const doneTasks = await owner.query(api.tasks.listDone, {
      paginationOpts: FIRST_PAGE,
    });
    expect(doneTasks.page.length).toBeGreaterThan(0);
    results.push(["tasks.listDone", doneTasks]);

    const logs = await owner.query(api.activityLogs.listByThread, {
      threadId: owned.threadId,
      paginationOpts: FIRST_PAGE,
    });
    expect(logs.page.length).toBeGreaterThan(0);
    results.push(["activityLogs.listByThread", logs]);

    for (const [label, result] of results) {
      expectNoOwner(label, result);
    }
  });

  it("returns the same Area shape from every query that serves one", async () => {
    const [list, get, bySlug, areaDetail, threadDetail] = await Promise.all([
      owner.query(api.areas.list, {}),
      owner.query(api.areas.get, { id: owned.areaId }),
      owner.query(api.areas.getBySlug, { slug: owned.areaSlug }),
      owner.query(api.areas.detailBySlug, { slug: owned.areaSlug }),
      owner.query(api.threads.detailBySlug, { slug: owned.threadSlug }),
    ]);

    // The client's optimistic cache copies an Area between these caches, so
    // an extra or missing field in any one of them would be written into the
    // others and rejected there.
    expect(list[0]).toEqual(get);
    expect(get).toEqual(bySlug);
    expect(get).toEqual(areaDetail?.area);
    expect(get).toEqual(threadDetail?.area);
  });

  it("returns the same Thread shape from every query that serves one", async () => {
    const [list, get, bySlug, areaDetail, threadDetail] = await Promise.all([
      owner.query(api.threads.list, {}),
      owner.query(api.threads.get, { id: owned.threadId }),
      owner.query(api.threads.getBySlug, { slug: owned.threadSlug }),
      owner.query(api.areas.detailBySlug, { slug: owned.areaSlug }),
      owner.query(api.threads.detailBySlug, { slug: owned.threadSlug }),
    ]);

    expect(list[0]).toEqual(get);
    expect(get).toEqual(bySlug);
    expect(get).toEqual(areaDetail?.threads[0]);
    expect(get).toEqual(threadDetail?.thread);
  });

  it("returns the same Task shape open and done", async () => {
    const id = await owner.mutation(api.tasks.create, { text: "Filed" });
    const open = (await owner.query(api.tasks.list, {})).find(
      (task) => task._id === id,
    );
    await owner.mutation(api.tasks.markDone, { id });
    const done = (
      await owner.query(api.tasks.listDone, { paginationOpts: FIRST_PAGE })
    ).page.find((task) => task._id === id);

    // `useUncompleteTask` moves a Done Task straight into the Open list, so
    // the two must carry the same fields. `when` and `completedAt` are the
    // optional ones, present or absent by state rather than by projection.
    const stateIndependent = (task: object | undefined) =>
      Object.keys(task ?? {})
        .filter((key) => key !== "when" && key !== "completedAt")
        .sort();

    expect(stateIndependent(open)).toEqual(stateIndependent(done));
    expect(stateIndependent(open)).toEqual([
      "_creationTime",
      "_id",
      "createdAt",
      "state",
      "text",
    ]);
  });

  it("drops threadId from an Activity Log entry", async () => {
    const { page } = await owner.query(api.activityLogs.listByThread, {
      threadId: owned.threadId,
      paginationOpts: FIRST_PAGE,
    });

    expect(page.length).toBeGreaterThan(0);
    for (const entry of page) {
      expect(Object.keys(entry)).not.toContain("threadId");
      expect(Object.keys(entry)).not.toContain("_creationTime");
    }
  });

  it("keeps _creationTime on Tasks, which the Inbox sorts by", async () => {
    for (const task of await owner.query(api.tasks.list, {})) {
      expect(task._creationTime).toEqual(expect.any(Number));
    }
  });
});
