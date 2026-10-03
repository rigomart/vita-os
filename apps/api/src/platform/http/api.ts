import { Context, Effect, Layer, type Types } from "effect";
import { HttpServerError } from "effect/http";
import { HttpApi, HttpApiError, HttpApiMiddleware } from "effect/http-api";

import { ActivityLogApi } from "../../features/activity-log/api";
import { AreasApi } from "../../features/areas/api";
import { NotesApi } from "../../features/notes/api";
import { ThreadNotesApi } from "../../features/thread-notes/api";
import { ThreadsApi } from "../../features/threads/api";
import {
  invalidRequest,
  RequestRefusal,
  RequestRefusalSchemas,
  unexpectedFailure,
} from "./errors";
import { ValidationMessage } from "./schemas";

export class SchemaErrors extends HttpApiMiddleware.Service<SchemaErrors>()(
  "vita/SchemaErrors",
  { error: RequestRefusalSchemas },
) {}

export const schemaErrorLayer = Layer.succeed(
  SchemaErrors,
  (httpEffect, { endpoint }) => {
    const invalidInput = () =>
      new RequestRefusal(
        invalidRequest(
          Context.getOrUndefined(endpoint.annotations, ValidationMessage) ??
            "Invalid request.",
        ),
      );
    return httpEffect.pipe(
      Effect.catch(
        (error): Effect.Effect<never, Types.unhandled | RequestRefusal> => {
          if (!HttpApiError.HttpApiSchemaError.is(error))
            return Effect.fail(error);
          return Effect.fail(
            error.kind === "Body" || error.kind === "ResponseHeaders"
              ? new RequestRefusal(unexpectedFailure)
              : invalidInput(),
          );
        },
      ),
      Effect.catchDefect((defect) =>
        defect instanceof HttpServerError.HttpServerError &&
        defect.reason instanceof HttpServerError.RequestParseError
          ? Effect.fail(invalidInput())
          : Effect.die(defect),
      ),
    );
  },
);

export const ApplicationApi = HttpApi.make("vita")
  .add(NotesApi)
  .add(AreasApi)
  .add(ThreadsApi)
  .add(ThreadNotesApi)
  .add(ActivityLogApi)
  .middleware(SchemaErrors)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
