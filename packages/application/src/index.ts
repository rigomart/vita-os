/**
 * Vita OS, as an application.
 *
 * Everything the product *is* lives here: its screens, its reads and commands,
 * its cache and invalidation rules, and the optimistic behavior that makes it
 * feel immediate. It knows nothing about how its data travels or how the person
 * using it was authenticated — a host supplies an `ApplicationClient` and a
 * `Viewer`, mounts the product's route tree, and adds whatever routes are
 * its own.
 */

/* Composition */
export {
  ApplicationClientProvider,
  useApplicationClient,
} from "./application-client-provider";
export { SessionGateProvider, type SessionGate } from "./viewer/session-gate";
export {
  useViewer,
  ViewerProvider,
  type Viewer,
  type ViewerAccess,
} from "./viewer/viewer-context";

/*
 * Recovery surfaces, for a host to mount around and inside the product.
 *
 * The screens and the app shell are deliberately absent: the route tree reaches
 * them by dynamic import, and re-exporting one here makes it a static import
 * again, which silently collapses the route chunks back into the entry bundle.
 */
export {
  AppErrorBoundary,
  AppErrorFallback,
  RouteErrorFallback,
} from "./layout/error-boundary";

/* The product's own routes, for a host to mount, and the contract they read */
export {
  authenticatedRouteTree,
  productRootRoute,
} from "./routes/product-route-tree";
export {
  readProductSearch,
  type ProductSearch,
} from "./navigation/search-params";

/* Appearance: a host initializes it, the product owns it from then on */
export {
  initializeTheme,
  ThemeProvider,
  useTheme,
  type ThemePreference,
} from "./theme/theme-provider";

/* Reads and commands, for a host that composes screens of its own */
export {
  useAreaDetail,
  useAreas,
  useCreateArea,
  useRemoveArea,
  useUpdateArea,
} from "./areas/hooks";
export type { ApplicationMutationResult } from "./cache/use-application-mutation";
export {
  useCaptureNote,
  useCompleteNote,
  useDiscardNote,
  useDoneNotes,
  useOpenNoteCount,
  useOpenNotes,
  useReopenNote,
  useUpdateNoteAttentionDate,
  useUpdateNoteBody,
  type CaptureNoteVariables,
  type DoneNotesResult,
} from "./notes/hooks";
export { queryKeys, threadQueryKeys } from "./query-keys";
export {
  useCaptureThreadNote,
  useCompleteThreadNote,
  useDiscardThreadNote,
  useDoneThreadNotes,
  useReopenThreadNote,
  useThreadNotes,
  useUpdateThreadNoteBody,
  type DoneThreadNotesResult,
} from "./thread-notes/hooks";
export {
  useCompleteNextMove,
  useCreateThread,
  useOpenThreads,
  useRemoveThread,
  useReplaceUpNext,
  useThreadActivity,
  useThreadDetail,
  useUpdateThread,
  type ThreadActivityResult,
  type UpdateThreadVariables,
} from "./threads/hooks";
