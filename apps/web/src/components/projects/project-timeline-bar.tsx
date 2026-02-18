import type { Doc } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

const DAY_WIDTH = 24;

interface ProjectTimelineBarProps {
  project: Doc<"projects"> & { startDate: number };
  rangeStart: Date;
  today: Date;
  areaSlug?: string;
}

export function ProjectTimelineBar({
  project,
  rangeStart,
  today,
  areaSlug,
}: ProjectTimelineBarProps) {
  const startDate = new Date(project.startDate);
  const endDate = project.endDate ? new Date(project.endDate) : today;
  const hasEndDate = !!project.endDate;

  const startOffset = differenceInCalendarDays(startDate, rangeStart);
  const duration = differenceInCalendarDays(endDate, startDate) + 1;

  return (
    <div className="relative h-10 w-full">
      <Link
        to={areaSlug ? "/$areaSlug/$projectSlug" : "/projects/$projectSlug"}
        params={
          areaSlug
            ? { areaSlug, projectSlug: project.slug ?? project._id }
            : { projectSlug: project.slug ?? project._id }
        }
        className={cn(
          "absolute top-1 flex h-8 items-center px-2",
          "bg-primary/15 text-foreground border border-primary/25",
          "text-xs font-medium truncate transition-colors",
          "hover:ring-2 hover:ring-ring/50",
          hasEndDate ? "rounded-md" : "rounded-l-md border-r-0",
        )}
        style={{
          left: startOffset * DAY_WIDTH,
          width: duration * DAY_WIDTH,
          minWidth: "3rem",
          ...(!hasEndDate && {
            maskImage: "linear-gradient(to right, black 60%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, black 60%, transparent)",
          }),
        }}
      >
        <span className="truncate">{project.name}</span>
      </Link>
    </div>
  );
}
