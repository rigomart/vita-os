import type { ApplicationClient } from "@vita-os/contracts";

import { createHttpApplicationClient } from "@vita-os/contracts/http";
import { describeApplicationClient } from "@vita-os/contracts/testing";
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/worker";
import { createSession, type Session } from "./sessions";

/**
 * Every Vita OS workflow, driven through the public HTTP client against the real
 * Worker and a real local database: the contract every application client
 * runs, and what only a service with more than one owner can show.
 *
 * Nothing here reaches for a route, a SQL statement, or a store: if an operation
 * works from this seam, it works from the browser.
 */
function clientFor(session: Session): ApplicationClient {
  return createHttpApplicationClient({
    apiBaseUrl: "http://api.test",
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("cookie", session.cookie);
      headers.set("origin", "http://browser.test");
      return worker.fetch(new Request(input, { ...init, headers }), env);
    },
  });
}

/** The value of an operation that must have succeeded. */
async function value<T>(
  operation: Promise<{ ok: true; value: T } | { ok: false; error: unknown }>,
): Promise<T> {
  const result = await operation;
  if (!result.ok) {
    throw new Error(`Operation failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

describeApplicationClient("The HTTP API", async () =>
  clientFor(await createSession("client")),
);

describe("Owners through the HTTP client", () => {
  it("reports another owner's records as not found, whatever the operation", async () => {
    const owner = await createSession("client-privacy-owner");
    const other = await createSession("client-privacy-other");
    const ownerClient = clientFor(owner);
    const otherClient = clientFor(other);
    const theirArea = await value(
      otherClient.createArea({
        name: "Private",
        icon: "Compass",
      }),
    );
    const theirThread = await value(
      otherClient.createThread({ title: "Private", areaId: theirArea._id }),
    );
    const theirNote = await value(otherClient.createNote({ body: "Private" }));

    const notFound = {
      ok: false,
      error: {
        code: "not_found",
        retryable: false,
        message: expect.any(String),
      },
    };
    await expect(
      ownerClient.updateArea({ areaId: theirArea._id, name: "Mine now" }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.removeArea({ areaId: theirArea._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.updateThread({ threadId: theirThread._id, areaId: null }),
    ).resolves.toMatchObject(notFound);
    const mine = await value(ownerClient.createThread({ title: "Mine" }));
    await expect(
      ownerClient.updateThread({ threadId: mine._id, areaId: theirArea._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.createThread({ title: "Mine too", areaId: theirArea._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.getThreadDetail({ slug: theirThread.slug }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.listOpenThreadNotes({ threadId: theirThread._id }),
    ).resolves.toMatchObject(notFound);
    await expect(
      ownerClient.updateNoteBody({ noteId: theirNote._id, body: "Mine now" }),
    ).resolves.toMatchObject(notFound);
    await expect(ownerClient.listAreas()).resolves.toEqual({
      ok: true,
      value: [],
    });
    await expect(ownerClient.listOpenNotes()).resolves.toEqual({
      ok: true,
      value: [],
    });
  });
});

describe("failures the HTTP client reports without a service", () => {
  it("reports a request that never reached the service as unavailable", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: () => Promise.reject(new Error("network down")),
    });

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unavailable",
        message: "The service is temporarily unavailable.",
        retryable: true,
      },
    });
  });

  it("reports an unrecognized response shape as unexpected", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify([{ _id: "area-1" }]), {
            headers: { "content-type": "application/json" },
          }),
        ),
    });

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Unexpected response from the service.",
        retryable: false,
      },
    });
  });

  it("reports an unauthenticated call as unauthorized", async () => {
    const client = createHttpApplicationClient({
      apiBaseUrl: "http://api.test",
      fetchImpl: async (input, init) =>
        worker.fetch(new Request(input, init), env),
    });

    await expect(client.listAreas()).resolves.toEqual({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Authentication required.",
        retryable: false,
      },
    });
  });
});
