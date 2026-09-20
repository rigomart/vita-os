import type { ThreadId } from "@vita-os/contracts";

import { expect, it } from "vitest";

import { threadQueryKeys } from "./query-keys";

it("defines stable Thread detail and paginated Activity Log keys", () => {
  const threadId = "thread-1" as ThreadId;
  expect(threadQueryKeys.all).toEqual(["thread"]);
  expect(threadQueryKeys.detail("book-checkup")).toEqual([
    "thread",
    "detail",
    "book-checkup",
  ]);
  expect(threadQueryKeys.activity(threadId)).toEqual([
    "thread",
    "activity",
    threadId,
  ]);
  expect(threadQueryKeys.activityPage(threadId, 20)).toEqual([
    "thread",
    "activity",
    threadId,
    20,
  ]);
  expect(threadQueryKeys.activityPage(threadId, 20)).not.toEqual(
    threadQueryKeys.activityPage(threadId, 50),
  );
});
