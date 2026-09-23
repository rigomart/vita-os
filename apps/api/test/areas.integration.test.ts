import type { AreaDetail, AreaSummary, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

async function createArea(
  session: Session,
  overrides: Partial<{
    name: string;
    standard: string;
    condition: AreaSummary["condition"];
    icon: AreaSummary["icon"];
  }> = {},
): Promise<AreaSummary> {
  return succeed<AreaSummary>("/v1/areas", {
    method: "POST",
    session,
    body: {
      name: overrides.name ?? `Health ${crypto.randomUUID()}`,
      ...(overrides.standard === undefined
        ? {}
        : { standard: overrides.standard }),
      condition: overrides.condition ?? "healthy",
      icon: overrides.icon ?? "HeartPulse",
    },
  });
}

describe("Area inventory", () => {
  it("creates an Area with a generated slug and the next manual position", async () => {
    const owner = await createSession("areas-create");

    const first = await createArea(owner, { name: "Family Health" });
    const second = await createArea(owner, {
      name: "Home",
      standard: "Nothing is broken",
      condition: "needs_attention",
      icon: "Home",
    });

    expect(first).toMatchObject({
      name: "Family Health",
      condition: "healthy",
      icon: "HeartPulse",
      order: 0,
    });
    expect(first.slug).toMatch(/^family-health-[0-9a-f]{8}$/);
    expect(first).not.toHaveProperty("standard");
    expect(second).toMatchObject({
      name: "Home",
      standard: "Nothing is broken",
      condition: "needs_attention",
      icon: "Home",
      order: 1,
    });
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
        body: { name: "   ", condition: "healthy", icon: "Compass" },
      }),
      { status: 400, code: "validation", message: "Area name cannot be empty" },
    );
    expectError(
      await call("/v1/areas", {
        method: "POST",
        session: owner,
        body: { name: "Threads", condition: "healthy", icon: "Compass" },
      }),
      {
        status: 400,
        code: "validation",
        message: '"Threads" is reserved and cannot be used as an area name',
      },
    );
  });

  it("refuses an unknown Condition or Area Icon", async () => {
    const owner = await createSession("areas-enum");

    expectError(
      await call("/v1/areas", {
        method: "POST",
        session: owner,
        body: { name: "Health", condition: "excellent", icon: "Compass" },
      }),
      { status: 400, code: "validation" },
    );
    expectError(
      await call("/v1/areas", {
        method: "POST",
        session: owner,
        body: { name: "Health", condition: "healthy", icon: "Rocket" },
      }),
      { status: 400, code: "validation" },
    );
  });

  it("requires authentication for every Area operation", async () => {
    const owner = await createSession("areas-unauthenticated");
    const area = await createArea(owner);

    for (const [path, method] of [
      ["/v1/areas", "GET"],
      [`/v1/areas/${area.slug}`, "GET"],
      ["/v1/areas", "POST"],
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

describe("Area detail", () => {
  it("reads an Area with its Open Threads in creation order", async () => {
    const owner = await createSession("area-detail-owner");
    const area = await createArea(owner, { name: "Family Health" });
    const first = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Book checkup", areaId: area._id },
    });
    const second = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Refill prescription", areaId: area._id },
    });
    const resolved = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Old errand", areaId: area._id },
    });
    await succeed(`/v1/threads/${resolved._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });

    const detail = await succeed<AreaDetail>(`/v1/areas/${area.slug}`, {
      session: owner,
    });

    expect(detail.area._id).toBe(area._id);
    expect(detail.threads.map((thread) => thread._id)).toEqual([
      first._id,
      second._id,
    ]);
  });

  it("answers the same way for a missing Area and another owner's Area", async () => {
    const owner = await createSession("area-detail-privacy-owner");
    const other = await createSession("area-detail-privacy-other");
    const theirs = await createArea(other, { name: "Private" });

    const missing = await call("/v1/areas/absent-area", { session: owner });
    const foreign = await call(`/v1/areas/${theirs.slug}`, { session: owner });

    expect(foreign).toEqual(missing);
    expectError(missing, {
      status: 404,
      code: "not_found",
      message: "Area not found.",
    });
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
    await expect(
      succeed<AreaDetail>(`/v1/areas/${renamed.slug}`, { session: owner }),
    ).resolves.toMatchObject({ area: { _id: area._id } });
  });

  it("keeps the slug when a change does not rename the Area", async () => {
    const owner = await createSession("area-restandardize");
    const area = await createArea(owner, { name: "Health" });

    const changed = await succeed<AreaSummary>(`/v1/areas/${area._id}`, {
      method: "PATCH",
      session: owner,
      body: { condition: "critical", standard: "Appointments are current" },
    });

    expect(changed).toMatchObject({
      slug: area.slug,
      condition: "critical",
      standard: "Appointments are current",
    });
  });

  it("clears the Standard when the change carries null", async () => {
    const owner = await createSession("area-clear-standard");
    const area = await createArea(owner, {
      standard: "Appointments are current",
    });

    const cleared = await succeed<AreaSummary>(`/v1/areas/${area._id}`, {
      method: "PATCH",
      session: owner,
      body: { standard: null },
    });

    expect(cleared).not.toHaveProperty("standard");
  });

  it("refuses to change another owner's Area", async () => {
    const owner = await createSession("area-change-owner");
    const other = await createSession("area-change-other");
    const theirs = await createArea(other);

    expectError(
      await call(`/v1/areas/${theirs._id}`, {
        method: "PATCH",
        session: owner,
        body: { condition: "critical" },
      }),
      { status: 404, code: "not_found", message: "Area not found." },
    );
    const untouched = await succeed<AreaSummary[]>("/v1/areas", {
      session: other,
    });
    expect(untouched[0]).toMatchObject({ condition: theirs.condition });
  });
});

describe("Area deletion", () => {
  it("deletes an Area that holds no Threads", async () => {
    const owner = await createSession("area-delete");
    const area = await createArea(owner);

    await expect(
      succeed(`/v1/areas/${area._id}`, { method: "DELETE", session: owner }),
    ).resolves.toEqual({ acknowledged: true });
    await expect(
      succeed<AreaSummary[]>("/v1/areas", { session: owner }),
    ).resolves.toEqual([]);
  });

  it("refuses to delete an Area that still holds a Thread, of any state", async () => {
    const owner = await createSession("area-delete-blocked");
    const area = await createArea(owner);
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Book checkup", areaId: area._id },
    });

    expectError(
      await call(`/v1/areas/${area._id}`, { method: "DELETE", session: owner }),
      {
        status: 409,
        code: "conflict",
        message:
          "Cannot delete an area that has threads. Move or delete the threads first.",
      },
    );

    await succeed(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });
    expectError(
      await call(`/v1/areas/${area._id}`, { method: "DELETE", session: owner }),
      { status: 409, code: "conflict" },
    );

    await succeed(`/v1/threads/${thread._id}`, {
      method: "DELETE",
      session: owner,
    });
    await expect(
      succeed(`/v1/areas/${area._id}`, { method: "DELETE", session: owner }),
    ).resolves.toEqual({ acknowledged: true });
  });

  it("answers not found when deleting another owner's Area", async () => {
    const owner = await createSession("area-delete-privacy-owner");
    const other = await createSession("area-delete-privacy-other");
    const theirs = await createArea(other);

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
  });
});
