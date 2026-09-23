import type { AreaIcon } from "@vita-os/contracts";

export const AREA_ICONS = [
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
] as const satisfies readonly AreaIcon[];

/**
 * The icon an Area gets when nobody has picked one: what the new-Area form
 * opens on. Not a read-time fallback — every stored Area already has one.
 */
export const DEFAULT_AREA_ICON: AreaIcon = "Compass";

export const areaIconLabels: Record<AreaIcon, string> = {
  Compass: "Compass",
  HeartPulse: "Health",
  Dumbbell: "Fitness",
  Users: "Relationships",
  Home: "Home",
  BriefcaseBusiness: "Career",
  WalletCards: "Finances",
  BookOpen: "Learning",
  Utensils: "Food",
  Car: "Transport",
  CalendarDays: "Planning",
  Palette: "Creativity",
  Leaf: "Nature",
  Shield: "Security",
  Plane: "Travel",
};

export function isAreaIcon(value: unknown): value is AreaIcon {
  return typeof value === "string" && AREA_ICONS.includes(value as AreaIcon);
}
