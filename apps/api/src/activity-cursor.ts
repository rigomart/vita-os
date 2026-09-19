export type ActivityCursor = {
  createdAt: number;
  id: string;
};

export class InvalidActivityCursorError extends Error {}

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
    throw new InvalidActivityCursorError("Cursor is not base64url");
  }

  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + padding);
  } catch {
    throw new InvalidActivityCursorError("Cursor is not base64url");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function encodeActivityCursor(cursor: ActivityCursor): string {
  return toBase64Url(
    JSON.stringify({ v: 1, createdAt: cursor.createdAt, id: cursor.id }),
  );
}

export function decodeActivityCursor(value: string): ActivityCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(value));
  } catch (error) {
    if (error instanceof InvalidActivityCursorError) throw error;
    throw new InvalidActivityCursorError("Cursor is not JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 3 ||
    !Object.hasOwn(parsed, "v") ||
    !Object.hasOwn(parsed, "createdAt") ||
    !Object.hasOwn(parsed, "id")
  ) {
    throw new InvalidActivityCursorError("Cursor has an invalid shape");
  }

  const { v, createdAt, id } = parsed as Record<string, unknown>;
  if (
    v !== 1 ||
    typeof createdAt !== "number" ||
    !Number.isSafeInteger(createdAt) ||
    typeof id !== "string" ||
    id.length === 0
  ) {
    throw new InvalidActivityCursorError("Cursor has invalid values");
  }

  if (value !== encodeActivityCursor({ createdAt, id })) {
    throw new InvalidActivityCursorError("Cursor is not canonical");
  }

  return { createdAt, id };
}
