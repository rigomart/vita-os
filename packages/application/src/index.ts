/**
 * Vita OS, as an application.
 *
 * Everything the product *is* lives here: its screens, its reads and commands,
 * its cache and invalidation rules, and the optimistic behavior that makes it
 * feel immediate. It knows nothing about how its data travels or how the person
 * using it was authenticated — a host supplies an `ApplicationClient` and a
 * `Viewer`, and mounts these screens wherever its routes live.
 */

/* Composition */
export {
  ApplicationClientProvider,
  useApplicationClient,
} from "./application-client-provider";
export {
  useViewer,
  ViewerProvider,
  type Viewer,
  type ViewerAccess,
} from "./viewer/viewer-context";

/* The authenticated product experience */
export { AreaDetailScreen } from "./areas/area-detail/area-detail-screen";
export { DashboardScreen } from "./dashboard/screens/dashboard-screen";
export { InboxScreen } from "./inbox/screens/inbox-screen";
export { InboxDeepLinkRedirect } from "./inbox/surface/inbox-deep-link-redirect";
export { AppShell } from "./layout/app-shell";
export {
  AppErrorBoundary,
  AppErrorFallback,
  RouteErrorFallback,
} from "./layout/error-boundary";
export { ThreadDetailView } from "./threads/thread-detail/thread-detail-view";

/* The product's own navigation contract */
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
