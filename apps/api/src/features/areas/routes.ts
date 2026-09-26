import type { AreaId } from "@vita-os/contracts";

import type { Routes } from "../../platform/http/context";

import { readJsonBody, reply, scope } from "../../platform/http/context";
import { invalidRequest, refuse } from "../../platform/http/errors";
import {
  createArea,
  getAreaDetail,
  listAreas,
  removeArea,
  updateArea,
} from "./operations";
import { decodeCreateArea, decodeUpdateArea } from "./requests";

/** Areas: the life inventory itself. */
export const areaRoutes: Routes = (app) => {
  app.get("/v1/areas", async (context) =>
    reply(context, await listAreas(scope(context))),
  );

  app.get("/v1/areas/:slug", async (context) =>
    reply(
      context,
      await getAreaDetail(scope(context), { slug: context.req.param("slug") }),
    ),
  );

  app.post("/v1/areas", async (context) => {
    const input =
      decodeCreateArea(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Area."));
    return reply(context, await createArea(scope(context), input), 201);
  });

  app.patch("/v1/areas/:areaId", async (context) => {
    const input =
      decodeUpdateArea(await readJsonBody(context)) ??
      refuse(invalidRequest("Invalid Area change."));
    return reply(
      context,
      await updateArea(scope(context), {
        areaId: context.req.param("areaId") as AreaId,
        ...input,
      }),
    );
  });

  app.delete("/v1/areas/:areaId", async (context) =>
    reply(
      context,
      await removeArea(scope(context), {
        areaId: context.req.param("areaId") as AreaId,
      }),
    ),
  );
};
