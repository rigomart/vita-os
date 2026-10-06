import type {
  ApplicationClient,
  Note,
  NoteId,
  OperationResult,
  Repeat,
  Task,
  TaskId,
  Thread,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { ThreadUpdateDecision } from "@vita-os/core";
import type { PropsWithChildren } from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import {
  decideCompleteTask,
  decideSetTaskDate,
  decideSetTaskRepeat,
  decideSkipTask,
  nextTaskDate,
} from "@vita-os/core";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAddNoteToThread } from "../notes/add-to-thread/hooks";
import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  failure,
  success,
} from "../test/fake-application-client";
import { anArea, aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import { useTasks } from "./use-tasks";
import { useUpdateThread } from "./use-update-thread";

/** The browser's own zone: what every command must send and decide in. */
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Tuesday, Oct 6 2026, mid-afternoon: one clock for the screen and the fake service. */
const NOW = new Date(2026, 9, 6, 15).getTime();
const at = (day: number, hour = 0) => new Date(2026, 9, day, hour).getTime();

const checkIn: Task = {
  _id: "check-in" as TaskId,
  text: "Evening check-in",
  // Sunday at 9 PM: two evenings missed.
  date: at(4, 21),
  repeat: { kind: "days", every: 1 },
};
const refill: Task = { _id: "refill" as TaskId, text: "Pharmacy refill" };
const seed = aThread({ revision: 4, tasks: [checkIn, refill] });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function withoutAbsent<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as T;
}

/**
 * A service that decides every Task command with the core rules, the way the
 * API does, at its own clock (the same `NOW`) and in the zone the command
 * carries. A stale revision or a refused rule is refused. Answers can be held
 * back until the test opens their gate.
 */
function coreService(options: { gated?: boolean } = {}) {
  let stored: Thread = seed;
  let flowing = !options.gated;
  const gates: Array<{ label: string; open: () => void }> = [];
  const answer = <T,>(label: string, value: T): Promise<T> =>
    flowing
      ? Promise.resolve(value)
      : new Promise<T>((resolve) => {
          gates.push({ label, open: () => resolve(value) });
        });

  const decide = (
    label: string,
    expectedRevision: number,
    rule: (thread: Thread) => ThreadUpdateDecision | null,
  ): Promise<OperationResult<Thread>> => {
    let decision: ThreadUpdateDecision | null;
    try {
      decision = expectedRevision === stored.revision ? rule(stored) : null;
    } catch (error) {
      return answer(
        label,
        failure<Thread>({
          code: "validation",
          message: (error as Error).message,
          retryable: false,
        }),
      );
    }
    if (decision === null) {
      return answer(
        label,
        failure<Thread>({
          code: "conflict",
          message: "changed",
          retryable: false,
        }),
      );
    }
    stored = withoutAbsent({
      ...stored,
      ...decision.patch,
      revision: stored.revision + 1,
    });
    return answer(label, success(stored));
  };

  const completeTask = vi.fn(
    (input: { taskId: TaskId; expectedRevision: number; timeZone?: string }) =>
      decide("completeTask", input.expectedRevision, (thread) =>
        decideCompleteTask(thread, input.taskId, {
          timeZone: input.timeZone,
          now: NOW,
        }),
      ),
  );
  const skipTask = vi.fn(
    (input: { taskId: TaskId; expectedRevision: number; timeZone: string }) =>
      decide("skipTask", input.expectedRevision, (thread) =>
        decideSkipTask(thread, input.taskId, {
          timeZone: input.timeZone,
          now: NOW,
        }),
      ),
  );
  const setTaskRepeat = vi.fn(
    (input: {
      taskId: TaskId;
      repeat: Repeat | null;
      expectedRevision: number;
      timeZone: string;
    }) =>
      decide("setTaskRepeat", input.expectedRevision, (thread) =>
        decideSetTaskRepeat(thread, input.taskId, input.repeat, input.timeZone),
      ),
  );
  const setTaskDate = vi.fn(
    (input: {
      taskId: TaskId;
      date: number | null;
      expectedRevision: number;
      timeZone?: string;
    }) =>
      decide("setTaskDate", input.expectedRevision, (thread) =>
        decideSetTaskDate(thread, input.taskId, input.date, input.timeZone),
      ),
  );
  const updateThread = vi.fn((input: UpdateThreadInput) => {
    stored = {
      ...stored,
      ...(input.title === undefined ? {} : { title: input.title }),
      revision: stored.revision + 1,
    };
    return answer("updateThread", success(stored));
  });
  const addNoteToThread = vi.fn(
    () => new Promise<never>(() => undefined),
  ) as unknown as ApplicationClient["addNoteToThread"];

  const client = createFakeApplicationClient({
    listOpenThreads: async () => success([stored]),
    getThreadDetail: async () => success({ thread: stored, area: anArea() }),
    getThreadActivityPage: async () => success({ entries: [] }),
    listOpenNotes: async () => success([]),
    completeTask,
    skipTask,
    setTaskRepeat,
    setTaskDate,
    updateThread,
    addNoteToThread,
  });

  return {
    client,
    completeTask,
    skipTask,
    setTaskRepeat,
    setTaskDate,
    updateThread,
    stored: () => stored,
    release: (label: string) => {
      const index = gates.findIndex((gate) => gate.label === label);
      if (index < 0) return false;
      gates.splice(index, 1)[0]!.open();
      return true;
    },
    flowFreely: () => {
      flowing = true;
      for (const gate of gates.splice(0)) gate.open();
    },
  };
}

