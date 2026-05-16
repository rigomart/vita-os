import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

export function useAreaProjectTree() {
  const projects = useQuery(api.projects.list);
  const areas = useQuery(api.areas.list);

  const areaProjects = useMemo(() => {
    const grouped = new Map<Id<"areas">, NonNullable<typeof projects>>();
    for (const project of projects ?? []) {
      if (project.areaId) {
        const list = grouped.get(project.areaId) ?? [];
        list.push(project);
        grouped.set(project.areaId, list);
      }
    }
    return grouped;
  }, [projects]);

  return { areas, projects, areaProjects };
}
