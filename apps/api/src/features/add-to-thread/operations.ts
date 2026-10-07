import type {
  AddNoteToThreadInput,
  CreateThreadFromNoteInput,
  NoteAddedToThread,
  TaskId,
} from "@vita-os/contracts";

import {
  decideAddNoteToThread,
  generateSlug,
  requireNonBlankText,
  requireTaskId,
} from "@vita-os/core";
import { Result } from "better-result";

import type { Operation } from "../../platform/operation";
import type { RequestScope } from "../../platform/request-scope";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { noteNotFound } from "../notes/errors";
import { noteStorage } from "../notes/storage";
import { threadNotFound } from "../threads/errors";
import { isThreadSlugTaken, threadStorage } from "../threads/storage";
import { addToThreadStorage } from "./storage";

/** The caller's Task ID, checked like every other; the service mints one when absent. */
function taskIdFor(
  requested: TaskId | undefined,
  scope: { clock: { newId(): string } },
): TaskId {
  return requested === undefined
    ? (scope.clock.newId() as TaskId)
    : requireTaskId(requested);
}

/** The same limit as other revision-conditional Thread changes. */
const CHANGE_ATTEMPTS = 3;

/**
 * Turn an Open Standalone Note into a Thread Note on an Open Thread.
 *
 * The decision reads both records — a dated Note adds a dated Task — so the
 * write is conditional on the Note still carrying the date it read and on the
 * Thread's revision. A lost race re-reads and decides again.
 */
export function addNoteToThread(
  scope: RequestScope,
  input: AddNoteToThreadInput,
): Operation<NoteAddedToThread> {
  return Result.gen(async function* () {
    const notes = noteStorage(scope);
    const threads = threadStorage(scope);
    const storage = addToThreadStorage(scope);
    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const [noteResult, currentResult] = await Promise.all([
        database(() => notes.find(input.noteId)),
        database(() => threads.findForChange(input.threadId)),
      ]);
      const note = yield* noteResult;
      const current = yield* currentResult;
      if (note === null || note.state !== "open")
        return Result.err(noteNotFound());
      if (current === null || current.thread.state !== "open")
        return Result.err(threadNotFound());
      const { thread, revision } = current;
      const change = yield* attempt(() =>
        decideAddNoteToThread(thread, note, taskIdFor(input.taskId, scope)),
      );
      const added = yield* Result.await(
        database(() =>
          storage.addToThread({
            note,
            threadId: thread._id,
            expectedRevision: revision,
            change,
          }),
        ),
      );
      if (added !== null) return Result.ok(added);
    }
    return Result.err(new ChangeConflict());
  });
}

/**
 * Start a Thread whose first Thread Note is the Note. The Thread takes the
 * Note's dated Task, when it has a date. A taken slug is minted again, as creating a Thread
 * does; a Note that changed under the decision is read again.
 */
export function createThreadFromNote(
  scope: RequestScope,
  input: CreateThreadFromNoteInput,
): Operation<NoteAddedToThread> {
  return Result.gen(async function* () {
    const notes = noteStorage(scope);
    const storage = addToThreadStorage(scope);
    const title = yield* attempt(() =>
      requireNonBlankText(input.title, "Thread title"),
    );
    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const note = yield* Result.await(
        database(() => notes.find(input.noteId)),
      );
      if (note === null || note.state !== "open")
        return Result.err(noteNotFound());
      const slug = generateSlug(title);
      const change = yield* attempt(() =>
        decideAddNoteToThread(
          { title, slug, state: "open" },
          note,
          taskIdFor(input.taskId, scope),
        ),
      );
      const started = await database(
        () =>
          storage.startThread({
            note,
            thread: {
              title,
              slug,
              ...(input.areaId === undefined ? {} : { areaId: input.areaId }),
            },
            change,
          }),
        isThreadSlugTaken,
      );
      if (Result.isError(started)) {
        if (started.error._tag === "SlugTaken") continue;
        return Result.err(started.error);
      }
      const added = started.value;
      if (added !== null) return Result.ok(added);
      // Nothing was written: the Area is gone, or the Note changed and is
      // read again.
      if (input.areaId !== undefined) {
        const area = yield* Result.await(
          database(() => areaStorage(scope).find(input.areaId!)),
        );
        if (area === null) return Result.err(areaNotFound());
      }
    }
    return Result.err(new ChangeConflict());
  });
}
