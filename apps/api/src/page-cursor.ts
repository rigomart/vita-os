/**
 * Opaque, versioned page cursors.
 *
 * A history is read newest first and ordered by a timestamp paired with the
 * record's ID, so tied timestamps neither duplicate nor skip an entry across
 * pages. A cursor carries exactly that pair. It is base64url text the caller
 * hands back unread: non-canonical encodings, unknown versions, and impossible
 * values are refused rather than guessed at, so a cursor cannot be edited into
 * an unbounded or someone else's read.
 */

export type PageCursor = {
  /** The ordering timestamp of the last entry on the page just read. */
  at: number | null;
  id: string;
};

export class InvalidPageCursorError extends Error {}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new InvalidPageCursorError("Cursor is not base64url");
  }

  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  } catch {
    throw new InvalidPageCursorError("Cursor is not base64url");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
    bytes,
  );
}

export interface PageCursorCodec {
  encode(cursor: PageCursor): string;
  decode(value: string): PageCursor;
}

/**
 * A codec for one ordering.
 *
 * `timestampKey` names the field inside the encoded cursor, so a cursor minted
 * for one ordering — an Activity Log read, say — is not silently accepted by a
 * read ordered on something else. `nullableTimestamp` allows the one ordering
 * whose timestamp can be absent: Done records imported without a completion
 * time, which sort last.
 */
export function createPageCursorCodec(
  timestampKey: string,
  options: { nullableTimestamp?: boolean } = {},
): PageCursorCodec {
  const nullableTimestamp = options.nullableTimestamp ?? false;

  function encode(cursor: PageCursor): string {
    return toBase64Url(
      JSON.stringify({ v: 1, [timestampKey]: cursor.at, id: cursor.id }),
    );
  }

  function decode(value: string): PageCursor {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fromBase64Url(value));
    } catch (error) {
      if (error instanceof InvalidPageCursorError) throw error;
      throw new InvalidPageCursorError("Cursor is not JSON");
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length !== 3 ||
      !Object.hasOwn(parsed, "v") ||
      !Object.hasOwn(parsed, timestampKey) ||
      !Object.hasOwn(parsed, "id")
    ) {
      throw new InvalidPageCursorError("Cursor has an invalid shape");
    }

    const record = parsed as Record<string, unknown>;
    const at = record[timestampKey];
    const { v, id } = record;
    const timestampIsValid =
      (typeof at === "number" && Number.isSafeInteger(at)) ||
      (nullableTimestamp && at === null);
    if (
      v !== 1 ||
      !timestampIsValid ||
      typeof id !== "string" ||
      id.length === 0
    ) {
      throw new InvalidPageCursorError("Cursor has invalid values");
    }

    const cursor: PageCursor = { at: at as number | null, id };
    if (value !== encode(cursor)) {
      throw new InvalidPageCursorError("Cursor is not canonical");
    }

    return cursor;
  }

  return { encode, decode };
}

/** The Activity Log reads by entry creation time. */
export const activityCursor = createPageCursorCodec("createdAt");

/** Done Notes read by completion time, which imported records may lack. */
export const doneCursor = createPageCursorCodec("completedAt", {
  nullableTimestamp: true,
});
