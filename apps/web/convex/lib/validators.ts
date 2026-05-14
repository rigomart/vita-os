import { v } from "convex/values";
import { HEALTH_STATUSES } from "./healthStatus";

export const healthStatusValidator = v.union(
  v.literal(HEALTH_STATUSES[0]),
  v.literal(HEALTH_STATUSES[1]),
  v.literal(HEALTH_STATUSES[2]),
);
