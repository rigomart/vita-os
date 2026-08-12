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
] as const;

export type AreaIcon = (typeof AREA_ICONS)[number];

/**
 * The icon an Area gets when nobody has picked one: what the new-Area form
 * opens on, and what `migrations.backfillAreaIcons` stamped on the Areas that
 * predate the field. Not a read-time fallback — `areas.icon` is required, so
 * every stored Area already has one.
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