function setup(service: ReturnType<typeof coreService>) {
  const feedback = { success: vi.fn(), error: vi.fn(), undoable: vi.fn() };
  const { cache, wrapper: Application } = createHarness(
    service.client,
    (cache) => {
      cache.setQueryData(queryKeys.threads.open(), [seed]);
    },
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <Application>
      <FeedbackProvider feedback={feedback}>{children}</FeedbackProvider>
    </Application>
  );
  const open = () =>
    cache.getQueryData<Thread[]>(queryKeys.threads.open())?.[0];
  // The surface re-renders with what it shows, as Thread detail does.
  const { result: tasks, rerender } = renderHook(
    ({ thread }: { thread: Thread }) => useTasks(thread),
    { wrapper, initialProps: { thread: seed } },
  );
  const { result: update } = renderHook(() => useUpdateThread(seed), {
    wrapper,
  });
  const { result: add } = renderHook(() => useAddNoteToThread(), { wrapper });
  const showing = () => rerender({ thread: open()! });
  return { feedback, tasks, update, add, open, showing };
}

const task = (thread: Thread | undefined, taskId: TaskId) =>
  thread?.tasks?.find((candidate) => candidate._id === taskId);

/** Tonight at 9 PM: the first daily occurrence that is not before today. */
const tonight = nextTaskDate(checkIn.date!, checkIn.repeat!, zone, NOW);

describe("completing a repeating Task", () => {
  it("keeps it and shows its next occurrence at once, the one the service answers with", async () => {
    const service = coreService({ gated: true });
    const { feedback, tasks, open } = setup(service);

    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.complete(checkIn._id);
    });

    // Shown before the service answers: kept, moved to tonight, missed
    // evenings collapsed, nothing removed.
    await waitFor(() =>
      expect(task(open(), checkIn._id)).toEqual({ ...checkIn, date: tonight }),
    );
    expect(tonight).toBe(at(6, 21));
    expect(open()?.tasks).toHaveLength(2);

    await act(async () => {
      service.flowFreely();
      await completing;
    });
    expect(service.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: checkIn._id,
        timeZone: zone,
        expectedRevision: 4,
      }),
    );
    // The service's answer, decided in the same zone at the same now, agrees.
    expect(task(service.stored(), checkIn._id)).toEqual({
      ...checkIn,
      date: tonight,
    });
    expect(task(open(), checkIn._id)).toEqual(
      task(service.stored(), checkIn._id),
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("goes out once when activated twice on the same occurrence", async () => {
    const service = coreService();
    const { feedback, tasks, open } = setup(service);

    await act(async () => {
      await Promise.all([
        tasks.current.complete(checkIn._id),
        tasks.current.complete(checkIn._id),
      ]);
    });

    expect(service.completeTask).toHaveBeenCalledTimes(1);
    expect(task(open(), checkIn._id)?.date).toBe(tonight);
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("still sends the zone for a one-off Task, which it removes", async () => {
    const service = coreService();
    const { tasks, open } = setup(service);

    await act(async () => {
      await tasks.current.complete(refill._id);
    });

    expect(service.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: refill._id, timeZone: zone }),
    );
    await waitFor(() => expect(open()?.tasks).toEqual([checkIn]));
  });
});

