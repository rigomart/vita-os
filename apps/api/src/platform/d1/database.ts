import type { Database } from "@vita-os/operations";

import { isSqliteUniqueViolation } from "@vita-os/operations";
import { drizzle } from "drizzle-orm/d1";

/** The operations' database on the request's D1 binding. */
export function d1Database(binding: D1Database): Database {
  return {
    drizzle: drizzle(binding),
    changes: (result) => (result as D1Result).meta.changes,
    isUniqueViolation: isSqliteUniqueViolation,
  };
}
