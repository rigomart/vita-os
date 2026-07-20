import { v } from "convex/values";

import { AREA_ICONS } from "./areaIcons";
import { CONDITIONS } from "./condition";

export const areaIconValidator = v.union(
  v.literal(AREA_ICONS[0]),
  v.literal(AREA_ICONS[1]),
  v.literal(AREA_ICONS[2]),
  v.literal(AREA_ICONS[3]),
  v.literal(AREA_ICONS[4]),
  v.literal(AREA_ICONS[5]),
  v.literal(AREA_ICONS[6]),
  v.literal(AREA_ICONS[7]),
  v.literal(AREA_ICONS[8]),
  v.literal(AREA_ICONS[9]),
  v.literal(AREA_ICONS[10]),
  v.literal(AREA_ICONS[11]),
  v.literal(AREA_ICONS[12]),
  v.literal(AREA_ICONS[13]),
  v.literal(AREA_ICONS[14]),
);

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
