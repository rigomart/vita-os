import type { Note, Thread } from "@vita-os/contracts";

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { createApp } from "../src/app";
import { createSession, succeed } from "./sessions";

/**
 * The request guard decides from its own decoding of the path whether a
 * request is protected (`/v1`) or an auth request (`/api/auth`), while the
 * router matches its own decoding. These tests send alternative spellings of
 * the same path and require that every spelling the router dispatches to a
 * handler also passed through the guard, and that every spelling the guard
 * waves through never reaches a handler.
 */

const FOREIGN_ORIGIN = "https://attacker.example";
const BASE = "http://api.test";

type Send = (path: string, init: RequestInit) => Promise<Response>;

/** Through the Worker: the runtime's URL parser runs before the app. */
const viaWorker: Send = (path, init) => SELF.fetch(`${BASE}${path}`, init);

/**
 * Straight into the app with the path exactly as written, as if a runtime
 * forwarded it without WHATWG normalisation (dot segments, backslashes and
 * control characters left in place).
 */
const verbatim: Send = async (path, init) => {
  const request = new Request(`${BASE}/`, init);
  const unnormalised = new Proxy(request, {
    get(target, property) {
      if (property === "url") return `${BASE}${path}`;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const app = createApp();
  try {
    return await app.fetch(unnormalised, env);
  } finally {
    await app.dispose();
  }
};

/** The pathname the Worker receives for a path as sent. */
function received(path: string): string {
  return new URL(`${BASE}${path}`).pathname;
}

async function answer(response: Response) {
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Router misses answer in plain text.
  }
  return {
    status: response.status,
    body,
    allowOrigin: response.headers.get("access-control-allow-origin"),
  };
}

const unauthenticated = {
  status: 401,
  body: {
    error: {
      code: "unauthorized",
      message: "Authentication required.",
      retryable: false,
    },
  },
};
const foreignOrigin = {
  status: 403,
  body: {
    error: {
      code: "unauthorized",
      message: "Request origin is not allowed.",
      retryable: false,
    },
  },
};
const jsonRequired = {
  status: 415,
  body: {
    error: {
      code: "validation",
      message: "JSON request body required.",
      retryable: false,
    },
  },
};

function anonymousGet(send: Send, path: string) {
  return send(path, { headers: { origin: env.BROWSER_ORIGIN } }).then(answer);
}

function authenticatedGet(send: Send, path: string, session: Session) {
  return send(path, {
    headers: { cookie: session.cookie, origin: env.BROWSER_ORIGIN },
  }).then(answer);
}

/** A well-formed Note creation; only the origin and media type vary. */
function createNote(
  send: Send,
  path: string,
  session: Session,
  headers: Record<string, string>,
) {
  return send(path, {
    method: "POST",
    headers: { cookie: session.cookie, ...headers },
    body: JSON.stringify({ body: "Must not be written" }),
  }).then(answer);
}

/** Every guarded refusal for a spelling that reaches a /v1 path. */
async function expectGuarded(send: Send, path: string, session: Session) {
  const anonymous = await anonymousGet(send, path);
  expect(anonymous).toMatchObject(unauthenticated);
  expect(anonymous.allowOrigin).toBe(env.BROWSER_ORIGIN);
  expect(
    await createNote(send, path, session, {
      origin: FOREIGN_ORIGIN,
      "content-type": "application/json",
    }),
  ).toMatchObject(foreignOrigin);
  expect(
    await createNote(send, path, session, {
      origin: env.BROWSER_ORIGIN,
      "content-type": "text/plain",
    }),
  ).toMatchObject(jsonRequired);
  expect(await createNote(send, path, session, {})).toMatchObject(jsonRequired);
  const preflight = await send(path, {
    method: "OPTIONS",
    headers: {
      origin: env.BROWSER_ORIGIN,
      "access-control-request-method": "POST",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(
    env.BROWSER_ORIGIN,
  );
}

/** A spelling outside the guard must not reach any handler at all. */
async function expectUnrouted(send: Send, path: string, session: Session) {
  for (const result of [
    await anonymousGet(send, path),
    await authenticatedGet(send, path, session),
    await createNote(send, path, session, {
      origin: env.BROWSER_ORIGIN,
      "content-type": "application/json",
    }),
    await createNote(send, path, session, {
      origin: FOREIGN_ORIGIN,
      "content-type": "text/plain",
    }),
  ]) {
    expect(result.status).toBe(404);
    expect(result.allowOrigin).toBeNull();
  }
}

async function expectNoNotes(session: Session) {
  expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([]);
}

/** Spellings that dispatch to the Note list and creation handlers. */
const reachesNotes: Array<[sent: string, received: string]> = [
  ["/v1/notes", "/v1/notes"],
  ["/%761/notes", "/%761/notes"],
  ["/v%31/notes", "/v%31/notes"],
  ["/%76%31/%6Eotes", "/%76%31/%6Eotes"],
  ["/x/../v1/notes", "/v1/notes"],
  ["/%2e%2e/v1/notes", "/v1/notes"],
  ["/x/%2E%2E/v1/notes", "/v1/notes"],
  ["/v1/./notes", "/v1/notes"],
  ["/v1/%2e/notes", "/v1/notes"],
  ["/v1\\notes", "/v1/notes"],
  ["\\v1\\notes", "/v1/notes"],
  ["/v1\t/no\ntes", "/v1/notes"],
  ["/v1/notes?page=%2F..%2F", "/v1/notes"],
  ["/v1/notes#fragment", "/v1/notes"],
  // The URL parser trims leading and trailing C0 controls and spaces.
  ["/v1/notes\u0000", "/v1/notes"],
  ["/v1/notes  ", "/v1/notes"],
];

/** Spellings under /v1 that match no route: authenticated, then 404. */
const protectedMisses: Array<[sent: string, received: string]> = [
  ["/v1/notes/", "/v1/notes/"],
  ["/v1/notes/..", "/v1/"],
  ["/v1/notes;/x", "/v1/notes;/x"],
  ["/v1/notes;", "/v1/notes;"],
  ["/v1/%E0%A4%A/notes", "/v1/%E0%A4%A/notes"],
  ["/v1/notes%ZZ", "/v1/notes%ZZ"],
  ["/v1/notes%C0%AF", "/v1/notes%C0%AF"],
  ["/v1/notes%00", "/v1/notes%00"],
  ["/v1/no%00tes", "/v1/no%00tes"],
  ["/v1/notes%2F", "/v1/notes%2F"],
];

/** Spellings the guard leaves alone, which therefore must not route. */
const unrouted: Array<[sent: string, received: string]> = [
  ["/V1/notes", "/V1/notes"],
  ["/V%31/notes", "/V%31/notes"],
  ["//v1/notes", "//v1/notes"],
  ["/v1%2Fnotes", "/v1%2Fnotes"],
  ["/v1%2fnotes", "/v1%2fnotes"],
  ["/%5Cv1/notes", "/%5Cv1/notes"],
  ["/v1%5Cnotes", "/v1%5Cnotes"],
  ["/%25761/notes", "/%25761/notes"],
  ["/%2576%2531/notes", "/%2576%2531/notes"],
  ["/v1%ZZ/notes", "/v1%ZZ/notes"],
  ["/v1%E0%A4%A/notes", "/v1%E0%A4%A/notes"],
  ["/v1;x/notes", "/v1;x/notes"],
  ["/v1;/notes", "/v1;/notes"],
  ["/v1%3B/notes", "/v1%3B/notes"],
  ["/v1%3Fx/notes", "/v1%3Fx/notes"],
  ["/v1%23/notes", "/v1%23/notes"],
  ["/v1%00/notes", "/v1%00/notes"],
  ["/v1\u0000/notes", "/v1%00/notes"],
  ["/%C0%AFv1/notes", "/%C0%AFv1/notes"],
  ["/v1%C0%AFnotes", "/v1%C0%AFnotes"],
  ["/v1%C0%AF/notes", "/v1%C0%AF/notes"],
  ["/%EF%BC%8Fv1/notes", "/%EF%BC%8Fv1/notes"],
  ["/v1%EF%BC%8Fnotes", "/v1%EF%BC%8Fnotes"],
];

describe("request guards across path spellings", () => {
  it.each(reachesNotes)(
    "guards %j, which the Worker receives as %j and routes to Notes",
    async (sent, pathname) => {
      expect(received(sent)).toBe(pathname);
      const session = await createSession("guard-routed");
      // Proves this spelling really reaches the Note handlers.
      const reads = await authenticatedGet(viaWorker, sent, session);
      expect(reads).toMatchObject({ status: 200, body: [] });
      await expectGuarded(viaWorker, sent, session);
      await expectNoNotes(session);
    },
  );

  it.each(protectedMisses)(
    "authenticates %j (received as %j) before answering not found",
    async (sent, pathname) => {
      expect(received(sent)).toBe(pathname);
      const session = await createSession("guard-miss");
      const reads = await authenticatedGet(viaWorker, sent, session);
      expect(reads).toMatchObject({ status: 404 });
      await expectGuarded(viaWorker, sent, session);
      await expectNoNotes(session);
    },
  );

  it.each(unrouted)(
    "never dispatches %j (received as %j) to a handler",
    async (sent, pathname) => {
      expect(received(sent)).toBe(pathname);
      const session = await createSession("guard-unrouted");
      await expectUnrouted(viaWorker, sent, session);
      await expectNoNotes(session);
    },
  );

  it("guards lowercase methods, which the runtime normalises", async () => {
    const session = await createSession("guard-method-case");
    for (const method of ["post", "Post"]) {
      expect(
        await viaWorker("/v1/notes", {
          method,
          headers: { cookie: session.cookie, "content-type": "text/plain" },
          body: JSON.stringify({ body: "Must not be written" }),
        }).then(answer),
      ).toMatchObject(jsonRequired);
    }
    for (const method of ["patch", "put", "delete"]) {
      expect(
        await viaWorker("/v1/areas/order", {
          method,
          headers: {
            cookie: session.cookie,
            origin: FOREIGN_ORIGIN,
            "content-type": "application/json",
          },
          body: JSON.stringify({ areaIds: [] }),
        }).then(answer),
      ).toMatchObject(foreignOrigin);
    }
    await expectNoNotes(session);
  });
});

describe("request guards on paths the runtime would normalise", () => {
  it.each(["/v1/notes", "/%761/notes", "/v1/notes?x=;", "/v1/notes#x"])(
    "guards verbatim %j as the Note handlers",
    async (path) => {
      const session = await createSession("verbatim-routed");
      const reads = await authenticatedGet(verbatim, path, session);
      expect(reads).toMatchObject({ status: 200, body: [] });
      await expectGuarded(verbatim, path, session);
      await expectNoNotes(session);
    },
  );

  it.each([
    "/v1/./notes",
    "/v1/notes/../notes",
    "/v1/notes/.",
    "/v1/notes\u0000",
    "/v1/notes\t",
    "/v1/notes\\",
  ])("authenticates verbatim %j before answering not found", async (path) => {
    const session = await createSession("verbatim-miss");
    const reads = await authenticatedGet(verbatim, path, session);
    expect(reads).toMatchObject({ status: 404 });
    await expectGuarded(verbatim, path, session);
    await expectNoNotes(session);
  });

  it.each([
    "/x/../v1/notes",
    "/./v1/notes",
    "/v1\\notes",
    "\\v1\\notes",
    "/v1\u0000/notes",
    "/v1\t/notes",
    "/v1\n/notes",
    "/v1 /notes",
    "/v1;/notes",
    "/v1%2F..%2Fnotes",
  ])("never dispatches verbatim %j to a handler", async (path) => {
    const session = await createSession("verbatim-unrouted");
    await expectUnrouted(verbatim, path, session);
    await expectNoNotes(session);
  });
});

/** Percent-encodes every character, so the router must decode the whole ID. */
function encodeEvery(value: string): string {
  return Array.from(
    new TextEncoder().encode(value),
    (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
  ).join("");
}

describe("record isolation across encoded record IDs", () => {
  it("keeps another user's records unreachable however their IDs are spelled", async () => {
    const owner = await createSession("isolation-owner");
    const intruder = await createSession("isolation-intruder");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Private note" },
    });
    const thread = await succeed<Thread>("/v1/threads", {
      method: "POST",
      session: owner,
      body: { title: "Private plan" },
    });

    const noteIds = [
      note._id,
      encodeEvery(note._id),
      `${encodeEvery(note._id.slice(0, 1))}${note._id.slice(1)}`,
    ];
    const notePaths = noteIds.flatMap((id) => [
      `/v1/notes/${id}`,
      `/%761/notes/${id}`,
      `/x/../v1/notes/${id}`,
    ]);
    const threadIds = [thread._id, encodeEvery(thread._id)];
    const threadSlugs = [thread.slug, encodeEvery(thread.slug)];

    const as = (session: Session) => ({
      cookie: session.cookie,
      origin: env.BROWSER_ORIGIN,
      "content-type": "application/json",
    });
    // Reads come first: renaming a Thread changes its slug.
    const attempts = (
      session: Session,
    ): Array<[string, () => Promise<Response>]> => [
      ...threadSlugs.map((slug): [string, () => Promise<Response>] => [
        `GET /v1/threads/${slug}`,
        () => viaWorker(`/v1/threads/${slug}`, { headers: as(session) }),
      ]),
      ...threadIds.map((id): [string, () => Promise<Response>] => [
        `GET /v1/threads/${id}/notes`,
        () => viaWorker(`/v1/threads/${id}/notes`, { headers: as(session) }),
      ]),
      ...notePaths.map((path): [string, () => Promise<Response>] => [
        `PATCH ${path}/body`,
        () =>
          viaWorker(`${path}/body`, {
            method: "PATCH",
            headers: as(session),
            body: JSON.stringify({ body: `Edited by ${session.actorId}` }),
          }),
      ]),
      ...threadIds.map((id): [string, () => Promise<Response>] => [
        `PATCH /v1/threads/${id}`,
        () =>
          viaWorker(`/v1/threads/${id}`, {
            method: "PATCH",
            headers: as(session),
            body: JSON.stringify({ title: `Renamed by ${session.actorId}` }),
          }),
      ]),
    ];

    for (const [label, attempt] of attempts(intruder)) {
      expect({ label, ...(await answer(await attempt())) }).toMatchObject({
        label,
        status: 404,
        body: { error: { code: "not_found" } },
      });
    }
    for (const path of notePaths) {
      expect(
        await viaWorker(path, { method: "DELETE", headers: as(intruder) }).then(
          answer,
        ),
      ).toMatchObject({ status: 404, body: { error: { code: "not_found" } } });
    }
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      expect.objectContaining({ _id: note._id, body: "Private note" }),
    ]);
    const detail = await succeed<{ thread: Thread }>(
      `/v1/threads/${thread.slug}`,
      { session: owner },
    );
    expect(detail.thread).toMatchObject({
      _id: thread._id,
      title: "Private plan",
    });

    // The same spellings do address the records, so the 404s above come from
    // ownership rather than from the spelling failing to route.
    for (const [label, attempt] of attempts(owner)) {
      expect({ label, status: (await attempt()).status }).toEqual({
        label,
        status: 200,
      });
    }
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      expect.objectContaining({ body: `Edited by ${owner.actorId}` }),
    ]);
  });

  it("does not decode a double-encoded record ID into the real one", async () => {
    const owner = await createSession("double-encoded-owner");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Unchanged" },
    });
    const doubleEncoded = encodeEvery(note._id).replace(/%/g, "%25");
    const response = await viaWorker(`/v1/notes/${doubleEncoded}/body`, {
      method: "PATCH",
      headers: {
        cookie: owner.cookie,
        origin: env.BROWSER_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "Changed" }),
    });
    expect(await answer(response)).toMatchObject({
      status: 404,
      body: { error: { code: "not_found" } },
    });
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      expect.objectContaining({ body: "Unchanged" }),
    ]);
  });
});

