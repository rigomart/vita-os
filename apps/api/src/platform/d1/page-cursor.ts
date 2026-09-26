import type { ApplicationError } from "@vita-os/contracts";

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

export const invalidPagination: ApplicationError = {
  code: "validation",
  message: "Invalid pagination.",
  retryable: false,
};

/**
 * A cursor this Worker did not mint. It carries the refusal its history
 * answers with, so the error handler needs no knowledge of which read it was.
 */
export class InvalidPageCursorError extends Error {
  constructor(
    message: string,
    readonly refusal: ApplicationError = invalidPagination,
  ) {
    super(message);
    this.name = "InvalidPageCursorError";
  }
}

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
 * time, which sort last. `refusal` is what an unreadable cursor answers with.
 */
export function createPageCursorCodec(
  timestampKey: string,
  options: { nullableTimestamp?: boolean; refusal?: ApplicationError } = {},
): PageCursorCodec {
  const nullableTimestamp = options.nullableTimestamp ?? false;
  const invalid = (message: string) =>
    new InvalidPageCursorError(message, options.refusal);

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
      if (error instanceof InvalidPageCursorError) throw invalid(error.message);
      throw invalid("Cursor is not JSON");
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
      throw invalid("Cursor has an invalid shape");
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
      throw invalid("Cursor has invalid values");
    }

    const cursor: PageCursor = { at: at as number | null, id };
    if (value !== encode(cursor)) {
      throw invalid("Cursor is not canonical");
    }

    return cursor;
  }

  return { encode, decode };
}

/** Done Notes of either kind read by completion time, which imported records may lack. */
export const doneCursor = createPageCursorCodec("completedAt", {
  nullableTimestamp: true,
});

/**
 * Where the next page of a newest-first history starts.
 *
 * The ordering timestamp can be absent — a Done record imported without a
 * completion time — and SQLite sorts NULL below every number, which is where an
 * unknown completion belongs. Once a page has crossed into those records, only
 * their IDs continue the read.
 */
export function pageBoundary(
  column: string,
  cursor: PageCursor | undefined,
): { sql: string; binds: (string | number | null)[] } {
  if (cursor === undefined) return { sql: "", binds: [] };

  if (cursor.at === null) {
    return { sql: ` AND ${column} IS NULL AND id < ?`, binds: [cursor.id] };
  }

  return {
    sql:
      ` AND (${column} IS NULL OR ${column} < ?` +
      ` OR (${column} = ? AND id < ?))`,
    binds: [cursor.at, cursor.at, cursor.id],
  };
}

/**
 * One bounded page, and the cursor that continues it.
 *
 * A read asks for one row more than the page holds: that extra row is how the
 * page knows whether anything lies behind it, and it never reaches the caller.
 * Every history in Vita OS is paged this way, so the rule lives here once rather
 * than in each feature's storage.
 */
export function toPage<TRow, TEntry>(
  rows: TRow[],
  limit: number,
  options: {
    toEntry: (row: TRow) => TEntry;
    cursorFor: (entry: TEntry) => PageCursor;
    codec: PageCursorCodec;
  },
): { entries: TEntry[]; nextCursor?: string } {
  const entries = rows.slice(0, limit).map(options.toEntry);
  const lastEntry = entries.at(-1);

  return {
    entries,
    ...(rows.length <= limit || lastEntry === undefined
      ? {}
      : { nextCursor: options.codec.encode(options.cursorFor(lastEntry)) }),
  };
}
