/** Thrown by a command whose Undo offer was taken before it reached the service. */
export class CommandUndone extends Error {
  constructor() {
    super("The command was undone.");
    this.name = "CommandUndone";
  }
}

/**
 * Hold a command until its Undo offer lapses. The command's optimistic change
 * is already on screen, so undoing rejects it and the cache rolls back.
 */
export async function afterUndoWindow(
  undoWindow: (() => Promise<boolean>) | undefined,
) {
  if (undoWindow && !(await undoWindow())) throw new CommandUndone();
}
