import { NotFound } from "../../platform/failures";

export const noteNotFound = () => new NotFound({ message: "Note not found." });
