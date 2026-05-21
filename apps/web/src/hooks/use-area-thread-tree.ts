import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

export function useAreaThreadTree() {
  const threads = useQuery(api.threads.list);
  const areas = useQuery(api.areas.list);

  const areaThreads = useMemo(() => {
    const grouped = new Map<Id<"areas">, NonNullable<typeof threads>>();
    for (const thread of threads ?? []) {
      if (thread.areaId) {
        const list = grouped.get(thread.areaId) ?? [];
        list.push(thread);
        grouped.set(thread.areaId, list);
      }
    }
    return grouped;
  }, [threads]);

  return { areas, threads, areaThreads };
}
