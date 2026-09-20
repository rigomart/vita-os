import { SELF } from "cloudflare:test";
import { expect } from "vitest";

/**
 * Real authenticated callers, created the way the browser creates them.
 *
 * Every test signs up through Better Auth's own public route and keeps the
 * session cookie it hands back, so no test can accidentally exercise a read or
 * write with an actor the Worker never authenticated.
 */
export type Session = { actorId: string; cookie: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createSession(label: string): Promise<Session> {
  const response = await SELF.fetch("http://api.test/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: label,
      email: `${label}-${crypto.randomUUID()}@example.com`,
      password: "correct horse battery staple",
    }),
  });

  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  if (
    !isObject(body) ||
    !isObject(body.user) ||
    typeof body.user.id !== "string"
  ) {
    throw new Error("Better Auth returned an invalid sign-up response");
  }

  const cookie = response.headers.get("set-cookie");
  if (cookie === null || cookie.length === 0) {
    throw new Error("Better Auth sign-up response omitted the session cookie");
  }

  return { actorId: body.user.id, cookie };
}

export interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  session?: Session;
}

export interface Answer {
  status: number;
  body: unknown;
}

/** One request to the Worker, made the way the browser makes it. */
export async function call(
  path: string,
  options: CallOptions = {},
): Promise<Answer> {
  const method = options.method ?? "GET";
  const response = await SELF.fetch(`http://api.test${path}`, {
    method,
    headers: {
      ...(options.session === undefined
        ? {}
        : { cookie: options.session.cookie }),
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      origin: "http://browser.test",
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  return { status: response.status, body };
}

/** The body of a call that must have succeeded. */
export async function succeed<T>(
  path: string,
  options: CallOptions = {},
): Promise<T> {
  const answer = await call(path, options);
  if (answer.status >= 400) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed with ${answer.status}: ${JSON.stringify(answer.body)}`,
    );
  }

  return answer.body as T;
}

export function expectError(
  answer: Answer,
  expected: { status: number; code: string; message?: string },
): void {
  expect(answer.status).toBe(expected.status);
  expect(answer.body).toMatchObject({
    error: {
      code: expected.code,
      ...(expected.message === undefined ? {} : { message: expected.message }),
    },
  });
}
