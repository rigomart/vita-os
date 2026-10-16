import type {
  ApplicationClient,
  ApplicationError,
  OperationResult,
} from "@vita-os/contracts";

import type { VitaBridge } from "../bridge.ts";

/** Every method, so the compiler names one the contract gains or drops. */
const methods: Record<keyof ApplicationClient, true> = {
  listAreas: true,
  createArea: true,
  updateArea: true,
  reorderAreas: true,
  removeArea: true,
  listOpenThreads: true,
  listResolvedThreads: true,
  getThreadDetail: true,
  createThread: true,
  updateThread: true,
  removeThread: true,
  addTask: true,
  editTask: true,
  removeTask: true,
  completeTask: true,
  setTaskDate: true,
  setTaskRepeat: true,
  skipTask: true,
  getThreadActivityPage: true,
  listOpenNotes: true,
  getDoneNotePage: true,
  countOpenNotes: true,
  createNote: true,
  updateNoteBody: true,
  updateNoteFollowUp: true,
  setNoteRepeat: true,
  completeNote: true,
  markNoteDone: true,
  markNoteOpen: true,
  removeNote: true,
  addNoteToThread: true,
  createThreadFromNote: true,
  listOpenThreadNotes: true,
  getDoneThreadNotePage: true,
  createThreadNote: true,
  updateThreadNoteBody: true,
  markThreadNoteDone: true,
  markThreadNoteOpen: true,
  removeThreadNote: true,
};

const unreachable: ApplicationError = {
  code: "unexpected",
  message: "Vita OS couldn't reach its data.",
  retryable: false,
};

/**
 * The local client in main, called through the preload's bridge. A call that
 * never got an answer (main refused it, or its input couldn't be sent) fails
 * as `unexpected`, as a broken response does over HTTP.
 */
export function createBridgeClient(
  bridge: Pick<VitaBridge, "call">,
  onFailure: (method: string, cause: unknown) => void = (method, cause) =>
    console.error(`Vita OS call ${method} failed`, cause),
): ApplicationClient {
  const call =
    (method: string) =>
    async (input?: unknown): Promise<OperationResult<unknown>> => {
      try {
        return (await bridge.call(method, input)) as OperationResult<unknown>;
      } catch (cause) {
        onFailure(method, cause);
        return { ok: false, error: unreachable };
      }
    };
  return Object.fromEntries(
    Object.keys(methods).map((method) => [method, call(method)]),
  ) as unknown as ApplicationClient;
}
