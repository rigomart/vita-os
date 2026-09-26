import type {
  ActivityLogPage,
  AreaSummary,
  Thread,
  ThreadDetail,
} from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

async function createArea(
  session: Session,
  overrides: Partial<{ name: string; icon: AreaSummary["icon"] }> = {},
): Promise<AreaSummary> {
  return succeed<AreaSummary>("/v1/areas", {
    method: "POST",
    session,
    body: {
      name: overrides.name ?? `Health ${crypto.randomUUID()}`,
      icon: overrides.icon ?? "HeartPulse",
    },
  });
}

async function createThread(
  session: Session,
  body: { title: string; areaId?: string },
): Promise<Thread> {
  return succeed<Thread>("/v1/threads", { method: "POST", session, body });
}

describe("Area labels", () => {
  it("creates an Area with a generated slug and the next manual position", async () => {
    const owner = await createSession("areas-create");

    const first = await createArea(owner, { name: "Family Health" });
    const second = await createArea(owner, { name: "Home", icon: "Home" });

    expect(first).toMatchObject({
      name: "Family Health",
      icon: "HeartPulse",
      order: 0,
    });
    expect(first.slug).toMatch(/^family-health-[0-9a-f]{8}$/);
    expect(second).toMatchObject({ name: "Home", icon: "Home", order: 1 });
  });

  it("returns the existing Area when a new name reads as the same slug", async () => {
    const owner = await createSession("areas-create-existing");
    const health = await createArea(owner, { name: "Family Health" });

    const again = await createArea(owner, {
      name: "  family   health ",
      icon: "Compass",
    });

    expect(again).toEqual(health);
    await expect(
      succeed<AreaSummary[]>("/v1/areas", { session: owner }),
    ).resolves.toHaveLength(1);
  });

  it("never matches another owner's Area of the same name", async () => {
    const owner = await createSession("areas-create-existing-owner");
    const other = await createSession("areas-create-existing-other");
    const theirs = await createArea(other, { name: "Health" });

    const mine = await createArea(owner, { name: "Health" });

    expect(mine._id).not.toBe(theirs._id);
  });

  it("lists only the actor's Areas, in manual order", async () => {
    const owner = await createSession("areas-list-owner");
    const other = await createSession("areas-list-other");
    const mine = await createArea(owner, { name: "Mine" });
    const alsoMine = await createArea(owner, { name: "Also mine" });
    await createArea(other, { name: "Theirs" });

    const areas = await succeed<AreaSummary[]>("/v1/areas", { session: owner });

    expect(areas.map((area) => area._id)).toEqual([mine._id, alsoMine._id]);
  });

  it("refuses a blank name and a name that would take a reserved route", async () => {
    const owner = await createSession("areas-validate");

    expectError(
      await call("/v1/areas", {
        method: "POST",
        session: owner,
        body: { name: "   ", icon: "Compass" },
      }),
      { status: 400, code: "validation", message: "Area name cannot be empty" },
    );
    expectError(
      await call("/v1/areas", {
        method: "POST",
        session: owner,
        body: { name: "Threads", icon: "Compass" },
      }),
      {
        status: 400,
        code: "validation",
        message: '"Threads" is reserved and cannot be used as an area name',
      },
    );
  });

  it("no longer accepts a Condition or a Standard, and never returns one", async () => {
    const owner = await createSession("areas-no-condition");
    const area = await createArea(owner);

    for (const body of [
      { name: "Health", icon: "Compass", condition: "healthy" },
      { name: "Health", icon: "Compass", standard: "Checkups are current" },
    ]) {
      expectError(
        await call("/v1/areas", { method: "POST", session: owner, body }),
        { status: 400, code: "validation" },
      );
    }
    expectError(
      await call(`/v1/areas/${area._id}`, {
        method: "PATCH",
        session: owner,
        body: { condition: "critical" },
      }),
      { status: 400, code: "validation" },
    );
    expect(area).not.toHaveProperty("condition");
    expect(area).not.toHaveProperty("standard");
  });

  it("refuses an unknown Area Icon", async () => {
    const owner = await createSession("areas-enum");

    expectError(
      await call("/v1/areas", {
        method: "POST",
        session: owner,
        body: { name: "Health", icon: "Rocket" },
      }),
      { status: 400, code: "validation" },
    );
  });

  it("has no Area page read", async () => {
    const owner = await createSession("areas-no-detail");
    const area = await createArea(owner);

    const answer = await call(`/v1/areas/${area.slug}`, { session: owner });
    expect(answer.status).toBe(404);
  });

  it("requires authentication for every Area operation", async () => {
    const owner = await createSession("areas-unauthenticated");
    const area = await createArea(owner);

    for (const [path, method] of [
      ["/v1/areas", "GET"],
      ["/v1/areas", "POST"],
      ["/v1/areas/order", "PUT"],
      [`/v1/areas/${area._id}`, "PATCH"],
      [`/v1/areas/${area._id}`, "DELETE"],
    ] as const) {
      expectError(
        await call(path, { method, body: method === "GET" ? undefined : {} }),
        {
          status: 401,
          code: "unauthorized",
        },
      );
    }
  });
});

