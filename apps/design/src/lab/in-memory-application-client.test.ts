import type {
  ApplicationClient,
  OperationResult,
  TaskId,
  ThreadNoteId,
} from "@vita-os/contracts";

import { describeApplicationClient } from "@vita-os/contracts/testing";
import { describe, expect, it } from "vitest";

import { createInMemoryApplicationClient } from "./in-memory-application-client";
import { scenarios } from "./scenarios";

function value<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

async function threadWithTask(client: ApplicationClient, date?: number) {
  const thread = value(await client.createThread({ title: "Fix the tap" }));
  const taskId = "task-1" as TaskId;
  value(
    await client.addTask({
      threadId: thread._id,
      taskId,
      text: "Buy a cartridge",
      ...(date === undefined ? {} : { date }),
    }),
  );
  return { thread, taskId };
}

describeApplicationClient("The in-memory client", async () =>
  createInMemoryApplicationClient(),
);

describe("in-memory application client", () => {
  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
    "seeds the %s scenario through the real rules",
    async (_, scenario) => {
      await expect(
        scenario.seed(createInMemoryApplicationClient()),
      ).resolves.toBeUndefined();
    },
  );

  it("records a completion in the Activity Log and on the Thread", async () => {
    const client = createInMemoryApplicationClient();
    const { thread, taskId } = await threadWithTask(client);

    const completed = value(
      await client.completeTask({
        threadId: thread._id,
        taskId,
        expectedOccurrence: null,
      }),
    );
    const log = value(
      await client.getThreadActivityPage({ threadId: thread._id, limit: 10 }),
    );

    expect(completed.tasks).toBeUndefined();
    expect(log.entries).toHaveLength(1);
    expect(completed.lastActivityContent).toBe(log.entries[0]!.content);
  });

  it("captures a completion Note without an activity summary", async () => {
    const client = createInMemoryApplicationClient();
    const { thread, taskId } = await threadWithTask(client);

    const completed = value(
      await client.completeTask({
        threadId: thread._id,
        taskId,
        expectedOccurrence: null,
        note: { id: "note-1" as ThreadNoteId, body: "Fitted it" },
      }),
    );
    const notes = value(
      await client.listOpenThreadNotes({ threadId: thread._id }),
    );

    expect(completed.lastActivityContent).toBeUndefined();
    expect(notes.map((note) => note._id)).toEqual(["note-1"]);
  });

  it("refuses a completion of an occurrence that moved", async () => {
    const client = createInMemoryApplicationClient();
    const { thread, taskId } = await threadWithTask(client, 86_400_000);

    const result = await client.completeTask({
      threadId: thread._id,
      taskId,
      expectedOccurrence: null,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("moves a dated Note into a Thread as a Thread Note and a Task", async () => {
    const client = createInMemoryApplicationClient();
    const { thread } = await threadWithTask(client);
    const note = value(
      await client.createNote({ body: "# Call the plumber", followUp: 5_000 }),
    );

    const added = value(
      await client.addNoteToThread({ noteId: note._id, threadId: thread._id }),
    );

    expect(added.thread.tasks?.at(-1)).toMatchObject({
      text: "Call the plumber",
      date: 5_000,
    });
    expect(added.threadNote.body).toBe("# Call the plumber");
    expect(value(await client.countOpenNotes())).toBe(0);
  });

  it("drops Tasks on resolution and lists the Thread as resolved", async () => {
    const client = createInMemoryApplicationClient();
    const { thread } = await threadWithTask(client);

    const resolved = value(
      await client.updateThread({ threadId: thread._id, state: "resolved" }),
    );

    expect(resolved.tasks).toBeUndefined();
    expect(value(await client.listOpenThreads())).toEqual([]);
    expect(
      value(await client.listResolvedThreads()).map((each) => each._id),
    ).toEqual([thread._id]);
  });

  it("pages and searches Archived Notes", async () => {
    const client = createInMemoryApplicationClient();
    for (const body of ["Buy milk", "Buy bread", "Call Sam"]) {
      const note = value(await client.createNote({ body }));
      value(await client.markNoteDone({ noteId: note._id }));
    }

    const first = value(
      await client.getDoneNotePage({ limit: 1, query: "buy" }),
    );
    const second = value(
      await client.getDoneNotePage({
        limit: 1,
        query: "buy",
        cursor: first.nextCursor!,
      }),
    );

    expect([...first.entries, ...second.entries].map((n) => n.body)).toEqual(
      expect.arrayContaining(["Buy milk", "Buy bread"]),
    );
    expect(second.nextCursor).toBeUndefined();
  });

  it("answers refusals as application errors", async () => {
    const client = createInMemoryApplicationClient();

    expect(await client.createThread({ title: "  " })).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(
      await client.getThreadDetail({ slug: "nothing-here" }),
    ).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("hands out copies, never its own records", async () => {
    const client = createInMemoryApplicationClient();
    const thread = value(await client.createThread({ title: "Original" }));

    thread.title = "Changed by a caller";

    expect(value(await client.listOpenThreads())[0]!.title).toBe("Original");
  });
});
