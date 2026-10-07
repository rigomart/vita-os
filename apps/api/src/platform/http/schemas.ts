import type { ApplicationError, PageRequest } from "@vita-os/contracts";

import { Context, Effect, Schema, SchemaGetter } from "effect";

import { invalidPagination } from "../d1/page-cursor";
import { decodeLimit, type PageSize } from "./decode";
import { RequestRefusal } from "./errors";

export const Id = Schema.String.check(Schema.isMinLength(1));
export const Timestamp = Schema.Number.check(Schema.isInt());
export const CommandAck = Schema.Struct({ acknowledged: Schema.Literal(true) });
// Repeated query keys retain the first value, matching the previous router.
export const QueryValue = Schema.String.pipe(
  Schema.encodeTo(
    Schema.Union([
      Schema.String,
      Schema.Array(Schema.String).check(Schema.isMinLength(1)),
    ]),
    {
      decode: SchemaGetter.transform((value) =>
        typeof value === "string" ? value : value[0],
      ),
      encode: SchemaGetter.transform((value) => value),
    },
  ),
);
export const PageQuery = Schema.Struct({
  limit: Schema.optionalKey(QueryValue),
  cursor: Schema.optionalKey(QueryValue),
});

/** The public validation message for an endpoint's unreadable input. */
export class ValidationMessage extends Context.Service<
  ValidationMessage,
  string
>()("vita/ValidationMessage") {}

export function pageRequest(
  query: { readonly limit?: string; readonly cursor?: string },
  size: PageSize,
  invalid: ApplicationError = invalidPagination,
): Effect.Effect<PageRequest, RequestRefusal> {
  const limit = decodeLimit(query.limit, size);
  if (limit === undefined) return Effect.fail(new RequestRefusal(invalid));
  return Effect.succeed({
    limit,
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  });
}
