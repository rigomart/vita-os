import type { ApplicationError } from "@vita-os/contracts";
import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Actor } from "../authenticated-actor";
import type { WorkerEnv } from "../env";
import type { StoreResult, StoreSubject, VitaStore } from "../store";

import {
  areaNotFound,
  changeConflict,
  noteNotFound,
  threadNoteNotFound,
  threadNotFound,
} from "../errors";

/**
 * What every route in this Worker has in common: an authenticated actor, a store
 * scoped to them, and one way of turning a storage outcome into a response.
 */
export type AppEnvironment = {
  Bindings: WorkerEnv;
  Variables: {
    actor: Actor;
    store: VitaStore;
  };
};

export type AppContext = Context<AppEnvironment>;
export type Routes = (app: Hono<AppEnvironment>) => void;

const NOT_FOUND_BY_SUBJECT: Record<StoreSubject, ApplicationError> = {
  area: areaNotFound,
  thread: threadNotFound,
  note: noteNotFound,
  thread_note: threadNoteNotFound,
};

export function actorId(context: AppContext): string {
  return context.get("actor").actorId;
}

export function store(context: AppContext): VitaStore {
  return context.get("store");
}

/** The body a write carries, or `undefined` when it is not readable JSON. */
export async function readJsonBody(context: AppContext): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

/**
 * Answer with a storage outcome.
 *
 * `not_found` carries the record kind's own message and nothing about whether the
 * record exists for somebody else; when one workflow touches two kinds, the
 * outcome names which was looked for. `conflict` means the record moved underneath
 * the request, which is worth retrying.
 */
export function respond<T>(
  context: AppContext,
  result: StoreResult<T>,
  notFoundError: ApplicationError,
  options: { createdStatus?: boolean } = {},
): Response {
  if (result.status === "not_found") {
    const error =
      result.subject === undefined
        ? notFoundError
        : NOT_FOUND_BY_SUBJECT[result.subject];
    return context.json({ error }, 404);
  }
  if (result.status === "conflict") {
    return context.json({ error: changeConflict }, 409);
  }

  const status: ContentfulStatusCode = options.createdStatus ? 201 : 200;
  return context.json(result.value, status);
}

/** A request whose body this Worker does not recognize. */
export function refuse(context: AppContext, error: ApplicationError): Response {
  return context.json({ error }, 400);
}
