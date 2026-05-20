export {
  DEFAULT_HEALTH_STATUS,
  HEALTH_STATUS_OPTIONS,
  HEALTH_STATUSES,
  type HealthStatus,
  healthColors,
  healthLabels,
  isHealthStatus,
} from "./healthStatus";

export const PROJECT_STATES = [
  "open",
  "resolved",
  /** @deprecated Use open instead. */
  "active",
  /** @deprecated Use resolved instead. */
  "completed",
  /** @deprecated Use resolved instead. */
  "dropped",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export function isOpenProjectState(state: ProjectState): boolean {
  return state === "open" || state === "active";
}

export function toThreadLifecycleState(
  state: ProjectState,
): "open" | "resolved" {
  return isOpenProjectState(state) ? "open" : "resolved";
}
