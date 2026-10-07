import type {
  ApplicationClient,
  CompleteTaskInput,
  Note,
  NoteId,
  OperationResult,
  Task,
  TaskId,
  Thread,
  ThreadNote,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nextTaskDate } from "@vita-os/core";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FakeCompletionState } from "../test/fake-application-client";

import { useAddNoteToThread } from "../notes/add-to-thread/hooks";
import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  failure,
  success,
} from "../test/fake-application-client";
import { anArea, aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import { useThreadNotes } from "../thread-notes/hooks";
import { useOpenThreads } from "./hooks";
import { useTasks } from "./use-tasks";

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Tuesday, Oct 6 2026, mid-afternoon. */
const NOW = new Date(2026, 9, 6, 15).getTime();
const at = (day: number, hour = 0) => new Date(2026, 9, day, hour).getTime();

const checkIn: Task = {
  _id: "check-in" as TaskId,
  text: "Evening check-in",
  date: at(4, 21),
  repeat: { kind: "days", every: 1 },
};
const refill: Task = { _id: "refill" as TaskId, text: "Pharmacy refill" };
const seed = aThread({ revision: 4, tasks: [checkIn, refill] });
const tonight = nextTaskDate(checkIn.date!, checkIn.repeat!, zone, NOW);

const unavailable = {
  code: "unavailable",
  message: "The service is temporarily unavailable.",
  retryable: true,
} as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * The in-memory service (the fake's own completion, all or nothing) behind a
 * switchboard: answers can be held back, the connection can drop after the
 * service committed or before it, and the reads can be offline.
 */
function service() {
  const state: FakeCompletionState = {
    threads: [seed],
    threadNotes: new Map([[seed._id, []]]),
  };
  const gates: Array<() => void> = [];
  const switches = {
    gated: false,
    /** The service commits, then the answer is lost. */
    dropAfterCommit: false,
    /** The request never reaches the service. */
    dropBeforeCommit: false,
    offline: false,
  };
  const base = createFakeApplicationClient(
    {
      listOpenThreads: async () =>
        switches.offline ? failure(unavailable) : success(state.threads),
      getThreadDetail: async () =>
        success({ thread: state.threads[0]!, area: anArea() }),
      listOpenNotes: async () => success([]),
      addNoteToThread: (() =>
        new Promise<never>(
          () => undefined,
        )) as ApplicationClient["addNoteToThread"],
    },
    state,
  );
  const completeTask = vi.fn(
    async (input: CompleteTaskInput): Promise<OperationResult<Thread>> => {
      if (switches.gated) await new Promise<void>((open) => gates.push(open));
      if (switches.dropBeforeCommit) return failure(unavailable);
      const result = await base.completeTask(input);
      return switches.dropAfterCommit ? failure(unavailable) : result;
    },
  );
  const listOpenThreadNotes = vi.fn(
    (input: Parameters<ApplicationClient["listOpenThreadNotes"]>[0]) =>
      switches.offline
        ? Promise.resolve(failure<ThreadNote[]>(unavailable))
        : base.listOpenThreadNotes(input),
  );
  const client: ApplicationClient = {
    ...base,
    completeTask,
    listOpenThreadNotes,
  };
  return {
    client,
    state,
    switches,
    completeTask,
    release: () => {
      switches.gated = false;
      for (const open of gates.splice(0)) open();
    },
    stored: () => state.threads[0]!,
    storedNotes: () => state.threadNotes.get(seed._id) ?? [],
  };
}

function setup(fake: ReturnType<typeof service>, { observe = true } = {}) {
  const feedback = { success: vi.fn(), error: vi.fn(), undoable: vi.fn() };
  const { cache, wrapper: Application } = createHarness(
    fake.client,
    (cache) => {
      cache.setQueryData(queryKeys.threads.open(), [seed]);
      cache.setQueryData(queryKeys.threadNotes.open(seed._id), []);
    },
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  // The reads Thread detail observes, so a settled command refetches them.
  if (observe) {
    renderHook(() => useOpenThreads(), { wrapper });
    renderHook(() => useThreadNotes(seed._id), { wrapper });
  }
  const { result: tasks, unmount } = renderHook(() => useTasks(seed), {
    wrapper,
  });
  const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  const notes = () =>
    cache.getQueryData<ThreadNote[]>(queryKeys.threadNotes.open(seed._id));
  return { feedback, tasks, unmount, add, open, notes };
}

const task = (thread: Thread | undefined, taskId: TaskId) =>
  thread?.tasks?.find((candidate) => candidate._id === taskId);
/** The text came back once, in an error toast, with a Copy action. */
function expectHandedBack(
  feedback: { error: ReturnType<typeof vi.fn> },
  message: unknown,
  text: string,
) {
  expect(feedback.error).toHaveBeenCalledExactlyOnceWith(message, {
    description: text,
    action: { label: "Copy note", onClick: expect.any(Function) },
  });
}
const sentNote = (fake: ReturnType<typeof service>, call = 0) =>
  fake.completeTask.mock.calls[call]![0].note;

describe("completing a Task with a note", () => {
  it("shows the Task change and the Note at once, before the service answers", async () => {
    const fake = service();
    fake.switches.gated = true;
    const { tasks, open, notes, feedback } = setup(fake);

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.completeWithNote(refill._id, "Picked it up");
    });

    await waitFor(() => expect(task(open(), refill._id)).toBeUndefined());
    expect(notes()).toEqual([
      expect.objectContaining({ body: "Picked it up", state: "open" }),
    ]);

    await act(async () => {
      fake.release();
      await completing;
    });
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("sends one command carrying the zone and the Note, and keeps the Note's ID once answered", async () => {
    const fake = service();
    fake.switches.gated = true;
    const { tasks, notes, open } = setup(fake);

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.completeWithNote(refill._id, " Picked it up ");
    });
    await waitFor(() => expect(notes()).toHaveLength(1));
    const shownId = notes()![0]!._id;

    let outcome: unknown;
    await act(async () => {
      fake.release();
      outcome = await completing;
    });

    expect(outcome).toBe("completed");
    expect(fake.completeTask).toHaveBeenCalledTimes(1);
    expect(fake.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: seed._id,
        taskId: refill._id,
        timeZone: zone,
        expectedRevision: 4,
        note: { id: shownId, body: "Picked it up" },
      }),
    );
    // The refetched Notes hold the same Note, once.
    await waitFor(() => expect(fake.storedNotes()).toHaveLength(1));
    await waitFor(() =>
      expect(notes()).toEqual([
        expect.objectContaining({ _id: shownId, body: "Picked it up" }),
      ]),
    );
    expect(task(open(), refill._id)).toBeUndefined();
  });

  it("rolls back the Task change and the Note together when refused", async () => {
    const fake = service();
    // Changed elsewhere: the revision the screen carries is stale.
    fake.state.threads = [{ ...seed, revision: 5 }];
    fake.switches.gated = true;
    const { tasks, open, notes, feedback } = setup(fake);

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.completeWithNote(refill._id, "Picked it up");
    });
    await waitFor(() => expect(notes()).toHaveLength(1));
    expect(task(open(), refill._id)).toBeUndefined();

    let outcome: unknown;
    await act(async () => {
      fake.release();
      outcome = await completing;
    });

    expect(outcome).toBe("failed");
    await waitFor(() => expect(task(open(), refill._id)).toEqual(refill));
    expect(notes()).toEqual([]);
    expect(fake.storedNotes()).toEqual([]);
    expectHandedBack(
      feedback,
      "This Thread changed elsewhere. It has been refreshed. Your note was not saved.",
      "Picked it up",
    );
  });

  it("moves a repeating Task to its next occurrence and captures the Note", async () => {
    const fake = service();
    fake.switches.gated = true;
    const { tasks, open, notes } = setup(fake);

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.completeWithNote(checkIn._id, "Slept well");
    });
    await waitFor(() => expect(task(open(), checkIn._id)?.date).toBe(tonight));
    expect(notes()).toEqual([expect.objectContaining({ body: "Slept well" })]);

    await act(async () => {
      fake.release();
      await completing;
    });
    expect(fake.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: checkIn._id, timeZone: zone }),
    );
    expect(task(fake.stored(), checkIn._id)).toEqual({
      ...checkIn,
      date: tonight,
    });
    expect(fake.storedNotes()).toHaveLength(1);
    await waitFor(() =>
      expect(task(open(), checkIn._id)).toEqual(
        task(fake.stored(), checkIn._id),
      ),
    );
  });

  it("goes out once when activated twice", async () => {
    const fake = service();
    const { tasks, notes, feedback } = setup(fake);

    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        tasks.current.completeWithNote(checkIn._id, "Slept well"),
        tasks.current.completeWithNote(checkIn._id, "Slept well"),
      ]);
    });

    expect(fake.completeTask).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual(["completed", "duplicate"]);
    expect(fake.storedNotes()).toHaveLength(1);
    await waitFor(() => expect(notes()).toHaveLength(1));
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("is refused while a Note is being added to the Thread", async () => {
    const fake = service();
    const { tasks, add, open, notes, feedback } = setup(fake);
    const dentist: Note = {
      _id: "dentist" as NoteId,
      body: "Call the dentist",
      followUp: at(9, 10),
      state: "open",
      createdAt: 1_000,
    };
    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await waitFor(() => expect(open()?.tasks).toHaveLength(3));

    let outcome: unknown;
    await act(async () => {
      outcome = await tasks.current.completeWithNote(refill._id, "Picked up");
    });

    expect(outcome).toBe("failed");
    expect(fake.completeTask).not.toHaveBeenCalled();
    expectHandedBack(
      feedback,
      "A note is being added to this thread. Try again in a moment. Your note was not saved.",
      "Picked up",
    );
    expect(task(open(), refill._id)).toEqual(refill);
    // Only the Note being added shows.
    expect(notes()?.map((note) => note.body)).toEqual(["Call the dentist"]);
  });
});

