import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

import { Authentication } from "../../platform/auth/authenticated-scope";
import {
  CommandAck,
  Timestamp,
  ValidationMessage,
} from "../../platform/http/schemas";
import {
  AreaIconSchema,
  AreaIdSchema,
  AreaOrderBody,
  CreateAreaBody,
  UpdateAreaBody,
} from "./requests";

export const AreaSummarySchema = Schema.Struct({
  _id: AreaIdSchema,
  name: Schema.String,
  slug: Schema.String,
  icon: AreaIconSchema,
  order: Timestamp,
  createdAt: Timestamp,
});
const AreaParams = { areaId: AreaIdSchema };

export const AreasApi = HttpApiGroup.make("areas")
  .add(
    HttpApiEndpoint.get("list", "/v1/areas", {
      success: Schema.Array(AreaSummarySchema),
    }),
    HttpApiEndpoint.post("create", "/v1/areas", {
      payload: CreateAreaBody,
      success: AreaSummarySchema.pipe(HttpApiSchema.status(201)),
    }).annotate(ValidationMessage, "Invalid Area."),
    HttpApiEndpoint.put("order", "/v1/areas/order", {
      payload: AreaOrderBody,
      success: Schema.Array(AreaSummarySchema),
    }).annotate(ValidationMessage, "Invalid Area order."),
    HttpApiEndpoint.patch("update", "/v1/areas/:areaId", {
      params: AreaParams,
      payload: UpdateAreaBody,
      success: AreaSummarySchema,
    }).annotate(ValidationMessage, "Invalid Area change."),
    HttpApiEndpoint.delete("remove", "/v1/areas/:areaId", {
      params: AreaParams,
      success: CommandAck,
    }),
  )
  .middleware(Authentication)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" });
