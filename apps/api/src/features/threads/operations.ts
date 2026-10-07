import type {
  AddTaskInput,
  CommandAcknowledgement,
  CompleteTaskInput,
  CreateThreadInput,
  EditTaskInput,
  FocusTaskInput,
  RemoveTaskInput,
  SetTaskDateInput,
  SetTaskRepeatInput,
  SkipTaskInput,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { ThreadPatch, ThreadUpdateDecision } from "@vita-os/core";

import { commandAcknowledged } from "@vita-os/contracts";
import {
  clearedToAbsent,
  decideAddTask,
  decideCompleteTask,
  decideEditTask,
  decideFocusTask,
  decideRemoveTask,
  decideSetTaskDate,
  decideSetTaskRepeat,
  decideSkipTask,
  decideThreadUpdate,
  generateSlug,
  requireTaskId,
  requireTaskText,
  requireNonBlankText,
  requireTimeZone,
} from "@vita-os/core";
import { Result } from "better-result";

import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";
import type { ThreadChange } from "./storage";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { moveConflict, threadNotFound } from "./errors";
import { isThreadSlugTaken, threadStorage } from "./storage";

/** Re-read and recompute whole-JSON Task writes after losing a storage race. */
const CHANGE_ATTEMPTS = 3;

/** How many times a create re-mints a colliding slug. */
const SLUG_ATTEMPTS = 3;

export function listOpenThreads(scope: RequestScope): Operation<Thread[]> {
  return database(() => threadStorage(scope).listOpen());
}

export function listResolvedThreads(scope: RequestScope): Operation<Thread[]> {
  return database(() => threadStorage(scope).listResolved());
}

export function getThreadDetail(
  scope: RequestScope,
  input: {
    slug: string;
  },
): Operation<ThreadDetail> {
  return Result.gen(async function* () {
    const detail = yield* Result.await(
      database(() => threadStorage(scope).findDetail(input.slug)),
    );
    return detail === null ? Result.err(threadNotFound()) : Result.ok(detail);
  });
}

/**
 * A Thread needs only a title. When it is labeled at creation, the Area must be
 * one the owner holds, so the failure names the Area when it is not theirs.
 */
export function createThread(
  scope: RequestScope,
  input: CreateThreadInput,
): Operation<Thread> {
  return Result.gen(async function* () {
    const threads = threadStorage(scope);
    const title = yield* attempt(() =>
      requireNonBlankText(input.title, "Thread title"),
    );

    for (let execution = 0; execution < SLUG_ATTEMPTS; execution += 1) {
      const slug = generateSlug(title);
      const inserted = await database(
        () => threads.insert({ ...input, title, slug }),
        isThreadSlugTaken,
      );
      if (Result.isError(inserted)) {
        if (inserted.error._tag === "SlugTaken") continue;
        return Result.err(inserted.error);
      }
      const thread = inserted.value;
      return thread === null ? Result.err(areaNotFound()) : Result.ok(thread);
    }
    return Result.err(new ChangeConflict());
  });
}

/**
 * One Thread edit: title, Summary, Area, or lifecycle.
 * The Activity Log the change earns is written with it or not at all.
 */
export function updateThread(
  scope: RequestScope,
  { threadId, resolutionNote, ...requested }: UpdateThreadInput,
): Operation<Thread> {
  return Result.gen(async function* () {
    const areas = areaStorage(scope);
    const title =
      requested.title === undefined
        ? undefined
        : yield* attempt(() =>
            requireNonBlankText(requested.title!, "Thread title"),
          );

    return await changeThread(scope, threadId, (thread) =>
      Result.gen(async function* () {
        const patch: ThreadPatch = clearedToAbsent({
          ...requested,
          ...(title === undefined ? {} : { title }),
        });
        // A retitled Thread gets a new slug; the old one stops resolving.
        const rename =
          title !== undefined && title !== thread.title
            ? { slug: generateSlug(title) }
            : {};

        // Naming the ends of a label change is what lets the Activity Log say
        // where the Thread came from and went. An Area that is not the owner's
        // stops the change here.
        const areaNames: { from?: string; to?: string } = {};
        if (Object.hasOwn(patch, "areaId") && patch.areaId !== thread.areaId) {
          if (patch.areaId !== undefined) {
            const destination = yield* Result.await(
              database(() => areas.find(patch.areaId!)),
            );
            if (destination === null) return Result.err(areaNotFound());
            areaNames.to = destination.name;
          }
          if (thread.areaId !== undefined) {
            const origin = yield* Result.await(
              database(() => areas.find(thread.areaId!)),
            );
            if (origin !== null) areaNames.from = origin.name;
          }
        }

        return attempt(() =>
          decideThreadUpdate({
            thread,
            patch: { ...patch, ...rename },
            ...(resolutionNote === undefined ? {} : { resolutionNote }),
            areaNames,
          }),
        );
      }),
    );
  });
}

/** A new Task joins the end of the Thread's Tasks, unfocused. */
export function addTask(
  scope: RequestScope,
  input: AddTaskInput,
): Operation<Thread> {
  return Result.gen(async function* () {
    const task = yield* attempt(() => ({
      _id: requireTaskId(input.taskId),
      text: requireTaskText(input.text),
      ...(input.date === undefined ? {} : { date: input.date }),
    }));
    return await changeTasks(scope, input, (thread) =>
      decideAddTask(thread, task),
    );
  });
}

export function editTask(
  scope: RequestScope,
  input: EditTaskInput,
): Operation<Thread> {
  return Result.gen(async function* () {
    const text = yield* attempt(() => requireTaskText(input.text));
    return await changeTasks(scope, input, (thread) =>
      decideEditTask(thread, input.taskId, text),
    );
  });
}

export function removeTask(
  scope: RequestScope,
  input: RemoveTaskInput,
): Operation<Thread> {
  return changeTasks(scope, input, (thread) =>
    decideRemoveTask(thread, input.taskId),
  );
}

/**
 * Complete one Task, focused or not. Its Activity Log entry is written with the
 * change or not at all, and two competing completions of the same Task record
 * one: the loser finds the occurrence changed.
 */
export function completeTask(
  scope: RequestScope,
  input: CompleteTaskInput,
): Operation<Thread> {
  return changeTasks(
    scope,
    input,
    (thread) => {
      const task = thread.tasks?.find((task) => task._id === input.taskId);
      if (
        task === undefined ||
        (task.date ?? null) !== input.expectedOccurrence
      )
        return null;
      if (input.timeZone !== undefined) requireTimeZone(input.timeZone);
      return decideCompleteTask(thread, input.taskId, {
        timeZone: input.timeZone,
        now: scope.clock.now(),
      });
    },
    input.note,
  );
}

export function focusTask(
  scope: RequestScope,
  input: FocusTaskInput,
): Operation<Thread> {
  return changeTasks(scope, input, (thread) =>
    decideFocusTask(thread, input.taskId),
  );
}

/** Set, change or clear one Task's date. It writes no Activity Log entry. */
export function setTaskDate(
  scope: RequestScope,
  input: SetTaskDateInput,
): Operation<Thread> {
  return changeTasks(scope, input, (thread) =>
    decideSetTaskDate(thread, input.taskId, input.date, input.timeZone),
  );
}

export function setTaskRepeat(
  scope: RequestScope,
  input: SetTaskRepeatInput,
): Operation<Thread> {
  return changeTasks(scope, input, (thread) =>
    decideSetTaskRepeat(thread, input.taskId, input.repeat, input.timeZone),
  );
}

export function skipTask(
  scope: RequestScope,
  input: SkipTaskInput,
): Operation<Thread> {
  return changeTasks(scope, input, (thread) => {
    const task = thread.tasks?.find((task) => task._id === input.taskId);
    if (task === undefined || task.date !== input.expectedOccurrence)
      return null;
    return decideSkipTask(thread, input.taskId, {
      timeZone: input.timeZone,
      now: scope.clock.now(),
    });
  });
}

export function removeThread(
  scope: RequestScope,
  input: {
    threadId: ThreadId;
  },
): Operation<CommandAcknowledgement> {
  return Result.gen(async function* () {
    const removed = yield* Result.await(
      database(() => threadStorage(scope).remove(input.threadId)),
    );
    return removed
      ? Result.ok(commandAcknowledged)
      : Result.err(threadNotFound());
  });
}

/** Apply a Task command to the current Thread, rechecking its rule on every retry. */
function changeTasks(
  scope: RequestScope,
  command: { threadId: ThreadId },
  decide: (thread: Thread) => ThreadUpdateDecision | null,
  note?: CompleteTaskInput["note"],
): Operation<Thread> {
  return changeThread(scope, command.threadId, (thread) =>
    Result.gen(async function* () {
      const decision = yield* attempt(() => decide(thread));
      if (decision === null) return Result.err(moveConflict());
      const completionNote =
        note === undefined
          ? undefined
          : yield* attempt(() => {
              requireTaskId(note.id);
              return {
                id: note.id,
                body: requireNonBlankText(note.body, "Thread note body"),
              };
            });
      return Result.ok({ ...decision, completionNote });
    }),
  );
}

/**
 * Read the Thread, let a rule decide the change, and write it atomically.
 *
 * The write is conditional on the revision the decision was made against, so a
 * Thread that changed underneath is decided again from its new state rather
 * than overwritten with a stale conclusion.
 */
function changeThread(
  scope: RequestScope,
  threadId: ThreadId,
  decide: (
    thread: Thread,
  ) => Operation<ThreadChange & { completionNote?: CompleteTaskInput["note"] }>,
): Operation<Thread> {
  return Result.gen(async function* () {
    const threads = threadStorage(scope);

    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const current = yield* Result.await(
        database(() => threads.findForChange(threadId)),
      );
      if (current === null) return Result.err(threadNotFound());
      const { thread, revision } = current;

      const change = yield* Result.await(decide(thread));
      if (Object.keys(change.patch).length === 0 && change.logs.length === 0) {
        return Result.ok(thread);
      }

      const saved = await database(
        () =>
          threads.writeChange({
            threadId,
            expectedRevision: revision,
            change,
            completionNote: change.completionNote,
          }),
        isThreadSlugTaken,
      );
      if (Result.isError(saved)) {
        if (saved.error._tag === "SlugTaken") continue;
        return Result.err(saved.error);
      }
      const written = saved.value;
      if (written !== null) return Result.ok(written);
    }
    return Result.err(new ChangeConflict());
  });
}
