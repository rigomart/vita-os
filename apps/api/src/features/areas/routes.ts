import {
  AreaIdSchema,
  AreaOrderBody,
  CreateAreaBody,
  UpdateAreaBody,
} from "@vita-os/contracts";
import { Hono } from "hono";
import * as v from "valibot";

import type { ApiEnv } from "../../platform/env";

import { validate } from "../../platform/http/decode";
import { respond } from "../../platform/http/errors";
import {
  createArea,
  listAreas,
  removeArea,
  reorderAreas,
  updateArea,
} from "./operations";
import { normalizeAreaChange } from "./requests";

const AreaParams = v.object({ areaId: AreaIdSchema });

/** Areas: the optional labels a Thread may carry. */
export const areasRoutes = new Hono<ApiEnv>()
  .get("/areas", async (c) => respond(await listAreas(c.get("scope"))))
  .post(
    "/areas",
    validate("json", CreateAreaBody, "Invalid Area."),
    async (c) =>
      respond(await createArea(c.get("scope"), c.req.valid("json")), 201),
  )
  .put(
    "/areas/order",
    validate("json", AreaOrderBody, "Invalid Area order."),
    async (c) =>
      respond(await reorderAreas(c.get("scope"), c.req.valid("json"))),
  )
  .patch(
    "/areas/:areaId",
    validate("param", AreaParams, "Invalid Area change."),
    validate("json", UpdateAreaBody, "Invalid Area change."),
    async (c) =>
      respond(
        await updateArea(c.get("scope"), {
          ...c.req.valid("param"),
          ...normalizeAreaChange(c.req.valid("json")),
        }),
      ),
  )
  .delete(
    "/areas/:areaId",
    validate("param", AreaParams, "Invalid request."),
    async (c) =>
      respond(await removeArea(c.get("scope"), c.req.valid("param"))),
  );
