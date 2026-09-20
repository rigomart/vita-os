import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

const unconfiguredError: ApplicationError = {
  code: "unexpected",
  message: "Fake ApplicationClient operation was not configured.",
  retryable: false,
};

export function createFakeApplicationClient(
  overrides: Partial<ApplicationClient> = {},
): ApplicationClient {
  return {
    getThreadDetail: async () => ({ ok: false, error: unconfiguredError }),
    getThreadActivityPage: async () => ({
      ok: false,
      error: unconfiguredError,
    }),
    completeNextMove: async () => ({ ok: false, error: unconfiguredError }),
    ...overrides,
  };
}

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
