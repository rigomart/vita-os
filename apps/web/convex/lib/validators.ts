import { v } from "convex/values";
import { CONDITIONS } from "./condition";

export const conditionValidator = v.union(
  v.literal(CONDITIONS[0]),
  v.literal(CONDITIONS[1]),
  v.literal(CONDITIONS[2]),
);

export const activityLogEntryTypeValidator = v.union(
  v.literal("note"),
  v.literal("status_change"),
  v.literal("next_action_change"),
  v.literal("state_change"),
  v.literal("decision"),
  v.literal("reference"),
  v.literal("waiting_change"),
  v.literal("follow_up_change"),
  v.literal("area_move"),
);
