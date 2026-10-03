import { ValidationError } from "./errors";

/**
 * Searching Archived Notes by what they say.
 *
 * A search is a few words, and a Note matches when its body contains every one
 * of them, in any order and any case. The bounds keep a search one bounded
 * statement: a phrase fits, an essay does not.
 */

export const NOTE_SEARCH_MAX_LENGTH = 200;
export const NOTE_SEARCH_MAX_TERMS = 8;

function splitTerms(query: string): string[] {
  return [...new Set(query.trim().split(/\s+/).filter(Boolean))];
}

/**
 * The words a body must contain. A blank search has none, so it matches every
 * Note; a search past the bounds is refused rather than silently shortened.
 */
export function noteSearchTerms(query: string): string[] {
  if (query.length > NOTE_SEARCH_MAX_LENGTH) {
    throw new ValidationError("Search is too long.");
  }
  const terms = splitTerms(query);
  if (terms.length > NOTE_SEARCH_MAX_TERMS) {
    throw new ValidationError("Search has too many words.");
  }
  return terms;
}

/**
 * What a client asks for when someone types `query`: the same words, cut to
 * the bounds, so typing never produces a refused search.
 */
export function boundNoteSearch(query: string): string {
  const bounded: string[] = [];
  let length = 0;
  for (const term of splitTerms(query).slice(0, NOTE_SEARCH_MAX_TERMS)) {
    const next = length + (bounded.length > 0 ? 1 : 0) + term.length;
    if (next > NOTE_SEARCH_MAX_LENGTH) break;
    bounded.push(term);
    length = next;
  }
  return bounded.join(" ");
}

/** Whether `body` contains every word of `query`, ignoring case. */
export function matchesNoteSearch(body: string, query: string): boolean {
  const haystack = body.toLowerCase();
  return splitTerms(query).every((term) =>
    haystack.includes(term.toLowerCase()),
  );
}