describe("skipping a repeating Task", () => {
  it("moves it to its next occurrence at once, as the service does", async () => {
    const service = coreService({ gated: true });
    const { feedback, tasks, open } = setup(service);

    let skipping: Promise<unknown> | undefined;
    act(() => {
      skipping = tasks.current.skip(checkIn._id);
    });
    await waitFor(() => expect(task(open(), checkIn._id)?.date).toBe(tonight));

    await act(async () => {
      service.flowFreely();
      await skipping;
    });
    expect(service.skipTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: checkIn._id,
        timeZone: zone,
        expectedRevision: 4,
      }),
    );
    expect(task(service.stored(), checkIn._id)?.date).toBe(tonight);
    expect(task(open(), checkIn._id)).toEqual(
      task(service.stored(), checkIn._id),
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  // A double-click names the occurrence on screen twice: it skips that one
  // occurrence once. A skip issued once the next occurrence shows skips that one.
  it("skips the occurrence on screen once however often it is activated, and the next one when asked again", async () => {
    const service = coreService();
    const { feedback, tasks, open, showing } = setup(service);

    await act(async () => {
      await Promise.all([
        tasks.current.skip(checkIn._id),
        tasks.current.skip(checkIn._id),
      ]);
    });
    expect(service.skipTask).toHaveBeenCalledTimes(1);
    expect(task(open(), checkIn._id)?.date).toBe(tonight);

    showing();
    await act(async () => {
      await tasks.current.skip(checkIn._id);
    });
    expect(service.skipTask).toHaveBeenCalledTimes(2);
    expect(task(service.stored(), checkIn._id)?.date).toBe(at(7, 21));
    expect(task(open(), checkIn._id)?.date).toBe(at(7, 21));
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("is not sent for a one-off Task", async () => {
    const service = coreService();
    const { feedback, tasks, open } = setup(service);

    await act(async () => {
      await tasks.current.skip(refill._id);
    });

    expect(service.skipTask).not.toHaveBeenCalled();
    expect(open()?.tasks).toEqual([checkIn, refill]);
    expect(feedback.error).not.toHaveBeenCalled();
  });
});

describe("a Task's Repeat", () => {
  const dated: Task = { ...refill, date: at(6, 9) };

  it("is set with the zone, and a weekly choice moves the date to the first chosen day on screen as the service does", async () => {
    const service = coreService();
    const { tasks, open, showing } = setup(service);
    // Date the one-off Task first (Tuesday 9 AM), through the same queue.
    await act(async () => {
      await tasks.current.setDate(refill._id, dated.date!);
    });
    showing();

    const weekly: Repeat = { kind: "weekly", weekdays: [4] };
    await act(async () => {
      await tasks.current.setRepeat(refill._id, weekly);
    });

    expect(service.setTaskRepeat).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: refill._id,
        repeat: weekly,
        timeZone: zone,
      }),
    );
    // Thursday, Oct 8, at the same 9 AM.
    expect(task(service.stored(), refill._id)).toEqual({
      ...dated,
      date: at(8, 9),
      repeat: weekly,
    });
    expect(task(open(), refill._id)).toEqual(
      task(service.stored(), refill._id),
    );
  });

  it("shows the weekly date move before the service answers", async () => {
    const service = coreService({ gated: true });
    const { tasks, open } = setup(service);
    const weekly: Repeat = { kind: "weekly", weekdays: [3] };

    let setting: Promise<unknown> | undefined;
    act(() => {
      setting = tasks.current.setRepeat(checkIn._id, weekly);
    });
    // Sunday 9 PM snaps to Wednesday 9 PM.
    await waitFor(() =>
      expect(task(open(), checkIn._id)).toEqual({
        ...checkIn,
        date: at(7, 21),
        repeat: weekly,
      }),
    );
    await act(async () => {
      service.flowFreely();
      await setting;
    });
    expect(task(open(), checkIn._id)).toEqual(
      task(service.stored(), checkIn._id),
    );
  });

  it("is cleared, keeping the date", async () => {
    const service = coreService();
    const { tasks, open } = setup(service);

    await act(async () => {
      await tasks.current.setRepeat(checkIn._id, null);
    });

    expect(service.setTaskRepeat).toHaveBeenCalledWith(
      expect.objectContaining({ repeat: null, timeZone: zone }),
    );
    const { repeat: _repeat, ...oneOff } = checkIn;
    await waitFor(() => expect(task(open(), checkIn._id)).toEqual(oneOff));
    expect(task(service.stored(), checkIn._id)).toEqual(oneOff);
  });

  it("goes when the date is cleared, on screen and at the service", async () => {
    const service = coreService({ gated: true });
    const { tasks, open } = setup(service);

    let clearing: Promise<unknown> | undefined;
    act(() => {
      clearing = tasks.current.setDate(checkIn._id, null);
    });
    const plain = { _id: checkIn._id, text: checkIn.text };
    await waitFor(() => expect(task(open(), checkIn._id)).toEqual(plain));

    await act(async () => {
      service.flowFreely();
      await clearing;
    });
    expect(task(service.stored(), checkIn._id)).toEqual(plain);
    expect(task(open(), checkIn._id)).toEqual(plain);
  });

  it("is not sent when it changes nothing", async () => {
    const service = coreService();
    const { tasks } = setup(service);

    await act(async () => {
      await Promise.all([
        tasks.current.setRepeat(checkIn._id, { kind: "days", every: 3 }),
        tasks.current.setRepeat(checkIn._id, { kind: "days", every: 3 }),
      ]);
    });

    expect(service.setTaskRepeat).toHaveBeenCalledTimes(1);
  });
});

