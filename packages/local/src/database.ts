import type { Client, ResultSet } from "@libsql/client";
import type { Database } from "@vita-os/operations";

import { isSqliteUniqueViolation } from "@vita-os/operations";
import { drizzle } from "drizzle-orm/libsql";

/** Open the client with {@link openLocalDatabase} so foreign keys hold. */
export function libsqlDatabase(client: Client): Database {
  return {
    drizzle: drizzle(client),
    changes: (result) => {
      const set = result as Partial<ResultSet> | undefined;
      if (typeof set?.rowsAffected !== "number") {
        throw new Error("Expected a libsql result with rowsAffected.");
      }
      // libsql reports 0 rows affected for any statement that returns rows.
      if (set.columns !== undefined && set.columns.length > 0) {
        throw new Error(
          "libsql can't count the rows a statement with RETURNING wrote.",
        );
      }
      return set.rowsAffected;
    },
    isUniqueViolation: isSqliteUniqueViolation,
  };
}
