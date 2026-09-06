/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLogs from "../activityLogs.js";
import type * as areas from "../areas.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_activityWrites from "../lib/activityWrites.js";
import type * as lib_areaIcons from "../lib/areaIcons.js";
import type * as lib_areaThreads from "../lib/areaThreads.js";
import type * as lib_attentionOrdering from "../lib/attentionOrdering.js";
import type * as lib_condition from "../lib/condition.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_ownedAccess from "../lib/ownedAccess.js";
import type * as lib_pagination from "../lib/pagination.js";
import type * as lib_patch from "../lib/patch.js";
import type * as lib_slugs from "../lib/slugs.js";
import type * as lib_threadChanges from "../lib/threadChanges.js";
import type * as lib_upNext from "../lib/upNext.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_validators from "../lib/validators.js";
import type * as migrations from "../migrations.js";
import type * as notes from "../notes.js";
import type * as threads from "../threads.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLogs: typeof activityLogs;
  areas: typeof areas;
  auth: typeof auth;
  http: typeof http;
  "lib/activityLog": typeof lib_activityLog;
  "lib/activityWrites": typeof lib_activityWrites;
  "lib/areaIcons": typeof lib_areaIcons;
  "lib/areaThreads": typeof lib_areaThreads;
  "lib/attentionOrdering": typeof lib_attentionOrdering;
  "lib/condition": typeof lib_condition;
  "lib/helpers": typeof lib_helpers;
  "lib/ownedAccess": typeof lib_ownedAccess;
  "lib/pagination": typeof lib_pagination;
  "lib/patch": typeof lib_patch;
  "lib/slugs": typeof lib_slugs;
  "lib/threadChanges": typeof lib_threadChanges;
  "lib/upNext": typeof lib_upNext;
  "lib/validation": typeof lib_validation;
  "lib/validators": typeof lib_validators;
  migrations: typeof migrations;
  notes: typeof notes;
  threads: typeof threads;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
