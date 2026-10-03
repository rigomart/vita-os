import type { AppDependencies } from "../src/app";
import type { WorkerEnv } from "../src/platform/env";

import { createApp } from "../src/app";

/** Custom app requests use the same web adapter as the Worker. */
export function createTestApp(dependencies?: AppDependencies) {
  return {
    async request(path: string, init: RequestInit | undefined, env: WorkerEnv) {
      const app = createApp(dependencies);
      try {
        return await app.fetch(
          new Request(new URL(path, "http://api.test"), init),
          env,
        );
      } finally {
        await app.dispose();
      }
    },
  };
}
