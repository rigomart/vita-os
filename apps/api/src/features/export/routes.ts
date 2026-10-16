import { exportData } from "@vita-os/operations";
import { Hono } from "hono";

import type { ApiEnv } from "../../platform/env";

import { respond } from "../../platform/http/errors";

/** Download my data: every record the owner has, as stored. */
export const exportRoutes = new Hono<ApiEnv>().get("/export", async (c) =>
  respond(await exportData(c.get("scope"))),
);
