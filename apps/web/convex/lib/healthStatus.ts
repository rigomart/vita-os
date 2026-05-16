export const HEALTH_STATUSES = [
  "healthy",
  "needs_attention",
  "critical",
] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const DEFAULT_HEALTH_STATUS: HealthStatus = "healthy";

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

export const HEALTH_STATUS_OPTIONS = HEALTH_STATUSES.map((value) => ({
  value,
  label: healthLabels[value],
  color: healthColors[value],
}));

export function isHealthStatus(value: unknown): value is HealthStatus {
  return (
    typeof value === "string" && HEALTH_STATUSES.includes(value as HealthStatus)
  );
}
