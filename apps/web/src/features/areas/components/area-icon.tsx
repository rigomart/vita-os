import type { AreaIcon as AreaIconName } from "@convex/lib/areaIcons";

import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  Compass,
  Dumbbell,
  HeartPulse,
  Home,
  Leaf,
  Palette,
  Plane,
  Shield,
  Users,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

const areaIconComponents: Record<AreaIconName, LucideIcon> = {
  Compass,
  HeartPulse,
  Dumbbell,
  Users,
  Home,
  BriefcaseBusiness,
  WalletCards,
  BookOpen,
  Utensils,
  Car,
  CalendarDays,
  Palette,
  Leaf,
  Shield,
  Plane,
};

interface AreaIconProps {
  icon: AreaIconName;
  className?: string;
}

export function AreaIcon({ icon, className }: AreaIconProps) {
  const Icon = areaIconComponents[icon];
  return <Icon className={className} aria-hidden="true" />;
}
