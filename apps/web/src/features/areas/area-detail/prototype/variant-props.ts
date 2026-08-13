// PROTOTYPE — throwaway code. Five design variants of the Area view,
// switchable via `?variant=` on the existing `/$areaSlug` route.
// Everything under this `prototype/` directory is disposable; do not build on it.

import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

/**
 * The contract every Area view variant receives. Variants own their entire
 * layout (container, header, list) and must be read-only: navigation and
 * opening the existing dialogs (via the two callbacks) are the only writes.
 */
export interface AreaVariantProps {
  area: ProjectedArea;
  threads: ProjectedThread[];
  /** Attention clock timestamp — pass to grouping helpers and AttentionRow. */
  now: number;
  /** Opens the existing EditAreaDialog. */
  onEdit: () => void;
  /** Opens the existing CreateThreadDialog. */
  onCreateThread: () => void;
}