describe("CORS on auth path spellings", () => {
  it.each([
    ["/api/auth/get-session", "/api/auth/get-session"],
    ["/x/../api/auth/get-session", "/api/auth/get-session"],
    ["/%61pi/auth/get-session", "/%61pi/auth/get-session"],
    ["/api/%61uth/get-session", "/api/%61uth/get-session"],
  ])(
    "answers %j (received as %j) with credentialed CORS",
    async (sent, pathname) => {
      expect(received(sent)).toBe(pathname);
      const response = await viaWorker(sent, {
        headers: { origin: env.BROWSER_ORIGIN },
      });
      expect(response.headers.get("access-control-allow-origin")).toBe(
        env.BROWSER_ORIGIN,
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
      const preflight = await viaWorker(sent, {
        method: "OPTIONS",
        headers: {
          origin: env.BROWSER_ORIGIN,
          "access-control-request-method": "POST",
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("access-control-allow-origin")).toBe(
        env.BROWSER_ORIGIN,
      );
    },
  );

  it.each([
    ["/API/auth/get-session", "/API/auth/get-session"],
    ["/api%2Fauth/get-session", "/api%2Fauth/get-session"],
    ["/api;/auth/get-session", "/api;/auth/get-session"],
    ["//api/auth/get-session", "//api/auth/get-session"],
    ["/%2561pi/auth/get-session", "/%2561pi/auth/get-session"],
  ])(
    "never hands %j (received as %j) to Better Auth",
    async (sent, pathname) => {
      expect(received(sent)).toBe(pathname);
      const session = await createSession("auth-unrouted");
      const response = await viaWorker(sent, {
        headers: { cookie: session.cookie, origin: env.BROWSER_ORIGIN },
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    },
  );
});
