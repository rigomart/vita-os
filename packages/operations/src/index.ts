export type { Database, SQLiteDatabase } from "./platform/database";
export type { OperationFailure } from "./platform/failures";
export type { Operation } from "./platform/operation";
export type { PageSize } from "./platform/page-size";
export type { Clock, RequestScope } from "./platform/request-scope";

export { isSqliteUniqueViolation } from "./platform/database";
export {
  operationFailures,
  toApplicationError,
  unexpectedFailure,
} from "./platform/failures";
export { isPageLimit } from "./platform/page-size";
export { attempt, database } from "./platform/operation";
export { systemClock } from "./platform/request-scope";
export { invalidPagination } from "./platform/sqlite/page-cursor";

export { invalidActivityPagination } from "./features/activity-log/errors";
export * from "./features/activity-log/operations";
export * from "./features/add-to-thread/operations";
export * from "./features/areas/operations";
export * from "./features/notes/operations";
export * from "./features/thread-notes/operations";
export * from "./features/threads/operations";
