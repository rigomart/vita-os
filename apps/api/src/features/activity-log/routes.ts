import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
import { pageRequest } from "../../platform/http/schemas";
import { invalidActivityPagination } from "./errors";
import { getThreadActivityPage } from "./operations";

const ACTIVITY_PAGE_SIZE = { fallback: 20, maximum: 50 };
export const ActivityLogHandlers = HttpApiBuilder.group(
  ApplicationApi,
  "activityLog",
  (handlers) =>
    handlers.handle("page", ({ params, query }) =>
      Effect.gen(function* () {
        const page = yield* pageRequest(
          query,
          ACTIVITY_PAGE_SIZE,
          invalidActivityPagination,
        );
        return yield* getThreadActivityPage({
          threadId: params.threadId,
          ...page,
        });
      }),
    ),
);
