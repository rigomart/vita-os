import type { ApplicationClient, OperationResult } from "@vita-os/contracts";
import type {
  Clock,
  Database,
  ExportFile,
  Operation,
  RequestScope,
} from "@vita-os/operations";

import * as operations from "@vita-os/operations";

/** Stored on every desktop row; changing it means migrating data. */
export const LOCAL_OWNER_ID = "local-owner";

export interface LocalApplicationClientOptions {
  db: Database;
  clock?: Clock;
  /** Hears the cause behind an `unexpected` failure. */
  onUnexpected?: (cause: unknown) => void;
}

/** The API's operations in-process, answering as the HTTP client does. */
export function createLocalApplicationClient({
  db,
  clock = operations.systemClock,
  onUnexpected = (cause) => console.error("Vita OS operation failed", cause),
}: LocalApplicationClientOptions): ApplicationClient {
  const scope: RequestScope = { db, clock, actorId: LOCAL_OWNER_ID };

  async function run<A>(
    operation: () => Operation<A>,
  ): Promise<OperationResult<A>> {
    try {
      const result = await operation();
      if (result.status === "ok") return { ok: true, value: result.value };
      if (result.error._tag === "Unexpected") onUnexpected(result.error.cause);
      return { ok: false, error: operations.toApplicationError(result.error) };
    } catch (cause) {
      onUnexpected(cause);
      return { ok: false, error: operations.unexpectedFailure };
    }
  }

  const read =
    <A>(operation: (scope: RequestScope) => Operation<A>) =>
    () =>
      run(() => operation(scope));

  const command =
    <I extends object, A>(
      operation: (scope: RequestScope, input: I) => Operation<A>,
    ) =>
    (input: I) =>
      run(() => operation(scope, withoutUndefined(input)));

  return {
    listAreas: read(operations.listAreas),
    createArea: command(operations.createArea),
    updateArea: command(operations.updateArea),
    reorderAreas: command(operations.reorderAreas),
    removeArea: command(operations.removeArea),

    listOpenThreads: read(operations.listOpenThreads),
    listResolvedThreads: read(operations.listResolvedThreads),
    getThreadDetail: command(operations.getThreadDetail),
    createThread: command(operations.createThread),
    updateThread: command(operations.updateThread),
    removeThread: command(operations.removeThread),

    addTask: command(operations.addTask),
    editTask: command(operations.editTask),
    removeTask: command(operations.removeTask),
    completeTask: command(operations.completeTask),
    setTaskDate: command(operations.setTaskDate),
    setTaskRepeat: command(operations.setTaskRepeat),
    skipTask: command(operations.skipTask),

    getThreadActivityPage: command(operations.getThreadActivityPage),

    listOpenNotes: read(operations.listOpenNotes),
    // The HTTP client sends no search for a blank one.
    getDoneNotePage: ({ query, ...page }) =>
      command(operations.getDoneNotePage)({
        ...page,
        ...(query?.trim() ? { query } : {}),
      }),
    countOpenNotes: read(operations.countOpenNotes),
    createNote: command(operations.createNote),
    updateNoteBody: command(operations.updateNoteBody),
    updateNoteFollowUp: command(operations.updateNoteFollowUp),
    setNoteRepeat: command(operations.setNoteRepeat),
    completeNote: command(operations.completeNote),
    markNoteDone: command(operations.markNoteDone),
    markNoteOpen: command(operations.markNoteOpen),
    removeNote: command(operations.removeNote),
    addNoteToThread: command(operations.addNoteToThread),
    createThreadFromNote: command(operations.createThreadFromNote),

    listOpenThreadNotes: command(operations.listOpenThreadNotes),
    getDoneThreadNotePage: command(operations.getDoneThreadNotePage),
    createThreadNote: command(operations.createThreadNote),
    updateThreadNoteBody: command(operations.updateThreadNoteBody),
    markThreadNoteDone: command(operations.markThreadNoteDone),
    markThreadNoteOpen: command(operations.markThreadNoteOpen),
    removeThreadNote: command(operations.removeThreadNote),
  };
}

/** Everything on this computer, as the web's Download my data saves it. */
export async function exportLocalData({
  db,
  clock = operations.systemClock,
}: Pick<LocalApplicationClientOptions, "db" | "clock">): Promise<ExportFile> {
  const result = await operations.exportData({
    db,
    clock,
    actorId: LOCAL_OWNER_ID,
  });
  if (result.status !== "ok") {
    throw new Error("Vita OS couldn't read its data to export it.", {
      cause: result.error,
    });
  }
  return result.value;
}

/** As JSON does: operations read an `undefined` field as "clear it". */
function withoutUndefined<I extends object>(input: I): I {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as I;
}
