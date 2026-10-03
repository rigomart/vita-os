import type { Note, Thread } from "@vita-os/contracts";

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Answer, Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

/**
 * The request guard decides from its own decoding of the path whether a
 * request is protected (`/v1`) or an auth request (`/api/auth`), while the
 * router matches its own decoding. These tests send alternative spellings of
 * the same path and require that every spelling the router dispatches to a
 * handler also passed through the guard, and that no other spelling reaches a
 * handler at all.
 */

const FOREIGN_ORIGIN = "https://attacker.example";

type Reply = Answer & { allowOrigin: string | null };

/** A Worker request with headers `call` cannot set, read the way `call` reads. */
async function send(path: string, init: RequestInit = {}): Promise<Reply> {
  const response = await SELF.fetch(`http://api.test${path}`, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return {
    status: response.status,
    body,
    allowOrigin: response.headers.get("access-control-allow-origin"),
  };
}

/** The pathname the Worker receives for a path as sent. */
function received(path: string): string {
  return new URL(`http://api.test${path}`).pathname;
}

/** Test titles show control characters escaped. */
function escaped(path: string): string {
  return JSON.stringify(path).slice(1, -1);
}
function rows(entries: Array<[sent: string, received: string]>) {
  return entries.map(([sent, pathname]) => ({
    label: escaped(sent),
    sent,
    pathname: escaped(pathname),
    expected: pathname,
  }));
}

function expectUnauthenticated(answer: Answer) {
  expectError(answer, {
    status: 401,
    code: "unauthorized",
    message: "Authentication required.",
  });
}
function expectForeignOrigin(answer: Answer) {
  expectError(answer, {
    status: 403,
    code: "unauthorized",
    message: "Request origin is not allowed.",
  });
}
function expectJsonRequired(answer: Answer) {
  expectError(answer, {
    status: 415,
    code: "validation",
    message: "JSON request body required.",
  });
}

/** A well-formed Note creation; only the origin and media type vary. */
function createNote(
  path: string,
  session: Session,
  headers: Record<string, string>,
) {
  return send(path, {
    method: "POST",
    headers: { cookie: session.cookie, ...headers },
    body: JSON.stringify({ body: "Must not be written" }),
  });
}

/** Every guarded refusal for a spelling that reaches a /v1 path. */
async function expectGuarded(path: string, session: Session) {
  const anonymous = await send(path, {
    headers: { origin: env.BROWSER_ORIGIN },
  });
  expectUnauthenticated(anonymous);
  expect(anonymous.allowOrigin).toBe(env.BROWSER_ORIGIN);
  expectForeignOrigin(
    await createNote(path, session, {
      origin: FOREIGN_ORIGIN,
      "content-type": "application/json",
    }),
  );
  expectJsonRequired(
    await createNote(path, session, {
      origin: env.BROWSER_ORIGIN,
      "content-type": "text/plain",
    }),
  );
  expectJsonRequired(await createNote(path, session, {}));
  const preflight = await SELF.fetch(`http://api.test${path}`, {
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

/**
 * No handler answered: never a success or handler data, only the router's
 * bare miss or an error envelope. The guard may refuse more spellings than it
 * does today, since that is safe. It answers an allowed origin with CORS, so
 * an allowed-origin reply without CORS must be the bare miss; a handler reached
 * past the guard would show up as an envelope without CORS.
 */
function expectNoHandler(reply: Reply, origin: string) {
  expect([401, 403, 404, 415]).toContain(reply.status);
  if (reply.body !== undefined) {
    expect(reply.body).toMatchObject({ error: { code: expect.any(String) } });
  }
  if (origin === env.BROWSER_ORIGIN && reply.allowOrigin === null) {
    expect(reply).toMatchObject({ status: 404, body: undefined });
  }
}

async function expectUnrouted(path: string, session: Session) {
  const allowed = env.BROWSER_ORIGIN;
  expectNoHandler(await send(path, { headers: { origin: allowed } }), allowed);
  expectNoHandler(
    await send(path, { headers: { cookie: session.cookie, origin: allowed } }),
    allowed,
  );
  expectNoHandler(
    await createNote(path, session, {
      origin: allowed,
      "content-type": "application/json",
    }),
    allowed,
  );
  expectNoHandler(
    await createNote(path, session, {
      origin: FOREIGN_ORIGIN,
      "content-type": "text/plain",
    }),
    FOREIGN_ORIGIN,
  );
}

async function expectNoNotes(session: Session) {
  expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([]);
}

/** Spellings that dispatch to the Note list and creation handlers. */
const reachesNotes = rows([
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
  ["/v1/notes?x=;", "/v1/notes"],
  ["/v1/notes#fragment", "/v1/notes"],
  // The URL parser trims leading and trailing C0 controls and spaces.
  ["/v1/notes\u0000", "/v1/notes"],
  ["/v1/notes  ", "/v1/notes"],
]);

/** Spellings under /v1 that match no route: authenticated, then 404. */
const protectedMisses = rows([
  ["/v1/notes/..", "/v1/"],
  ["/v1/notes;/x", "/v1/notes;/x"],
  ["/v1/%E0%A4%A/notes", "/v1/%E0%A4%A/notes"],
  ["/v1/notes%ZZ", "/v1/notes%ZZ"],
  // A malformed escape must not hide the encoded prefix before it.
  ["/%761/notes%ZZ", "/%761/notes%ZZ"],
  ["/v1/notes%C0%AF", "/v1/notes%C0%AF"],
  ["/v1/notes%00", "/v1/notes%00"],
  ["/v1/no%00tes", "/v1/no%00tes"],
  ["/v1/notes%2F", "/v1/notes%2F"],
]);

/** Spellings that must not reach any handler. */
const unrouted = rows([
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
]);

describe("request guards across path spellings", () => {
  it.each(reachesNotes)(
    "guards $label, received as $pathname and routed to Notes",
    async ({ sent, expected }) => {
      expect(received(sent)).toBe(expected);
      const session = await createSession("guard-routed");
      // Proves this spelling really reaches the Note handlers.
      expect(await call(sent, { session })).toEqual({ status: 200, body: [] });
      await expectGuarded(sent, session);
      await expectNoNotes(session);
    },
  );

  it.each(protectedMisses)(
    "authenticates $label, received as $pathname, before answering not found",
    async ({ sent, expected }) => {
      expect(received(sent)).toBe(expected);
      const session = await createSession("guard-miss");
      expect((await call(sent, { session })).status).toBe(404);
      await expectGuarded(sent, session);
      await expectNoNotes(session);
    },
  );

  it.each(unrouted)(
    "never dispatches $label, received as $pathname, to a handler",
    async ({ sent, expected }) => {
      expect(received(sent)).toBe(expected);
      const session = await createSession("guard-unrouted");
      await expectUnrouted(sent, session);
      await expectNoNotes(session);
    },
  );
});

describe("request guards on lowercase methods, which the runtime normalises", () => {
  it("requires JSON for post, put and patch", async () => {
    const session = await createSession("guard-method-json");
    const note = await succeed<Note>("/v1/notes", {
      method: "POST",
      session,
      body: { body: "Unchanged" },
    });
    for (const [method, path, body] of [
      ["post", "/v1/notes", { body: "Must not be written" }],
      ["Post", "/v1/notes", { body: "Must not be written" }],
      ["put", "/v1/areas/order", { areaIds: [] }],
      ["patch", `/v1/notes/${note._id}/body`, { body: "Changed" }],
    ] as const) {
      expectJsonRequired(
        await send(path, {
          method,
          headers: {
            cookie: session.cookie,
            origin: env.BROWSER_ORIGIN,
            "content-type": "text/plain",
          },
          body: JSON.stringify(body),
        }),
      );
    }
    expect(await succeed<Note[]>("/v1/notes", { session })).toEqual([
      expect.objectContaining({ _id: note._id, body: "Unchanged" }),
    ]);
  });

  it("refuses foreign origins for patch, put and delete", async () => {
    const session = await createSession("guard-method-origin");
    for (const method of ["patch", "put", "delete"]) {
      expectForeignOrigin(
        await send("/v1/areas/order", {
          method,
          headers: {
            cookie: session.cookie,
            origin: FOREIGN_ORIGIN,
            "content-type": "application/json",
          },
          body: JSON.stringify({ areaIds: [] }),
        }),
      );
    }
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

    // Reads come first: renaming a Thread changes its slug.
    const attempts = (
      session: Session,
    ): Array<[string, () => Promise<Answer>]> => [
      ...threadSlugs.map((slug): [string, () => Promise<Answer>] => [
        `GET /v1/threads/${slug}`,
        () => call(`/v1/threads/${slug}`, { session }),
      ]),
      ...threadIds.map((id): [string, () => Promise<Answer>] => [
        `GET /v1/threads/${id}/notes`,
        () => call(`/v1/threads/${id}/notes`, { session }),
      ]),
      ...notePaths.map((path): [string, () => Promise<Answer>] => [
        `PATCH ${path}/body`,
        () =>
          call(`${path}/body`, {
            method: "PATCH",
            session,
            body: { body: `Edited by ${session.actorId}` },
          }),
      ]),
      ...threadIds.map((id): [string, () => Promise<Answer>] => [
        `PATCH /v1/threads/${id}`,
        () =>
          call(`/v1/threads/${id}`, {
            method: "PATCH",
            session,
            body: { title: `Renamed by ${session.actorId}` },
          }),
      ]),
    ];

    for (const [label, attempt] of attempts(intruder)) {
      const answer = await attempt();
      expect({ label, status: answer.status }).toEqual({ label, status: 404 });
      expectError(answer, { status: 404, code: "not_found" });
    }
    for (const path of notePaths) {
      expectError(await call(path, { method: "DELETE", session: intruder }), {
        status: 404,
        code: "not_found",
      });
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
    expectError(
      await call(`/v1/notes/${doubleEncoded}/body`, {
        method: "PATCH",
        session: owner,
        body: { body: "Changed" },
      }),
      { status: 404, code: "not_found" },
    );
    expect(await succeed<Note[]>("/v1/notes", { session: owner })).toEqual([
      expect.objectContaining({ body: "Unchanged" }),
    ]);
  });
});

describe("CORS on auth path spellings", () => {
  it.each(
    rows([
      ["/api/auth/get-session", "/api/auth/get-session"],
      ["/x/../api/auth/get-session", "/api/auth/get-session"],
      ["/%61pi/auth/get-session", "/%61pi/auth/get-session"],
      ["/api/%61uth/get-session", "/api/%61uth/get-session"],
    ]),
  )(
    "grants credentialed CORS to $label, received as $pathname",
    async ({ sent, expected }) => {
      expect(received(sent)).toBe(expected);
      const response = await SELF.fetch(`http://api.test${sent}`, {
        headers: { origin: env.BROWSER_ORIGIN },
      });
      expect(response.headers.get("access-control-allow-origin")).toBe(
        env.BROWSER_ORIGIN,
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
      const preflight = await SELF.fetch(`http://api.test${sent}`, {
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

  it.each(
    rows([
      ["/API/auth/get-session", "/API/auth/get-session"],
      ["/api%2Fauth/get-session", "/api%2Fauth/get-session"],
      ["/api;/auth/get-session", "/api;/auth/get-session"],
      ["//api/auth/get-session", "//api/auth/get-session"],
      ["/%2561pi/auth/get-session", "/%2561pi/auth/get-session"],
    ]),
  )(
    "returns no session for $label, received as $pathname",
    async ({ sent, expected }) => {
      expect(received(sent)).toBe(expected);
      const session = await createSession("auth-unrouted");
      expectNoHandler(
        await send(sent, {
          headers: { cookie: session.cookie, origin: env.BROWSER_ORIGIN },
        }),
        env.BROWSER_ORIGIN,
      );
    },
  );
});
