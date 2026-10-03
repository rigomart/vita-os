import { HttpApiBuilder } from "effect/http-api";

import { ApplicationApi } from "../../platform/http/api";
import {
  createArea,
  listAreas,
  removeArea,
  reorderAreas,
  updateArea,
} from "./operations";
import { normalizeAreaChange } from "./requests";

export const AreasHandlers = HttpApiBuilder.group(
  ApplicationApi,
  "areas",
  (handlers) =>
    handlers
      .handle("list", () => listAreas())
      .handle("create", ({ payload }) => createArea(payload))
      .handle("order", ({ payload }) =>
        reorderAreas({ areaIds: [...payload.areaIds] }),
      )
      .handle("update", ({ params, payload }) =>
        updateArea({ ...params, ...normalizeAreaChange(payload) }),
      )
      .handle("remove", ({ params }) => removeArea(params)),
);
