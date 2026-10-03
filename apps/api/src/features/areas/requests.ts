import type { AreaId, UpdateAreaInput } from "@vita-os/contracts";

import { Schema } from "effect";

export const AreaIconSchema = Schema.Literals([
  "Compass",
  "HeartPulse",
  "Dumbbell",
  "Users",
  "Home",
  "BriefcaseBusiness",
  "WalletCards",
  "BookOpen",
  "Utensils",
  "Car",
  "CalendarDays",
  "Palette",
  "Leaf",
  "Shield",
  "Plane",
]);

export const AreaIdSchema = Schema.String.pipe(
  Schema.refine((value): value is AreaId => value.length > 0),
);
export const CreateAreaBody = Schema.Struct({
  name: Schema.String,
  icon: AreaIconSchema,
});
export const UpdateAreaBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  icon: Schema.optional(AreaIconSchema),
});
export const AreaOrderBody = Schema.Struct({
  areaIds: Schema.Array(AreaIdSchema),
});

export function normalizeAreaChange(
  input: typeof UpdateAreaBody.Type,
): Omit<UpdateAreaInput, "areaId"> {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.icon === undefined ? {} : { icon: input.icon }),
  };
}