describe("Area changes", () => {
  it("renames an Area and mints a new slug", async () => {
    const owner = await createSession("area-rename");
    const area = await createArea(owner, { name: "Health" });

    const renamed = await succeed<AreaSummary>(`/v1/areas/${area._id}`, {
      method: "PATCH",
      session: owner,
      body: { name: "Family Health" },
    });

    expect(renamed.name).toBe("Family Health");
    expect(renamed.slug).toMatch(/^family-health-[0-9a-f]{8}$/);
    expect(renamed.slug).not.toBe(area.slug);
  });

  it("re-icons an Area and keeps its slug", async () => {
    const owner = await createSession("area-reicon");
    const area = await createArea(owner, { name: "Health" });

    const changed = await succeed<AreaSummary>(`/v1/areas/${area._id}`, {
      method: "PATCH",
      session: owner,
      body: { icon: "Dumbbell" },
    });

    expect(changed).toMatchObject({ slug: area.slug, icon: "Dumbbell" });
  });

  it("refuses to change another owner's Area", async () => {
    const owner = await createSession("area-change-owner");
    const other = await createSession("area-change-other");
    const theirs = await createArea(other);

    expectError(
      await call(`/v1/areas/${theirs._id}`, {
        method: "PATCH",
        session: owner,
        body: { name: "Mine now" },
      }),
      { status: 404, code: "not_found", message: "Area not found." },
    );
    const untouched = await succeed<AreaSummary[]>("/v1/areas", {
      session: other,
    });
    expect(untouched[0]).toMatchObject({ name: theirs.name });
  });
});

describe("Area order", () => {
  it("puts the owner's Areas in the given order", async () => {
    const owner = await createSession("area-reorder");
    const first = await createArea(owner, { name: "First" });
    const second = await createArea(owner, { name: "Second" });
    const third = await createArea(owner, { name: "Third" });

    const reordered = await succeed<AreaSummary[]>("/v1/areas/order", {
      method: "PUT",
      session: owner,
      body: { areaIds: [third._id, first._id, second._id] },
    });

    expect(reordered.map((area) => [area.name, area.order])).toEqual([
      ["Third", 0],
      ["First", 1],
      ["Second", 2],
    ]);
    await expect(
      succeed<AreaSummary[]>("/v1/areas", { session: owner }),
    ).resolves.toEqual(reordered);
  });

  it("refuses an order that leaves out, repeats, or borrows an Area", async () => {
    const owner = await createSession("area-reorder-mismatch-owner");
    const other = await createSession("area-reorder-mismatch-other");
    const first = await createArea(owner, { name: "First" });
    const second = await createArea(owner, { name: "Second" });
    const theirs = await createArea(other, { name: "Theirs" });

    for (const areaIds of [
      [first._id],
      [first._id, first._id],
      [first._id, theirs._id],
    ]) {
      expectError(
        await call("/v1/areas/order", {
          method: "PUT",
          session: owner,
          body: { areaIds },
        }),
        { status: 409, code: "conflict" },
      );
    }
    const untouched = await succeed<AreaSummary[]>("/v1/areas", {
      session: owner,
    });
    expect(untouched.map((area) => area._id)).toEqual([first._id, second._id]);
  });
});

