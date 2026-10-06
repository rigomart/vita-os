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
} from "@vita-os/core";
import { Effect } from "effect";

import type { Operation } from "../../platform/operation";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { areaNotFound } from "../areas/errors";
import { areaStorage } from "../areas/storage";
import { noteNotFound } from "../notes/errors";
import { noteStorage } from "../notes/storage";
import { threadNotFound } from "../threads/errors";
import { isThreadSlugTaken, threadStorage } from "../threads/storage";
import { addToThreadStorage } from "./storage";

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
  input: AddNoteToThreadInput,
): Operation<NoteAddedToThread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const notes = noteStorage(scope);
    const threads = threadStorage(scope);
    const storage = addToThreadStorage(scope);
    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const [note, thread] = yield* Effect.all(
        [
          database(() => notes.find(input.noteId)),
          database(() => threads.find(input.threadId)),
        ],
        { concurrency: "unbounded" },
      );
      if (note === null || note.state !== "open") return yield* noteNotFound();
      if (thread === null || thread.state !== "open")
        return yield* threadNotFound();
      const change = decideAddNoteToThread(
        thread,
        note,
        scope.clock.newId() as TaskId,
      );
      const added = yield* database(() =>
        storage.addToThread({
          note,
          threadId: thread._id,
          expectedRevision: thread.revision,
          change,
        }),
      );
      if (added !== null) return added;
    }
    return yield* new ChangeConflict();
  });
}

/**
 * Start a Thread whose first Thread Note is the Note. The Thread takes the
 * Note's dated Task, when it has a date. A taken slug is minted again, as creating a Thread
 * does; a Note that changed under the decision is read again.
 */
export function createThreadFromNote(
  input: CreateThreadFromNoteInput,
): Operation<NoteAddedToThread> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const notes = noteStorage(scope);
    const storage = addToThreadStorage(scope);
    const title = yield* attempt(() =>
      requireNonBlankText(input.title, "Thread title"),
    );
    for (let execution = 0; execution < CHANGE_ATTEMPTS; execution += 1) {
      const note = yield* database(() => notes.find(input.noteId));
      if (note === null || note.state !== "open") return yield* noteNotFound();
      const slug = generateSlug(title);
      const change = decideAddNoteToThread(
        { title, slug, state: "open" },
        note,
        scope.clock.newId() as TaskId,
      );
      const added = yield* database(
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
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(undefined)));
      if (added === undefined) continue;
      if (added !== null) return added;
      // Nothing was written: the Area is gone, or the Note changed and is
      // read again.
      if (input.areaId !== undefined) {
        const area = yield* database(() =>
          areaStorage(scope).find(input.areaId!),
        );
        if (area === null) return yield* areaNotFound();
      }
    }
    return yield* new ChangeConflict();
  });
}
