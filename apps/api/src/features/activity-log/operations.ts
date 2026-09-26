import type {
  ActivityLogPage,
  OperationResult,
  PageRequest,
  ThreadId,
} from "@vita-os/contracts";

import type { RequestScope } from "../../platform/request-scope";

import { failed, succeeded } from "../../platform/operation";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { activityLogStorage } from "./storage";

/** A Thread's Activity Log is read through the Thread, which must be theirs. */
export async function getThreadActivityPage(
  scope: RequestScope,
  { threadId, ...page }: { threadId: ThreadId } & PageRequest,
): Promise<OperationResult<ActivityLogPage>> {
  if (!(await threadStorage(scope).exists(threadId))) {
    return failed(threadNotFound);
  }

  return succeeded(await activityLogStorage(scope).readPage(threadId, page));
}
