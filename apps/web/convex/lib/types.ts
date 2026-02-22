export const HEALTH_STATUSES = [
  "healthy",
  "needs_attention",
  "critical",
] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const PROJECT_STATES = ["active", "completed", "dropped"] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export const healthLabels: Record<HealthStatus, string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  critical: "Critical",
};

export const healthColors: Record<HealthStatus, string> = {
  healthy: "bg-green-500",
  needs_attention: "bg-yellow-500",
  critical: "bg-red-500",
};
