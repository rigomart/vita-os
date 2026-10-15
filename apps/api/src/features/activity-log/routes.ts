import { PageQuery, ThreadIdSchema } from "@vita-os/contracts";
import {
  ACTIVITY_PAGE_SIZE,
  getThreadActivityPage,
  invalidActivityPagination,
} from "@vita-os/operations";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { validate } from "../../platform/http/decode";
import { refusalResponse, respond } from "../../platform/http/errors";
import { pageRequest } from "../../platform/http/schemas";

const ThreadParams = v.object({ threadId: ThreadIdSchema });

/** A Thread's Activity Log, a page at a time. */
export const activityLogRoutes = new Hono<ApiEnv>().get(
  "/threads/:threadId/activity",
  validate("param", ThreadParams, invalidActivityPagination.message),
  validate("query", PageQuery, invalidActivityPagination.message),
  async (c) => {
    const page = pageRequest(
      c.req.valid("query"),
      ACTIVITY_PAGE_SIZE,
      invalidActivityPagination,
    );
    if (page.status === "error") return refusalResponse(page.error);
    return respond(
      await getThreadActivityPage(c.get("scope"), {
        ...c.req.valid("param"),
        ...page.value,
      }),
    );
  },
);
