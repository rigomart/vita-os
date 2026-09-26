import type {
  CommandAcknowledgement,
  Note,
  NoteId,
  NotePage,
  OperationResult,
  PageRequest,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { requireNonBlankText } from "@vita-os/core";

import type { RequestScope } from "../../platform/request-scope";

import { failed, succeeded } from "../../platform/operation";
import { noteNotFound } from "./errors";
import { noteStorage } from "./storage";

function found(note: Note | null): OperationResult<Note> {
  return note === null ? failed(noteNotFound) : succeeded(note);
}

export async function listOpenNotes(
  scope: RequestScope,
): Promise<OperationResult<Note[]>> {
  return succeeded(await noteStorage(scope).listOpen());
}

export async function countOpenNotes(
  scope: RequestScope,
): Promise<OperationResult<number>> {
  return succeeded(await noteStorage(scope).countOpen());
}

export async function getDoneNotePage(
  scope: RequestScope,
  page: PageRequest,
): Promise<OperationResult<NotePage>> {
  return succeeded(await noteStorage(scope).readDonePage(page));
}

export async function createNote(
  scope: RequestScope,
  input: { body: string; attentionDate?: number },
): Promise<OperationResult<Note>> {
  const body = requireNonBlankText(input.body, "Note body");
  return found(await noteStorage(scope).insert({ ...input, body }));
}

export async function updateNoteBody(
  scope: RequestScope,
  input: { noteId: NoteId; body: string },
): Promise<OperationResult<Note>> {
  const body = requireNonBlankText(input.body, "Note body");
  return found(await noteStorage(scope).setBody(input.noteId, body));
}

export async function updateNoteAttentionDate(
  scope: RequestScope,
  input: { noteId: NoteId; attentionDate: number | null },
): Promise<OperationResult<Note>> {
  return found(
    await noteStorage(scope).setAttentionDate(
      input.noteId,
      input.attentionDate,
    ),
  );
}

export async function markNoteDone(
  scope: RequestScope,
  input: { noteId: NoteId },
): Promise<OperationResult<Note>> {
  return found(await noteStorage(scope).markDone(input.noteId));
}

export async function markNoteOpen(
  scope: RequestScope,
  input: { noteId: NoteId },
): Promise<OperationResult<Note>> {
  return found(await noteStorage(scope).markOpen(input.noteId));
}

export async function removeNote(
  scope: RequestScope,
  input: { noteId: NoteId },
): Promise<OperationResult<CommandAcknowledgement>> {
  return (await noteStorage(scope).remove(input.noteId))
    ? succeeded(commandAcknowledged)
    : failed(noteNotFound);
}
