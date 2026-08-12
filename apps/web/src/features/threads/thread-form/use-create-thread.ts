import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import {
  optimisticallyCreateThreadInArea,
  optimisticallyCreateThreadInList,
} from "@/features/threads/optimistic";

import type { CreatedThreadResult, ThreadFormValue } from "./types";

export function useCreateThread() {
  const createThread = useMutation(api.threads.create).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyCreateThreadInList(localStore, args);
      optimisticallyCreateThreadInArea(localStore, args);
    },
  );

  return async (value: ThreadFormValue): Promise<CreatedThreadResult> => {
    const { slug } = await createThread(value);
    return { slug, areaId: value.areaId };
  };
}