describe("completing with a note when the connection drops", () => {
  it("counts it completed, quietly, when this attempt's Note is found, and shows the Note", async () => {
    const fake = service();
    fake.switches.dropAfterCommit = true;
    // Nothing observes the reads: the lookup itself brings the Notes up to date.
    const { tasks, notes, feedback } = setup(fake, { observe: false });

    let outcome: unknown;
    await act(async () => {
      outcome = await tasks.current.completeWithNote(refill._id, "Picked up");
    });

    expect(outcome).toBe("completed");
    expect(notes()).toEqual([
      expect.objectContaining({ _id: sentNote(fake)!.id, body: "Picked up" }),
    ]);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("hands the text back in a toast with Copy when the Note is not there", async () => {
    // Gives the page a clipboard to copy into.
    userEvent.setup();
    const fake = service();
    fake.switches.dropBeforeCommit = true;
    const { tasks, open, notes, feedback } = setup(fake);

    let outcome: unknown;
    await act(async () => {
      outcome = await tasks.current.completeWithNote(refill._id, "Picked up");
    });

    expect(outcome).toBe("failed");
    expect(task(open(), refill._id)).toEqual(refill);
    expect(notes()).toEqual([]);
    expectHandedBack(
      feedback,
      "Couldn’t reach Vita OS. The task was not completed and your note was not saved.",
      "Picked up",
    );
    const [, detail] = feedback.error.mock.calls[0]!;
    detail!.action!.onClick();
    await expect(navigator.clipboard.readText()).resolves.toBe("Picked up");
  });

  it("says it could not confirm when the Notes cannot be read, and hands the text back", async () => {
    const fake = service();
    fake.switches.dropAfterCommit = true;
    fake.switches.offline = true;
    const { tasks, feedback } = setup(fake, { observe: false });

    let outcome: unknown;
    await act(async () => {
      outcome = await tasks.current.completeWithNote(refill._id, "Picked up");
    });

    expect(outcome).toBe("failed");
    expectHandedBack(
      feedback,
      expect.stringMatching(/^Couldn’t confirm whether/),
      "Picked up",
    );
    expect(feedback.error.mock.calls[0]![0]).not.toMatch(/not saved/);
  });

  it("still hands the text back once the Thread pane has gone", async () => {
    const fake = service();
    fake.switches.gated = true;
    fake.switches.dropBeforeCommit = true;
    const { tasks, unmount, feedback } = setup(fake);

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.completeWithNote(refill._id, "Picked up");
    });
    unmount();
    await act(async () => {
      fake.release();
      await completing;
    });

    expectHandedBack(
      feedback,
      expect.stringMatching(/^Couldn’t reach Vita OS/),
      "Picked up",
    );
  });
});
