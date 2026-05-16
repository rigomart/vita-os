import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";
import { AttentionList } from "./attention-list";

interface AttentionItem {
  projectId: string;
  projectName: string;
  projectSlug: string | undefined;
  areaId: string;
  reason: "no_next_action";
}

export function AttentionSection() {
  const attention = useQuery(api.dashboard.attention);
  const areas = useQuery(api.areas.list);

  const areaMap = useMemo(
    () => new Map((areas ?? []).map((a: Doc<"areas">) => [a._id as string, a])),
    [areas],
  );

  return (
    <AttentionList
      items={(attention?.items ?? []).map((item: AttentionItem) => {
        const area = areaMap.get(item.areaId);
        const areaSlug = area?.slug ?? area?._id ?? item.areaId;
        const projectSlug = item.projectSlug ?? item.projectId;

        return {
          key: `${item.projectId}-${item.reason}`,
          projectName: item.projectName,
          area,
          areaSlug,
          projectSlug,
        };
      })}
    />
  );
}
