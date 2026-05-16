import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useCreateProjectLog } from "@/features/projects/use-create-project-log";
import { useStableQuery } from "@/hooks/use-stable-query";
import { ProjectLog } from "./project-log";

interface ProjectLogSectionProps {
  projectSlug: string;
}

export function ProjectLogSection({ projectSlug }: ProjectLogSectionProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const logs = useQuery(
    api.projectLogs.listByProject,
    project ? { projectId: project._id } : "skip",
  );
  const createLog = useCreateProjectLog();

  return (
    <ProjectLog
      logs={logs}
      onAddNote={async (content) => {
        if (!project) return;
        await createLog({ projectId: project._id, content });
      }}
    />
  );
}
