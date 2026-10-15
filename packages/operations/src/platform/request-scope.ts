import { newRecordId } from "@vita-os/core";

import type { Database } from "./database";

/**
 * Time and identity, injected.
 *
 * Integration tests force a real primary-key collision and freeze time through
 * these rather than through a test-only branch inside storage.
 */
export interface Clock {
  now(): number;
  newId(): string;
}

/** Real time and real randomness, for everything that is not a test. */
export const systemClock: Clock = {
  now: () => Date.now(),
  newId: () => newRecordId(),
};

/**
 * Everything an operation is handed: the database, the clock, and the owner.
 *
 * It exists only after authentication, and storage is built from it, so no
 * statement can be written without the owner that scopes it and no caller
 * passes the owner a second time.
 */
export interface RequestScope {
  db: Database;
  clock: Clock;
  actorId: string;
}