describe("the conversion lock", () => {
  const dentist: Note = {
    _id: "dentist" as NoteId,
    body: "Call the dentist",
    followUp: at(9, 10),
    state: "open",
    createdAt: 1_000,
  };

  it("refuses skip, complete and Repeat changes while a Note is being added to the Thread", async () => {
    const service = coreService();
    const { feedback, tasks, add, open } = setup(service);

    act(() => {
      add.current.mutate({ note: dentist, thread: seed });
    });
    await waitFor(() => expect(open()?.tasks).toHaveLength(3));

    await act(async () => {
      await tasks.current.skip(checkIn._id);
      await tasks.current.complete(checkIn._id);
      await tasks.current.setRepeat(checkIn._id, null);
    });

    expect(service.skipTask).not.toHaveBeenCalled();
    expect(service.completeTask).not.toHaveBeenCalled();
    expect(service.setTaskRepeat).not.toHaveBeenCalled();
    expect(feedback.error).toHaveBeenCalledTimes(3);
    expect(feedback.error).toHaveBeenCalledWith(
      "A note is being added to this thread. Try again in a moment.",
    );
    expect(task(open(), checkIn._id)).toEqual(checkIn);
  });
});

describe("a Thread edit between repeating-Task commands", () => {
  it("goes out in turn, and the command behind it carries its revision", async () => {
    const service = coreService({ gated: true });
    const { feedback, tasks, update, open, showing } = setup(service);

    let skipping: Promise<unknown> | undefined;
    let renaming: Promise<unknown> | undefined;
    act(() => {
      skipping = tasks.current.skip(checkIn._id);
    });
    await waitFor(() => expect(task(open(), checkIn._id)?.date).toBe(tonight));
    act(() => {
      renaming = update
        .current({ title: "Mom's recovery" })
        .catch(() => undefined);
    });
    // The surface shows tonight's occurrence and completes it.
    showing();
    let completing: Promise<unknown> | undefined;
    act(() => {
      completing = tasks.current.complete(checkIn._id);
    });
    await waitFor(() =>
      expect(task(open(), checkIn._id)?.date).toBe(at(7, 21)),
    );

    // Nothing reaches the service out of turn.
    expect(service.updateThread).not.toHaveBeenCalled();
    expect(service.completeTask).not.toHaveBeenCalled();

    await act(async () => {
      service.flowFreely();
      await Promise.all([skipping, renaming, completing]);
    });

    expect(service.skipTask).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 4 }),
    );
    expect(service.completeTask).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 6, timeZone: zone }),
    );
    expect(service.skipTask.mock.invocationCallOrder[0]!).toBeLessThan(
      service.updateThread.mock.invocationCallOrder[0]!,
    );
    expect(service.updateThread.mock.invocationCallOrder[0]!).toBeLessThan(
      service.completeTask.mock.invocationCallOrder[0]!,
    );
    expect(service.stored()).toMatchObject({
      title: "Mom's recovery",
      revision: 7,
    });
    expect(task(service.stored(), checkIn._id)?.date).toBe(at(7, 21));
    await waitFor(() =>
      expect(task(open(), checkIn._id)).toEqual(
        task(service.stored(), checkIn._id),
      ),
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
