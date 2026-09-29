import type { AreaId } from "@vita-os/contracts";

import { useCreateThread as useCreateThreadCommand } from "./hooks";

export type CreateThreadValue = {
  title: string;
  areaId?: AreaId;
};

/**
 * Capture a Thread. The caller navigates to the slug the service chose, not to
 * the placeholder the optimistic change showed.
 */
export function useCreateThread() {
  const createThread = useCreateThreadCommand();

  return async (value: CreateThreadValue): Promise<{ slug: string }> => {
    const thread = await createThread.mutateAsync(value);
    return { slug: thread.slug };
  };
}
