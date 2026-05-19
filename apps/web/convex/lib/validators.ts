import { v } from "convex/values";
import { CONDITIONS } from "./condition";

export const healthStatusValidator = v.union(
  v.literal(CONDITIONS[0]),
  v.literal(CONDITIONS[1]),
  v.literal(CONDITIONS[2]),
);
