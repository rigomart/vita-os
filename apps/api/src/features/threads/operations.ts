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
import { Effect } from "effect";

import type { OperationFailure } from "../../platform/failures";
import type { Operation } from "../../platform/operation";
import type { ThreadChange } from "./storage";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { moveConflict, threadNotFound } from "./errors";
import { isThreadSlugTaken, threadStorage } from "./storage";

/** Re-read and recompute whole-JSON Task writes after losing a storage race. */
const CHANGE_ATTEMPTS = 3;

/** How many times a create re-mints a colliding slug. */
const SLUG_ATTEMPTS = 3;

export function listOpenThreads(): Operation<Thread[]> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => threadStorage(scope).listOpen());
  });
}

export function listResolvedThreads(): Operation<Thread[]> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => threadStorage(scope).listResolved());
  });
}

export function getThreadDetail(input: {
  slug: string;
}): Operation<ThreadDetail> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const detail = yield* database(() =>
      threadStorage(scope).findDetail(input.slug),
    );
    return detail === null ? yield* threadNotFound() : detail;
  });
}

/**
 * A Thread needs only a title. When it is labeled at creation, the Area must be
 * one the owner holds, so the failure names the Area when it is not theirs.
 */
export function createThread(input: CreateThreadInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);
    const title = yield* attempt(() =>
      requireNonBlankText(input.title, "Thread title"),
    );

    for (let execution = 0; execution < SLUG_ATTEMPTS; execution += 1) {
      const slug = generateSlug(title);
      const thread = yield* database(
        () => threads.insert({ ...input, title, slug }),
        isThreadSlugTaken,
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(undefined)));
      if (thread === undefined) continue;
      return thread === null ? yield* areaNotFound() : thread;
    }
    return yield* new ChangeConflict();
  });
}

/**
 * One Thread edit: title, Summary, Area, or lifecycle.
 * The Activity Log the change earns is written with it or not at all.
 */
export function updateThread({
  threadId,
  resolutionNote,
  ...requested
}: UpdateThreadInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);
    const title =
      requested.title === undefined
        ? undefined
        : yield* attempt(() =>
            requireNonBlankText(requested.title!, "Thread title"),
          );

    return yield* changeThread(threadId, (thread) =>
      Effect.gen(function* () {
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
            const destination = yield* database(() =>
              areas.find(patch.areaId!),
            );
            if (destination === null) return yield* areaNotFound();
            areaNames.to = destination.name;
          }
          if (thread.areaId !== undefined) {
            const origin = yield* database(() => areas.find(thread.areaId!));
            if (origin !== null) areaNames.from = origin.name;
          }
        }

        return decideThreadUpdate({
          thread,
          patch: { ...patch, ...rename },
          ...(resolutionNote === undefined ? {} : { resolutionNote }),
          areaNames,
        });
      }),
    );
  });
}

/** A new Task joins the end of the Thread's Tasks, unfocused. */
export function addTask(input: AddTaskInput): Operation<Thread> {
  return Effect.gen(function* () {
    const task = yield* attempt(() => ({
      _id: requireTaskId(input.taskId),
      text: requireTaskText(input.text),
      ...(input.date === undefined ? {} : { date: input.date }),
    }));
    return yield* changeTasks(input, (thread) => decideAddTask(thread, task));
  });
}

export function editTask(input: EditTaskInput): Operation<Thread> {
  return Effect.gen(function* () {
    const text = yield* attempt(() => requireTaskText(input.text));
    return yield* changeTasks(input, (thread) =>
      decideEditTask(thread, input.taskId, text),
    );
  });
}

export function removeTask(input: RemoveTaskInput): Operation<Thread> {
  return changeTasks(input, (thread) => decideRemoveTask(thread, input.taskId));
}

/**
 * Complete one Task, focused or not. Its Activity Log entry is written with the
 * change or not at all, and two competing completions of the same Task record
 * one: the loser finds the occurrence changed.
 */
export function completeTask(input: CompleteTaskInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* changeTasks(
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
  });
}

export function focusTask(input: FocusTaskInput): Operation<Thread> {
  return changeTasks(input, (thread) => decideFocusTask(thread, input.taskId));
}

/** Set, change or clear one Task's date. It writes no Activity Log entry. */
export function setTaskDate(input: SetTaskDateInput): Operation<Thread> {
  return changeTasks(input, (thread) =>
    decideSetTaskDate(thread, input.taskId, input.date, input.timeZone),
  );
}

export function setTaskRepeat(input: SetTaskRepeatInput): Operation<Thread> {
  return changeTasks(input, (thread) =>
    decideSetTaskRepeat(thread, input.taskId, input.repeat, input.timeZone),
  );
}

export function skipTask(input: SkipTaskInput): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* changeTasks(input, (thread) => {
      const task = thread.tasks?.find((task) => task._id === input.taskId);
      if (task === undefined || task.date !== input.expectedOccurrence)
        return null;
      return decideSkipTask(thread, input.taskId, {
        timeZone: input.timeZone,
        now: scope.clock.now(),
      });
    });
  });
}

export function removeThread(input: {
  threadId: ThreadId;
}): Operation<CommandAcknowledgement> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const removed = yield* database(() =>
      threadStorage(scope).remove(input.threadId),
    );
    return removed ? commandAcknowledged : yield* threadNotFound();
  });
}

/** Apply a Task command to the current Thread, rechecking its rule on every retry. */
function changeTasks(
  command: { threadId: ThreadId },
  decide: (thread: Thread) => ThreadUpdateDecision | null,
  note?: CompleteTaskInput["note"],
): Operation<Thread> {
  return changeThread(command.threadId, (thread) =>
    Effect.gen(function* () {
      const decision = yield* attempt(() => decide(thread));
      if (decision === null) return yield* moveConflict();
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
      return { ...decision, completionNote };
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
  threadId: ThreadId,
  decide: (
    thread: Thread,
  ) => Effect.Effect<
    ThreadChange & { completionNote?: CompleteTaskInput["note"] },
    OperationFailure
  >,
): Operation<Thread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const threads = threadStorage(scope);

    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const current = yield* database(() => threads.findForChange(threadId));
      if (current === null) return yield* threadNotFound();
      const { thread, revision } = current;

      const change = yield* decide(thread);
      if (Object.keys(change.patch).length === 0 && change.logs.length === 0) {
        return thread;
      }

      const written = yield* database(
        () =>
          threads.writeChange({
            threadId,
            expectedRevision: revision,
            change,
            completionNote: change.completionNote,
          }),
        isThreadSlugTaken,
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(null)));
      if (written !== null) return written;
    }
    return yield* new ChangeConflict();
  });
}
