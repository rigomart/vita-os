import { instanceName, VitaError } from "./instance.ts";
import { up } from "./stack.ts";

export default async function globalSetup() {
  const name = instanceName();
  const started = Date.now();
  const result = await up(name).catch((error: unknown) => {
    if (error instanceof VitaError)
      throw new Error(
        `verify up failed: ${error.message}\nhint: ${error.hint}`,
      );
    throw error;
  });
  process.stderr.write(
    `verify instance "${name}" ${result.reused ? "reused" : `started in ${Math.round((Date.now() - started) / 1000)}s`}: ${result.webUrl} (API ${result.apiUrl}). Stop it with: bun run verify down --instance ${name}\n`,
  );
}
