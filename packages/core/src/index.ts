export {
  AUTO_ACTIVITY_LOG_ENTRY_TYPES,
  buildAreaMoveLogEntry,
  type AutoActivityLogEntry,
} from "./activity-log";
export {
  AREA_ICONS,
  areaIconLabels,
  DEFAULT_AREA_ICON,
  isAreaIcon,
} from "./area-icon";
/**
 * The enumeration's own type, re-exported beside its values.
 *
 * The contract remains its single definition; this saves every caller that
 * needs both `AREA_ICONS` and `AreaIcon` from importing the same vocabulary
 * from two places.
 */
export type { AreaIcon } from "@vita-os/contracts";
export {
  compareNotesByAttention,
  groupNotesByAttention,
  groupThreadsByAttention,
  isOpenNote,
  startOfLocalDay,
  type NoteAttentionGroups,
  type NoteAttentionInput,
  type ThreadAttentionGroups,
  type ThreadAttentionInput,
} from "./attention";
export { clearedToAbsent } from "./clearable";
export { newRecordId } from "./record-id";
export * from "./complete-next-move";
export { ConflictError, ValidationError } from "./errors";
export {
  generateSlug,
  RESERVED_AREA_SLUGS,
  slugify,
  validateAreaName,
} from "./slug";
export { requireNonBlankText } from "./text";
export {
  buildThreadLifecyclePatch,
  buildThreadPatchLogEntries,
  decideThreadUpdate,
  fillNextMoveFromUpNext,
  sanitizeThreadPatch,
  type ThreadChangeState,
  type ThreadPatch,
  type ThreadUpdateDecision,
} from "./thread-changes";
export {
  requireOpenForUpNext,
  requireUpNextMoves,
  storedUpNext,
  takeFrontUpNextMove,
} from "./up-next";
