export const CONDITIONS = ["healthy", "needs_attention", "critical"] as const;

export type Condition = (typeof CONDITIONS)[number];

export const DEFAULT_CONDITION: Condition = "healthy";

export const conditionLabels: Record<Condition, string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  critical: "Critical",
};

export const CONDITION_OPTIONS = CONDITIONS.map((value) => ({
  value,
  label: conditionLabels[value],
}));

export function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && CONDITIONS.includes(value as Condition);
}
