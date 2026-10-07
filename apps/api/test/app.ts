import type { AppDependencies } from "../src/app";
import type { WorkerEnv } from "../src/platform/env";

import { createApp } from "../src/app";

/** Custom app requests use the same Hono app as the Worker. */
export function createTestApp(dependencies?: AppDependencies) {
  const app = createApp(dependencies);
  return {
    async request(path: string, init: RequestInit | undefined, env: WorkerEnv) {
      return await app.fetch(
        new Request(new URL(path, "http://api.test"), init),
        env,
      );
    },
  };
}
