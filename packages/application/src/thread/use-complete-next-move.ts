import type {
  ApplicationError,
  CompleteNextMoveOutput,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";

import {
  type QueryKey,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { decideNextMoveCompletion } from "@vita-os/core";

import { useApplicationClient } from "../application-client-provider";
import { threadQueryKeys } from "./query-keys";

interface CompleteNextMoveVariables {
  expectedNextMove: string | null;
  expectedRevision: number;
}

interface CompletionSnapshot {
  detailKey: QueryKey;
  activityKey: QueryKey;
  detail: ThreadDetail | undefined;
  activity: Array<[QueryKey, unknown]>;
}

function applyOptimisticCompletion(
  detail: ThreadDetail,
  variables: CompleteNextMoveVariables,
): ThreadDetail {
  if (
    (detail.thread.nextMove ?? null) !== variables.expectedNextMove ||
    detail.thread.revision !== variables.expectedRevision
  ) {
    return detail;
  }

  const decision = decideNextMoveCompletion(detail.thread);
  if (decision.status === "unchanged") return detail;

  const {
    nextMove: _nextMove,
    upNext: _upNext,
    ...unchangedThread
  } = detail.thread;
  return {
    ...detail,
    thread: { ...unchangedThread, ...decision.patch },
  };
}

export function useCompleteNextMove({
  threadId,
  slug,
}: {
  threadId: ThreadId;
  slug: string;
}): UseMutationResult<
  CompleteNextMoveOutput,
  ApplicationError,
  CompleteNextMoveVariables,
  CompletionSnapshot
> {
  const client = useApplicationClient();
  const queryClient = useQueryClient();
  const detailKey = threadQueryKeys.detail(slug);
  const activityKey = threadQueryKeys.activity(threadId);

  return useMutation({
    retry: false,
    mutationFn: async (variables) => {
      const result = await client.completeNextMove({ threadId, ...variables });
      if (!result.ok) throw result.error;
      return result.value;
    },
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: activityKey }),
      ]);

      const detail = queryClient.getQueryData<ThreadDetail>(detailKey);
      const activity = queryClient.getQueriesData({ queryKey: activityKey });
      if (detail !== undefined) {
        queryClient.setQueryData(
          detailKey,
          applyOptimisticCompletion(detail, variables),
        );
      }
      return { detailKey, activityKey, detail, activity };
    },
    onError: (_error, _variables, snapshot) => {
      if (snapshot === undefined) return;
      if (snapshot.detail !== undefined) {
        queryClient.setQueryData(snapshot.detailKey, snapshot.detail);
      }
      for (const [queryKey, data] of snapshot.activity) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: (_data, _error, _variables, snapshot) => {
      if (snapshot === undefined) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: snapshot.detailKey }),
        queryClient.invalidateQueries({ queryKey: snapshot.activityKey }),
      ]);
    },
  });
}
