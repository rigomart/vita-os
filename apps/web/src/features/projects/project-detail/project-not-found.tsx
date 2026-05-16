import { Link } from "@tanstack/react-router";

interface ProjectNotFoundProps {
  areaSlug: string;
}

export function ProjectNotFound({ areaSlug }: ProjectNotFoundProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Project not found.</p>
      <Link
        to="/$areaSlug"
        params={{ areaSlug }}
        className="mt-2 inline-block text-sm underline"
      >
        Back to area
      </Link>
    </div>
  );
}
