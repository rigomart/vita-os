import type { AreaId, AreaSummary, Thread } from "@vita-os/contracts";

import { useUpdateThread as useUpdateThreadCommand } from "@vita-os/application";

export type UpdateThreadValue = {
  title?: string;
  summary?: string | null;
  areaId?: string;
  nextMove?: string | null;
  followUp?: number | null;
  state?: "open" | "resolved";
  resolutionNote?: string;
};

/**
 * Edit the Thread this surface is showing.
 *
 * `options.areas` lets a caller that can move the Thread hand over the
 * destination Area, which keeps the rail's embedded Area in step; callers that
 * never set `areaId` can omit it.
 */
export function useUpdateThread(
  thread: Thread,
  options: { areas?: AreaSummary[] } = {},
) {
  const updateThread = useUpdateThreadCommand();

  return ({ areaId: requestedAreaId, ...value }: UpdateThreadValue) => {
    const areaId = requestedAreaId as AreaId | undefined;
    const destinationArea =
      areaId === undefined
        ? undefined
        : options.areas?.find((area) => area._id === areaId);

    return updateThread.mutateAsync({
      ...value,
      thread,
      ...(areaId === undefined ? {} : { areaId }),
      ...(destinationArea === undefined ? {} : { destinationArea }),
    });
  };
}
