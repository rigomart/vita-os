// PROTOTYPE — throwaway. Shared props contract for the dashboard "hero"
// (header + areas section) variants. Delete this directory when a variant wins.
import type {
  DashboardArea,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

export interface DashboardHeroProps {
  areas: DashboardArea[];
  threads: DashboardThread[];
  currentDate: number;
}
