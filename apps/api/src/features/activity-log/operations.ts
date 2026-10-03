import type {
  ActivityLogPage,
  PageRequest,
  ThreadId,
} from "@vita-os/contracts";

import { Effect } from "effect";

import type { RequestRefusal } from "../../platform/http/errors";

import { database, failed } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { activityLogStorage } from "./storage";

/** The owning Thread is checked before its Activity Log is read. */
export function getThreadActivityPage({
  threadId,
  ...page
}: { threadId: ThreadId } & PageRequest): Effect.Effect<
  ActivityLogPage,
  RequestRefusal,
  RequestContext
> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    if (!(yield* database(() => threadStorage(scope).exists(threadId))))
      return yield* failed(threadNotFound);
    return yield* database(() =>
      activityLogStorage(scope).readPage(threadId, page),
    );
  });
}
