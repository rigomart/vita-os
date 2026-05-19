export const CONDITIONS = ["healthy", "needs_attention", "critical"] as const;

export type Condition = (typeof CONDITIONS)[number];

export const DEFAULT_CONDITION: Condition = "healthy";

export const conditionLabels: Record<Condition, string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  critical: "Critical",
};

export const conditionColors: Record<Condition, string> = {
  healthy: "bg-green-500",
  needs_attention: "bg-yellow-500",
  critical: "bg-red-500",
};

export const CONDITION_OPTIONS = CONDITIONS.map((value) => ({
  value,
  label: conditionLabels[value],
  color: conditionColors[value],
}));

export function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && CONDITIONS.includes(value as Condition);
}
