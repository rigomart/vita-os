import type { CreatedThreadResult, ThreadFormValue } from "./types";

import { useCreateThread as useCreateThreadCommand } from "../hooks";

/**
 * Capture a Thread. The caller navigates to the slug the service chose, not to
 * the placeholder the optimistic change showed.
 */
export function useCreateThread() {
  const createThread = useCreateThreadCommand();

  return async (value: ThreadFormValue): Promise<CreatedThreadResult> => {
    const thread = await createThread.mutateAsync(value);
    return { slug: thread.slug, areaId: value.areaId };
  };
}
