import type {
  ActivityLogPage,
  PageRequest,
  ThreadId,
} from "@vita-os/contracts";

import { Effect } from "effect";

import type { Operation } from "../../platform/operation";

import { database } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { activityLogStorage } from "./storage";

/** A Thread's Activity Log is read through the Thread, which must be theirs. */
export function getThreadActivityPage({
  threadId,
  ...page
}: { threadId: ThreadId } & PageRequest): Operation<ActivityLogPage> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    if (!(yield* database(() => threadStorage(scope).exists(threadId))))
      return yield* threadNotFound();
    return yield* database(() =>
      activityLogStorage(scope).readPage(threadId, page),
    );
  });
}
