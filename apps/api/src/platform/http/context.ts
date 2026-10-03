import { Context } from "effect";

import type { WorkerEnv } from "../env";

/** Cloudflare bindings supplied to the shared handler for this request only. */
export class WorkerBindings extends Context.Service<
  WorkerBindings,
  WorkerEnv
>()("vita/WorkerBindings") {}
