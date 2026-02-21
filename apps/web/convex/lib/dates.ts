/**
 * Validates that a startDate/endDate pair is consistent:
 * - endDate requires a startDate
 * - endDate must not be before startDate
 */
export function validateDateRange(startDate?: number, endDate?: number): void {
  if (endDate !== undefined && startDate === undefined) {
    throw new Error("End date requires a start date");
  }
  if (startDate !== undefined && endDate !== undefined && endDate < startDate) {
    throw new Error("End date must not be before start date");
  }
}

interface CurrentDates {
  startDate?: number;
  endDate?: number;
}

interface DateChanges {
  startDate?: number | null;
  endDate?: number | null;
}

/**
 * Given a project's current dates and the incoming update args,
 * computes the effective startDate/endDate pair and validates it.
 * Throws if the resulting state would be invalid.
 *
 * Convention: `null` means "clear", `undefined` means "no change".
 */
export function validateEffectiveDates(
  current: CurrentDates,
  changes: DateChanges,
): void {
  let effectiveStartDate = current.startDate;
  if (changes.startDate === null) {
    effectiveStartDate = undefined;
  } else if (changes.startDate !== undefined) {
    effectiveStartDate = changes.startDate;
  }

  let effectiveEndDate = current.endDate;
  if (changes.endDate === null || changes.startDate === null) {
    effectiveEndDate = undefined;
  } else if (changes.endDate !== undefined) {
    effectiveEndDate = changes.endDate;
  }

  validateDateRange(effectiveStartDate, effectiveEndDate);
}
