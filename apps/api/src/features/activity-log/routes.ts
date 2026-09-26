import type { ThreadId } from "@vita-os/contracts";

import type { Routes } from "../../platform/http/context";

import { reply, scope } from "../../platform/http/context";
import { decodeLimit } from "../../platform/http/decode";
import { refuse } from "../../platform/http/errors";
import { invalidActivityPagination } from "./errors";
import { getThreadActivityPage } from "./operations";

const ACTIVITY_PAGE_SIZE = { fallback: 20, maximum: 50 };

/** A Thread's Activity Log, a page at a time. */
export const activityLogRoutes: Routes = (app) => {
  app.get("/v1/threads/:threadId/activity", async (context) => {
    const limit =
      decodeLimit(context.req.query("limit"), ACTIVITY_PAGE_SIZE) ??
      refuse(invalidActivityPagination);
    const cursor = context.req.query("cursor");
    return reply(
      context,
      await getThreadActivityPage(scope(context), {
        threadId: context.req.param("threadId") as ThreadId,
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      }),
    );
  });
};
