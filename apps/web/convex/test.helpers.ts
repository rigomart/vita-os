import type { TestConvex, TestConvexForDataModel } from "convex-test";
import type { DataModelFromSchemaDefinition } from "convex/server";

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";

import type { Id } from "./_generated/dataModel";

import { api, components } from "./_generated/api";
import schema from "./schema";

/**
 * Shared setup for the Convex function tests.
 *
 * Auth is real, not stubbed: the Better Auth component is registered with
 * `@convex-dev/better-auth/test` (its documented `register` helper), and
 * `signIn` seeds a `user` + non-expired `session` through the component's own
 * `adapter.create` mutation.
 *
 * The double-dotted filename keeps this out of a Convex deploy: the CLI skips
 * every file in `convex/` whose name contains more than one dot.
 */

const modules = import.meta.glob("./**/*.ts");

type Schema = typeof schema;
export type TestApi = TestConvex<Schema>;
export type SignedIn = TestConvexForDataModel<
  DataModelFromSchemaDefinition<Schema>
>;

const HOUR_MS = 60 * 60 * 1000;

/** A first page big enough to hold any fixture a test seeds. */
export const FIRST_PAGE = { numItems: 50, cursor: null };

export function setupTest(): TestApi {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}

/**
 * Create a Better Auth user with a live session and return a `t` bound to
 * that identity.
 */
export async function signIn(t: TestApi, email: string): Promise<SignedIn> {
  const now = Date.now();

  const user = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: email,
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    }),
  );

  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: user._id,
          token: `token-${email}`,
          expiresAt: now + HOUR_MS,
          createdAt: now,
          updatedAt: now,
        },
      },
    }),
  );

  return t.withIdentity({ subject: user._id, sessionId: session._id });
}

export interface Fixture {
  areaId: Id<"areas">;
  areaSlug: string;
  logId: Id<"activityLogs">;
  taskId: Id<"tasks">;
  threadId: Id<"threads">;
  threadSlug: string;
}

/** One Area, Thread, Task and Activity Log, all created through `api.*`. */
export async function seed(as: SignedIn): Promise<Fixture> {
  const area = await as.mutation(api.areas.create, {
    name: "Family Health",
    condition: "healthy",
    icon: "HeartPulse",
  });
  const thread = await as.mutation(api.threads.create, {
    title: "Book checkup",
    areaId: area.id,
  });
  await as.mutation(api.threads.update, {
    id: thread.id,
    nextMove: "Call the clinic",
  });
  const taskId = await as.mutation(api.tasks.create, { text: "Buy vitamins" });
  const logId = await as.mutation(api.activityLogs.create, {
    threadId: thread.id,
    content: "Left a voicemail",
  });

  return {
    areaId: area.id,
    areaSlug: area.slug,
    threadId: thread.id,
    threadSlug: thread.slug,
    taskId,
    logId,
  };
}
