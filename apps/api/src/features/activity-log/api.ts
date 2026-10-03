import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Authentication } from "../../platform/auth/authenticated-scope";
import {
  PageQuery,
  Timestamp,
  ValidationMessage,
} from "../../platform/http/schemas";
import { ThreadIdSchema } from "../threads/requests";
import { invalidActivityPagination } from "./errors";

const ActivityLogEntrySchema = Schema.Struct({
  _id: Schema.String.pipe(
    Schema.refine((value): value is ActivityLogEntryId => value.length > 0),
  ),
  type: Schema.Literals([
    "area_move",
    "next_move_change",
    "move_completed",
    "state_change",
    "follow_up_change",
  ]),
  content: Schema.String,
  previousValue: Schema.optionalKey(Schema.String),
  newValue: Schema.optionalKey(Schema.String),
  createdAt: Timestamp,
});
const ActivityLogPageSchema = Schema.Struct({
  entries: Schema.Array(ActivityLogEntrySchema),
  nextCursor: Schema.optionalKey(Schema.String),
});
export const ActivityLogApi = HttpApiGroup.make("activityLog")
  .add(
    HttpApiEndpoint.get("page", "/v1/threads/:threadId/activity", {
      params: { threadId: ThreadIdSchema },
      query: PageQuery,
      success: ActivityLogPageSchema,
    }).annotate(ValidationMessage, invalidActivityPagination.message),
  )
  .middleware(Authentication);
import type { ActivityLogEntryId } from "@vita-os/contracts";
