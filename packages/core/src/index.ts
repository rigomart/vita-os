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
  attentionDate,
  groupThreadsByAttention,
  soonestTaskDate,
  startOfLocalDay,
  timeOfDay,
  withTimeOfDay,
  type ThreadAttentionGroups,
  type ThreadAttentionInput,
} from "./attention";
export { clearedToAbsent } from "./clearable";
export {
  boundNoteSearch,
  matchesNoteSearch,
  NOTE_SEARCH_MAX_LENGTH,
  NOTE_SEARCH_MAX_TERMS,
  noteSearchTerms,
} from "./note-search";
export { newRecordId } from "./record-id";
export { ConflictError, ValidationError } from "./errors";
export {
  decideAddTask,
  decideCompleteTask,
  decideEditTask,
  decideFocusTask,
  decideRemoveTask,
  decideSetTaskDate,
  decideSetTaskRepeat,
  decideSkipTask,
  hasTasks,
  isTaskDate,
  MAX_TASK_DATE,
  MIN_TASK_DATE,
  requireTaskDate,
  requireRepeat,
  requireTimeZone,
  leadTask,
  requireTaskId,
  requireTaskText,
  requireOpenForTasks,
  taskSlot,
  type TaskSlot,
  type TaskState,
} from "./tasks";
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
  decideAddNoteToThread,
  decideThreadUpdate,
  FOLLOW_UP_TASK_TEXT,
  sanitizeThreadPatch,
  taskFromNote,
  taskTextFromNote,
  type ThreadChangeState,
  type ThreadPatch,
  type ThreadUpdateDecision,
} from "./thread-changes";
