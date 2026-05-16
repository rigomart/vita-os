export {
  DEFAULT_HEALTH_STATUS,
  HEALTH_STATUS_OPTIONS,
  HEALTH_STATUSES,
  type HealthStatus,
  healthColors,
  healthLabels,
  isHealthStatus,
} from "./healthStatus";

export const PROJECT_STATES = ["active", "completed", "dropped"] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];
