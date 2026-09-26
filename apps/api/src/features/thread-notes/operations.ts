import type {
  CommandAcknowledgement,
  OperationResult,
  PageRequest,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
  ThreadNotePage,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { requireNonBlankText } from "@vita-os/core";

import type { RequestScope } from "../../platform/request-scope";

import { failed, succeeded } from "../../platform/operation";
import { threadNotFound } from "../threads/errors";
import { threadStorage } from "../threads/storage";
import { threadNoteNotFound } from "./errors";
import { threadNoteStorage } from "./storage";

/**
 * Reads are addressed through the Thread that owns them, which must be the
 * caller's; a single Note is addressed by itself, because that is what the
 * person is editing.
 */

function found(note: ThreadNote | null): OperationResult<ThreadNote> {
  return note === null ? failed(threadNoteNotFound) : succeeded(note);
}

export async function listOpenThreadNotes(
  scope: RequestScope,
  input: { threadId: ThreadId },
): Promise<OperationResult<ThreadNote[]>> {
  if (!(await threadStorage(scope).exists(input.threadId))) {
    return failed(threadNotFound);
  }

  return succeeded(await threadNoteStorage(scope).listOpen(input.threadId));
}

export async function getDoneThreadNotePage(
  scope: RequestScope,
  { threadId, ...page }: { threadId: ThreadId } & PageRequest,
): Promise<OperationResult<ThreadNotePage>> {
  if (!(await threadStorage(scope).exists(threadId))) {
    return failed(threadNotFound);
  }

  return succeeded(await threadNoteStorage(scope).readDonePage(threadId, page));
}

export async function createThreadNote(
  scope: RequestScope,
  input: { threadId: ThreadId; body: string },
): Promise<OperationResult<ThreadNote>> {
  const body = requireNonBlankText(input.body, "Thread note body");
  const note = await threadNoteStorage(scope).insert(input.threadId, body);
  return note === null ? failed(threadNotFound) : succeeded(note);
}

export async function updateThreadNoteBody(
  scope: RequestScope,
  input: { threadNoteId: ThreadNoteId; body: string },
): Promise<OperationResult<ThreadNote>> {
  const body = requireNonBlankText(input.body, "Thread note body");
  return found(
    await threadNoteStorage(scope).setBody(input.threadNoteId, body),
  );
}

export async function markThreadNoteDone(
  scope: RequestScope,
  input: { threadNoteId: ThreadNoteId },
): Promise<OperationResult<ThreadNote>> {
  return found(await threadNoteStorage(scope).markDone(input.threadNoteId));
}

export async function markThreadNoteOpen(
  scope: RequestScope,
  input: { threadNoteId: ThreadNoteId },
): Promise<OperationResult<ThreadNote>> {
  return found(await threadNoteStorage(scope).markOpen(input.threadNoteId));
}

export async function removeThreadNote(
  scope: RequestScope,
  input: { threadNoteId: ThreadNoteId },
): Promise<OperationResult<CommandAcknowledgement>> {
  return (await threadNoteStorage(scope).remove(input.threadNoteId))
    ? succeeded(commandAcknowledged)
    : failed(threadNoteNotFound);
}
