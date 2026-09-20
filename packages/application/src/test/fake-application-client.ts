import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

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
): ApplicationClient {
  const unconfigured = async () =>
    ({ ok: false, error: unconfiguredError }) as const;

  return {
    listAreas: unconfigured,
    getAreaDetail: unconfigured,
    createArea: unconfigured,
    updateArea: unconfigured,
    removeArea: unconfigured,

    listOpenThreads: unconfigured,
    getThreadDetail: unconfigured,
    createThread: unconfigured,
    updateThread: unconfigured,
    removeThread: unconfigured,
    replaceUpNext: unconfigured,
    completeNextMove: unconfigured,

    getThreadActivityPage: unconfigured,

    listOpenNotes: unconfigured,
    getDoneNotePage: unconfigured,
    countOpenNotes: unconfigured,
    createNote: unconfigured,
    updateNoteBody: unconfigured,
    updateNoteAttentionDate: unconfigured,
    markNoteDone: unconfigured,
    markNoteOpen: unconfigured,
    removeNote: unconfigured,

    listOpenThreadNotes: unconfigured,
    getDoneThreadNotePage: unconfigured,
    createThreadNote: unconfigured,
    updateThreadNoteBody: unconfigured,
    markThreadNoteDone: unconfigured,
    markThreadNoteOpen: unconfigured,
    removeThreadNote: unconfigured,

    ...overrides,
  };
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
    getAreaDetail: async () => notFound(),
    listOpenThreads: async () => success([]),
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
