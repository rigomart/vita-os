/** @deprecated Import from `./condition` instead. Kept for schema/API compatibility until #158. */
export {
  CONDITION_OPTIONS as HEALTH_STATUS_OPTIONS,
  CONDITIONS as HEALTH_STATUSES,
  type Condition as HealthStatus,
  conditionColors as healthColors,
  conditionLabels as healthLabels,
  DEFAULT_CONDITION as DEFAULT_HEALTH_STATUS,
  isCondition as isHealthStatus,
} from "./condition";
