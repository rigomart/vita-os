import type { ThreadId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { queryKeys, threadQueryKeys } from "./query-keys";

const threadId = "thread-1" as ThreadId;

describe("query keys", () => {
  it("nests each read under the family a command can invalidate", () => {
    expect(queryKeys.areas.detail("health")).toEqual([
      "areas",
      "detail",
      "health",
    ]);
    expect(queryKeys.areas.detail("health").slice(0, 2)).toEqual(
      queryKeys.areas.details(),
    );
    expect(queryKeys.threads.detail("book-checkup").slice(0, 2)).toEqual(
      queryKeys.threads.details(),
    );
    expect(queryKeys.threads.activityPage(threadId, 20).slice(0, 3)).toEqual(
      queryKeys.threads.activity(threadId),
    );
    expect(queryKeys.notes.done(20).slice(0, 2)).toEqual(
      queryKeys.notes.doneAll(),
    );
    expect(queryKeys.threadNotes.done(threadId, 20).slice(0, 3)).toEqual(
      queryKeys.threadNotes.doneAll(threadId),
    );
  });

  it("separates one Thread's reads from another's", () => {
    const other = "thread-2" as ThreadId;

    expect(queryKeys.threads.activity(threadId)).not.toEqual(
      queryKeys.threads.activity(other),
    );
    expect(queryKeys.threadNotes.open(threadId)).not.toEqual(
      queryKeys.threadNotes.open(other),
    );
  });

  it("keeps two page sizes of one history apart", () => {
    expect(queryKeys.threads.activityPage(threadId, 20)).not.toEqual(
      queryKeys.threads.activityPage(threadId, 50),
    );
  });

  it("keeps the Thread proof's key names pointing at the same reads", () => {
    expect(threadQueryKeys.detail("book-checkup")).toEqual(
      queryKeys.threads.detail("book-checkup"),
    );
    expect(threadQueryKeys.activity(threadId)).toEqual(
      queryKeys.threads.activity(threadId),
    );
  });
});
