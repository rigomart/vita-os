import type { Doc } from "@convex/_generated/dataModel";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isToday,
  startOfMonth,
} from "date-fns";
import { CalendarRange } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ProjectTimelineBar } from "./project-timeline-bar";

const DAY_WIDTH = 24;

type ProjectWithStartDate = Doc<"projects"> & {
  startDate: number;
};

interface ProjectTimelineProps {
  projects: Doc<"projects">[];
  areaSlug?: string;
}

export function ProjectTimeline({ projects, areaSlug }: ProjectTimelineProps) {
  const today = useMemo(() => new Date(), []);

  const timelineProjects = useMemo(
    () =>
      projects.filter(
        (p): p is ProjectWithStartDate => p.startDate !== undefined,
      ),
    [projects],
  );

  const { rangeStart, rangeEnd, totalWidth } = useMemo(() => {
    if (timelineProjects.length === 0) {
      return {
        rangeStart: today,
        rangeEnd: today,
        totalWidth: 0,
      };
    }

    const earliest = Math.min(...timelineProjects.map((p) => p.startDate));
    const latestEnd = Math.max(
      today.getTime(),
      ...timelineProjects.map((p) => p.endDate ?? today.getTime()),
    );

    const start = startOfMonth(new Date(earliest));
    const end = endOfMonth(addMonths(new Date(latestEnd), 1));
    const days = differenceInCalendarDays(end, start) + 1;

    return {
      rangeStart: start,
      rangeEnd: end,
      totalWidth: days * DAY_WIDTH,
    };
  }, [timelineProjects, today]);

  const months = useMemo(() => {
    if (timelineProjects.length === 0) return [];
    return eachMonthOfInterval({
      start: rangeStart,
      end: rangeEnd,
    });
  }, [timelineProjects.length, rangeStart, rangeEnd]);

  const days = useMemo(() => {
    if (timelineProjects.length === 0) return [];
    return eachDayOfInterval({
      start: rangeStart,
      end: rangeEnd,
    });
  }, [timelineProjects.length, rangeStart, rangeEnd]);

  if (timelineProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarRange className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Add dates to your projects to see them on the timeline.
        </p>
      </div>
    );
  }

  const todayOffset = differenceInCalendarDays(today, rangeStart);
  const todayLeft = todayOffset * DAY_WIDTH;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div style={{ width: totalWidth }}>
        {/* Month labels */}
        <div className="flex border-b bg-background">
          {months.map((month, i) => {
            const monthStart = i === 0 ? rangeStart : startOfMonth(month);
            const monthEnd =
              i === months.length - 1 ? rangeEnd : startOfMonth(months[i + 1]);
            const spanDays =
              differenceInCalendarDays(monthEnd, monthStart) +
              (i === months.length - 1 ? 1 : 0);

            return (
              <div
                key={month.getTime()}
                className="border-r px-2 py-1 text-xs font-medium text-muted-foreground"
                style={{ width: spanDays * DAY_WIDTH }}
              >
                {format(month, "MMM yyyy")}
              </div>
            );
          })}
        </div>

        {/* Day numbers */}
        <div className="flex border-b bg-background">
          {days.map((day) => (
            <div
              key={day.getTime()}
              className={cn(
                "shrink-0 text-center text-[10px] leading-6",
                isToday(day)
                  ? "font-bold text-destructive"
                  : day.getDay() === 0 || day.getDay() === 6
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground",
              )}
              style={{ width: DAY_WIDTH }}
            >
              {day.getDate()}
            </div>
          ))}
        </div>

        {/* Timeline body */}
        <div className="relative py-1">
          {/* Today marker */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-destructive/50"
            style={{ left: todayLeft + DAY_WIDTH / 2 }}
          />

          {/* Project rows */}
          {timelineProjects.map((project) => (
            <ProjectTimelineBar
              key={project._id}
              project={project}
              rangeStart={rangeStart}
              today={today}
              areaSlug={areaSlug}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
