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

import { useApplicationMutation } from "../cache/use-application-mutation";
import { useApplicationQuery } from "../cache/use-application-query";
import { queryKeys } from "../query-keys";
import {
  areaChangeKeys,
  settlePendingArea,
  showAreaChange,
  showAreaOrder,
  showAreaRemoval,
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
    optimistic: (cache, input, previousLocal) => {
      const pendingId = previousLocal ?? (newRecordId() as AreaId);
      showPendingArea(cache, input, { id: pendingId, now: Date.now() });
      return pendingId;
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
    optimistic: (cache, input) => showAreaChange(cache, input),
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
    optimistic: (cache, input) => showAreaOrder(cache, input.areaIds),
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
    optimistic: (cache, input) => showAreaRemoval(cache, input.areaId),
    alsoInvalidate: () => [queryKeys.threads.all],
  });
}
