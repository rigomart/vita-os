import type {
  ActivityLogPage,
  PageRequest,
  ThreadId,
} from "@vita-os/contracts";

import { Result } from "better-result";

import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";

import { database } from "../../platform/operation";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { activityLogStorage } from "./storage";

/** A Thread's Activity Log is read through the Thread, which must be theirs. */
export function getThreadActivityPage(
  scope: RequestScope,
  { threadId, ...page }: { threadId: ThreadId } & PageRequest,
): Operation<ActivityLogPage> {
  return Result.gen(async function* () {
    if (
      !(yield* Result.await(
        database(() => threadStorage(scope).exists(threadId)),
      ))
    )
      return Result.err(threadNotFound());
    return Result.ok(
      yield* Result.await(
        database(() => activityLogStorage(scope).readPage(threadId, page)),
      ),
    );
  });
}
