import { NotFound } from "../../platform/failures";

export const threadNoteNotFound = () =>
  new NotFound({ message: "Thread note not found." });
