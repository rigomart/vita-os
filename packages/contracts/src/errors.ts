import * as v from "valibot";

import { ApplicationErrorSchema, CommandAckSchema } from "./schemas";

/** A missing record and a record owned by someone else both yield not_found. */
export type ApplicationError = v.InferOutput<typeof ApplicationErrorSchema>;

export type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApplicationError };

/** What a command that stores nothing back to the caller reports. */
export type CommandAcknowledgement = v.InferOutput<typeof CommandAckSchema>;

export const commandAcknowledged: CommandAcknowledgement = {
  acknowledged: true,
};

export function isApplicationError(value: unknown): value is ApplicationError {
  return v.is(ApplicationErrorSchema, value);
}
