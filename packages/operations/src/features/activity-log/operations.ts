import type {
  ActivityLogPage,
  PageRequest,
  ThreadId,
} from "@vita-os/contracts";

import { Result } from "better-result";

import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";

import { database } from "../../platform/operation";
import { requirePageLimit, type PageSize } from "../../platform/page-size";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { invalidActivityPagination } from "./errors";
import { activityLogStorage } from "./storage";

export const ACTIVITY_PAGE_SIZE: PageSize = { fallback: 20, maximum: 50 };

/** A Thread's Activity Log is read through the Thread, which must be theirs. */
export function getThreadActivityPage(
  scope: RequestScope,
  { threadId, ...page }: { threadId: ThreadId } & PageRequest,
): Operation<ActivityLogPage> {
  return Result.gen(async function* () {
    yield* requirePageLimit(
      page.limit,
      ACTIVITY_PAGE_SIZE,
      invalidActivityPagination,
    );
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
