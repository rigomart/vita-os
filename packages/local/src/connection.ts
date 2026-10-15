import { createClient, type Client } from "@libsql/client";
import { pathToFileURL } from "node:url";

/**
 * One connection, because `foreign_keys` is per connection and libsql
 * otherwise pools them. D1 always enforces foreign keys.
 */
export async function openConnection(databasePath: string): Promise<Client> {
  const client = createClient({
    url: pathToFileURL(databasePath).href,
    concurrency: 1,
  });
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    const setting = await client.execute("PRAGMA foreign_keys");
    if (Number(setting.rows[0]?.foreign_keys) !== 1) {
      throw new Error(`Foreign keys could not be enabled on ${databasePath}.`);
    }
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}
