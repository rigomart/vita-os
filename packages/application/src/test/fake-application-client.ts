import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import {
  ConflictError,
  ValidationError,
  decideCompleteTask,
  requireNonBlankText,
  requireTimeZone,
} from "@vita-os/core";

/** Optional stored records for tests of completion and subsequent Note reads. */
export interface FakeCompletionState {
  threads: Thread[];
  threadNotes: Map<ThreadId, ThreadNote[]>;
}

/**
 * A client that does nothing until a test says what it does.
 *
 * Every operation starts refusing, so a test that forgets to configure one gets a
 * loud failure instead of an accidental empty screen. React behavior is developed
 * against this seam rather than against a transport.
 */
const unconfiguredError: ApplicationError = {
  code: "unexpected",
  message: "Fake ApplicationClient operation was not configured.",
  retryable: false,
};

export function createFakeApplicationClient(
  overrides: Partial<ApplicationClient> = {},
  state?: FakeCompletionState,
): ApplicationClient {
  const unconfigured = async () =>
    ({ ok: false, error: unconfiguredError }) as const;

  return {
    listAreas: unconfigured,
    reorderAreas: unconfigured,
    createArea: unconfigured,
    updateArea: unconfigured,
    removeArea: unconfigured,

    listOpenThreads: unconfigured,
    listResolvedThreads: unconfigured,
    getThreadDetail: unconfigured,
    createThread: unconfigured,
    updateThread: unconfigured,
    removeThread: unconfigured,
    addTask: unconfigured,
    editTask: unconfigured,
    removeTask: unconfigured,
    completeTask: unconfigured,
    focusTask: unconfigured,
    setTaskDate: unconfigured,
    setTaskRepeat: unconfigured,
    skipTask: unconfigured,

    getThreadActivityPage: unconfigured,

    listOpenNotes: unconfigured,
    getDoneNotePage: unconfigured,
    countOpenNotes: unconfigured,
    createNote: unconfigured,
    updateNoteBody: unconfigured,
    updateNoteFollowUp: unconfigured,
    markNoteDone: unconfigured,
    markNoteOpen: unconfigured,
    removeNote: unconfigured,
    addNoteToThread: unconfigured,
    createThreadFromNote: unconfigured,

    listOpenThreadNotes: unconfigured,
    getDoneThreadNotePage: unconfigured,
    createThreadNote: unconfigured,
    updateThreadNoteBody: unconfigured,
    markThreadNoteDone: unconfigured,
    markThreadNoteOpen: unconfigured,
    removeThreadNote: unconfigured,

    ...(state === undefined ? {} : completionClient(state)),
    ...overrides,
  };
}

function completionClient(
  state: FakeCompletionState,
): Pick<ApplicationClient, "completeTask" | "listOpenThreadNotes"> {
  return {
    async completeTask(input) {
      const index = state.threads.findIndex(
        (thread) => thread._id === input.threadId,
      );
      const thread = state.threads[index];
      if (thread === undefined) return notFound();
      if (thread.revision !== input.expectedRevision) return taskConflict();
      try {
        if (input.timeZone !== undefined) requireTimeZone(input.timeZone);
        const now = Date.now();
        const decision = decideCompleteTask(thread, input.taskId, {
          timeZone: input.timeZone,
          now,
        });
        if (decision === null) return taskConflict();
        const body =
          input.note === undefined
            ? undefined
            : requireNonBlankText(input.note.body, "Thread note body");
        const note: ThreadNote | undefined =
          body === undefined
            ? undefined
            : {
                _id: crypto.randomUUID() as ThreadNoteId,
                body,
                state: "open",
                createdAt: now,
                updatedAt: now,
              };
        const written = {
          ...thread,
          ...decision.patch,
          revision: thread.revision + 1,
          lastActivityAt: now,
          lastActivityContent:
            note === undefined ? decision.logs.at(-1)?.content : undefined,
        };
        // All validation and ID creation finishes before either collection changes.
        state.threads[index] = written;
        if (note !== undefined)
          state.threadNotes.set(input.threadId, [
            note,
            ...(state.threadNotes.get(input.threadId) ?? []),
          ]);
        return success(written);
      } catch (error) {
        if (error instanceof ValidationError || error instanceof ConflictError)
          return failure({
            code: error instanceof ValidationError ? "validation" : "conflict",
            message: error.message,
            retryable: false,
          });
        throw error;
      }
    },
    async listOpenThreadNotes({ threadId }) {
      if (!state.threads.some((thread) => thread._id === threadId))
        return notFound();
      return success(
        (state.threadNotes.get(threadId) ?? []).filter(
          (note) => note.state === "open",
        ),
      );
    },
  };
}

function taskConflict<T>(): OperationResult<T> {
  return failure({
    code: "conflict",
    message: "The Task or Thread changed.",
    retryable: false,
  });
}

/** A promise a test resolves when it wants the operation to answer. */
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function success<T>(value: T): OperationResult<T> {
  return { ok: true, value };
}

export function failure<T>(error: ApplicationError): OperationResult<T> {
  return { ok: false, error };
}

/**
 * A client that answers every read with nothing and refuses every command.
 *
 * It is what a screen gets when a test does not speak for the application at
 * all. Reads answer empty rather than failing, because a failing read now rises
 * to an error boundary: a test about one surface should not be torn down by an
 * incidental read somewhere else on the screen. A command still refuses, because
 * a write nobody configured is a test that has not said what it expects.
 */
export function createQuietApplicationClient(
  overrides: Partial<ApplicationClient> = {},
): ApplicationClient {
  const emptyPage = async () => success({ entries: [] });

  return createFakeApplicationClient({
    listAreas: async () => success([]),
    listOpenThreads: async () => success([]),
    listResolvedThreads: async () => success([]),
    getThreadDetail: async () => notFound(),
    getThreadActivityPage: emptyPage,
    listOpenNotes: async () => success([]),
    getDoneNotePage: emptyPage,
    countOpenNotes: async () => success(0),
    listOpenThreadNotes: async () => success([]),
    getDoneThreadNotePage: emptyPage,
    ...overrides,
  });
}

function notFound<T>(): OperationResult<T> {
  return {
    ok: false,
    error: { code: "not_found", message: "Not found.", retryable: false },
  };
}
