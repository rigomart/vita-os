import type { UseQueryResult } from "@tanstack/react-query";
import type {
  AreaId,
  ApplicationError,
  AreaSummary,
  CommandAcknowledgement,
  CreateAreaInput,
  UpdateAreaInput,
} from "@vita-os/contracts";

import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";

import { changeRecords, patchQuery } from "../cache/patch";
import { useApplicationMutation } from "../cache/use-application-mutation";
import { useApplicationQuery } from "../cache/use-application-query";
import { queryKeys } from "../query-keys";
import {
  areaChangeKeys,
  settlePendingArea,
  optimisticallyChangeArea,
  optimisticallyRemoveArea,
  showAreaOrder,
  showPendingArea,
} from "./optimistic";

/**
 * Every Area the person keeps, in their own manual order.
 *
 * `enabled: false` leaves the read alone entirely, for a surface — a closed
 * command palette — that is not showing Areas yet.
 */
export function useAreas(
  options: { enabled?: boolean } = {},
): UseQueryResult<AreaSummary[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.areas.list(),
    run: (client) => client.listAreas(),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  });
}

/**
 * Creating an Area shows it in the list straight away, at the position the
 * service will give it, and swaps in the real record — with the real ID and slug
 * — as soon as the service answers.
 */
export function useCreateArea(): ApplicationMutationResult<
  CreateAreaInput,
  AreaSummary,
  AreaId
> {
  return useApplicationMutation<CreateAreaInput, AreaSummary, AreaId>({
    run: (client, input) => client.createArea(input),
    affected: (_input, cache) => areaChangeKeys(cache),
    optimistic: (cache, input) => {
      const pendingId = newRecordId() as AreaId;
      const rollback = changeRecords<AreaSummary>(
        cache,
        [queryKeys.areas.list()],
        [pendingId],
        [],
        () => showPendingArea(cache, input, { id: pendingId, now: Date.now() }),
      );
      return { local: pendingId, ...rollback };
    },
    reconcile: (cache, area, _input, pendingId) => {
      if (pendingId === undefined) return;
      settlePendingArea(cache, pendingId, area);
    },
  });
}

export function useUpdateArea(): ApplicationMutationResult<
  UpdateAreaInput,
  AreaSummary
> {
  return useApplicationMutation<UpdateAreaInput, AreaSummary>({
    run: (client, input) => client.updateArea(input),
    affected: (input, cache) => areaChangeKeys(cache, input.areaId),
    optimistic: (cache, input) => optimisticallyChangeArea(cache, input),
  });
}

/** Put every Area in the given order. */
export function useReorderAreas(): ApplicationMutationResult<
  { areaIds: AreaId[] },
  AreaSummary[]
> {
  return useApplicationMutation<{ areaIds: AreaId[] }, AreaSummary[]>({
    run: (client, input) => client.reorderAreas(input),
    affected: (_input, cache) => areaChangeKeys(cache),
    optimistic: (cache, input) => {
      const undo = changeRecords<AreaSummary>(
        cache,
        [queryKeys.areas.list()],
        input.areaIds,
        ["order"],
        () => showAreaOrder(cache, input.areaIds),
      );
      return {
        rollback: () => {
          undo.rollback();
          patchQuery<AreaSummary[]>(cache, queryKeys.areas.list(), (areas) =>
            [...areas].sort((a, b) => a.order - b.order),
          );
        },
      };
    },
  });
}

/**
 * Deleting an Area. Its Threads lose the label and stay open; resolved Threads
 * and Activity Logs are read separately, so every Thread read is refreshed.
 */
export function useRemoveArea(): ApplicationMutationResult<
  { areaId: AreaId },
  CommandAcknowledgement
> {
  return useApplicationMutation<{ areaId: AreaId }, CommandAcknowledgement>({
    run: (client, input) => client.removeArea(input),
    affected: (input, cache) => [
      ...areaChangeKeys(cache, input.areaId),
      queryKeys.threads.open(),
    ],
    optimistic: (cache, input) => optimisticallyRemoveArea(cache, input.areaId),
    alsoInvalidate: () => [queryKeys.threads.all],
  });
}
