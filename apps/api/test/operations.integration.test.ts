import { env } from "cloudflare:test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createNote } from "../src/features/notes/operations";
import { toRefusal } from "../src/platform/http/errors";
import { RequestContext } from "../src/platform/request-scope";

describe("Effect operations", () => {
  it("defers a write until execution and uses the executing request's owner", async () => {
    const firstActor = crypto.randomUUID();
    const secondActor = crypto.randomUUID();
    const create = createNote({ body: "Lazy note" });
    const before = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notes WHERE body = ?",
    )
      .bind("Lazy note")
      .first<{ count: number }>();
    expect(before?.count).toBe(0);

    const first = await Effect.runPromise(
      create.pipe(
        Effect.provideService(RequestContext, {
          db: env.DB,
          actorId: firstActor,
          clock: { now: () => 100, newId: () => crypto.randomUUID() },
        }),
      ),
    );
    const second = await Effect.runPromise(
      create.pipe(
        Effect.provideService(RequestContext, {
          db: env.DB,
          actorId: secondActor,
          clock: { now: () => 200, newId: () => crypto.randomUUID() },
        }),
      ),
    );
    expect(first.createdAt).toBe(100);
    expect(second.createdAt).toBe(200);
    expect(second._id).not.toBe(first._id);
    const rows = await env.DB.prepare(
      "SELECT user_id FROM notes WHERE body = ? ORDER BY created_at",
    )
      .bind("Lazy note")
      .all<{ user_id: string }>();
    expect(rows.results.map((row) => row.user_id)).toEqual([
      firstActor,
      secondActor,
    ]);
  });

  it("puts a domain refusal in the typed failure channel without writing", async () => {
    const actorId = crypto.randomUUID();
    const outcome = await Effect.runPromise(
      createNote({ body: "   " }).pipe(
        Effect.provideService(RequestContext, {
          db: env.DB,
          actorId,
          clock: { now: () => 100, newId: () => crypto.randomUUID() },
        }),
        Effect.match({
          onSuccess: () => null,
          onFailure: (failure) => ({
            tag: failure._tag,
            error: toRefusal(failure).error,
          }),
        }),
      ),
    );
    expect(outcome).toEqual({
      tag: "InvalidInput",
      error: {
        code: "validation",
        message: "Note body cannot be empty",
        retryable: false,
      },
    });
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notes WHERE user_id = ?",
    )
      .bind(actorId)
      .first<{ count: number }>();
    expect(row?.count).toBe(0);
  });
});
