/**
 * The browser's IANA time zone. The service does not know the person's zone,
 * so every Task command that computes a calendar date — a repeating Task's
 * next occurrence, a weekly Repeat's first chosen day — carries this one, and
 * the screen decides its optimistic change in it too (ADR 0032).
 */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
