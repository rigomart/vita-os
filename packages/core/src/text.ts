import { ValidationError } from "./errors";

/**
 * Trim non-blank text, or refuse with "<label> cannot be empty". Names,
 * titles, bodies, and moves all pass through here so blanks are refused
 * identically wherever they arrive from.
 */
export function requireNonBlankText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`${label} cannot be empty`);
  }
  return trimmed;
}
