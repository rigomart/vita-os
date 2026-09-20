import type { AreaId } from "@vita-os/contracts";

import type { Routes } from "./shared";

import { areaNotFound, invalidRequest } from "../errors";
import { decodeCreateArea, decodeUpdateArea } from "../requests";
import { actorId, readJsonBody, refuse, respond, store } from "./shared";

/** Areas: the life inventory itself. */
export const areaRoutes: Routes = (app) => {
  app.get("/v1/areas", async (context) =>
    context.json(
      await store(context).areas.listAreas({ actorId: actorId(context) }),
    ),
  );

  app.get("/v1/areas/:slug", async (context) =>
    respond(
      context,
      await store(context).areas.getAreaDetail({
        actorId: actorId(context),
        slug: context.req.param("slug"),
      }),
      areaNotFound,
    ),
  );

  app.post("/v1/areas", async (context) => {
    const input = decodeCreateArea(await readJsonBody(context));
    if (input === undefined)
      return refuse(context, invalidRequest("Invalid Area."));

    return respond(
      context,
      await store(context).areas.createArea({
        actorId: actorId(context),
        ...input,
      }),
      areaNotFound,
      { createdStatus: true },
    );
  });

  app.patch("/v1/areas/:areaId", async (context) => {
    const input = decodeUpdateArea(await readJsonBody(context));
    if (input === undefined) {
      return refuse(context, invalidRequest("Invalid Area change."));
    }

    return respond(
      context,
      await store(context).areas.updateArea({
        actorId: actorId(context),
        areaId: context.req.param("areaId") as AreaId,
        ...input,
      }),
      areaNotFound,
    );
  });

  app.delete("/v1/areas/:areaId", async (context) =>
    respond(
      context,
      await store(context).areas.removeArea({
        actorId: actorId(context),
        areaId: context.req.param("areaId") as AreaId,
      }),
      areaNotFound,
    ),
  );
};