describe("Area deletion", () => {
  it("deletes an Area that labels no Threads", async () => {
    const owner = await createSession("area-delete");
    const area = await createArea(owner);

    await expect(
      succeed(`/v1/areas/${area._id}`, { method: "DELETE", session: owner }),
    ).resolves.toEqual({ acknowledged: true });
    await expect(
      succeed<AreaSummary[]>("/v1/areas", { session: owner }),
    ).resolves.toEqual([]);
  });

  it("removes the label from open and resolved Threads and leaves them otherwise untouched", async () => {
    const owner = await createSession("area-delete-labels");
    const area = await createArea(owner, { name: "Health" });
    const kept = await createArea(owner, { name: "Home" });
    const open = await createThread(owner, {
      title: "Book checkup",
      areaId: area._id,
    });
    const resolved = await createThread(owner, {
      title: "Old errand",
      areaId: area._id,
    });
    const elsewhere = await createThread(owner, {
      title: "Fix the gate",
      areaId: kept._id,
    });
    await succeed(`/v1/threads/${resolved._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });
    const logBefore = await succeed<ActivityLogPage>(
      `/v1/threads/${resolved._id}/activity`,
      { session: owner },
    );

    await expect(
      succeed(`/v1/areas/${area._id}`, { method: "DELETE", session: owner }),
    ).resolves.toEqual({ acknowledged: true });

    const openAfter = await succeed<ThreadDetail>(`/v1/threads/${open.slug}`, {
      session: owner,
    });
    expect(openAfter).toEqual({
      thread: (({ areaId: _areaId, ...rest }) => rest)(open),
    });
    const resolvedAfter = await succeed<ThreadDetail>(
      `/v1/threads/${resolved.slug}`,
      { session: owner },
    );
    expect(resolvedAfter.thread).toMatchObject({ state: "resolved" });
    expect(resolvedAfter.thread).not.toHaveProperty("areaId");
    expect(resolvedAfter).not.toHaveProperty("area");
    await expect(
      succeed<ActivityLogPage>(`/v1/threads/${resolved._id}/activity`, {
        session: owner,
      }),
    ).resolves.toEqual(logBefore);
    await expect(
      succeed<ActivityLogPage>(`/v1/threads/${open._id}/activity`, {
        session: owner,
      }),
    ).resolves.toEqual({ entries: [] });
    await expect(
      succeed<ThreadDetail>(`/v1/threads/${elsewhere.slug}`, {
        session: owner,
      }),
    ).resolves.toMatchObject({ thread: { areaId: kept._id } });
  });

  it("answers not found when deleting another owner's Area", async () => {
    const owner = await createSession("area-delete-privacy-owner");
    const other = await createSession("area-delete-privacy-other");
    const theirs = await createArea(other);
    const theirThread = await createThread(other, {
      title: "Private",
      areaId: theirs._id,
    });

    expectError(
      await call(`/v1/areas/${theirs._id}`, {
        method: "DELETE",
        session: owner,
      }),
      { status: 404, code: "not_found" },
    );
    await expect(
      succeed<AreaSummary[]>("/v1/areas", { session: other }),
    ).resolves.toHaveLength(1);
    await expect(
      succeed<ThreadDetail>(`/v1/threads/${theirThread.slug}`, {
        session: other,
      }),
    ).resolves.toMatchObject({ thread: { areaId: theirs._id } });
  });
});
