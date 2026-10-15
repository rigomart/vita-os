import type { Database, RequestScope } from "@vita-os/operations";

import { systemClock } from "@vita-os/operations";

/** How an authenticated request becomes a scope. Tests replace it. */
export type CreateScope = (authenticated: {
  db: Database;
  actorId: string;
}) => RequestScope;

export const createRequestScope: CreateScope = (authenticated) => ({
  ...authenticated,
  clock: systemClock,
});
