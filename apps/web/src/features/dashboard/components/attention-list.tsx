import type { Doc } from "@convex/_generated/dataModel";

import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import {
  Bell,
  CalendarClock,
  Circle,
  CircleCheck,
  CircleDot,
} from "lucide-react";

import type { DashboardAttentionThread } from "@/features/dashboard/attention-state";

export interface AttentionListTask extends DashboardAttentionThread {
  key: string;
  threadName: string;
  threadSlug: string;
  area?: Doc<"areas">;
  areaSlug: string;
}

interface AttentionListProps {
  title: string;
  tone: "due" | "scheduled" | "ready" | "open";
  tasks: AttentionListTask[];
}

const groupTone = {
  due: {
    Icon: Bell,
    badge: "Follow-up due",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-500",
    iconClassName: "bg-amber-500/15 text-amber-500",
  },
  scheduled: {
    Icon: CalendarClock,
    badge: "Scheduled",
    className: "border-sky-500/25 bg-sky-500/10 text-sky-600",
    iconClassName: "bg-sky-500/15 text-sky-600",
  },
  ready: {
    Icon: CircleCheck,
    badge: "Ready",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
    iconClassName: "bg-emerald-500/15 text-emerald-600",
  },
  open: {
    Icon: Circle,
    badge: "Open",
    className: "border-muted-foreground/20 bg-surface-3 text-muted-foreground",
    iconClassName: "bg-surface-3 text-muted-foreground",
  },
};

export function AttentionList({ title, tone, tasks }: AttentionListProps) {
  if (tasks.length === 0) return null;

  const { Icon, badge, className, iconClassName } = groupTone[tone];

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md ${iconClassName}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
        {tasks.map((task) => (
          <Link
            key={task.key}
            to="/$areaSlug/$threadSlug"
            params={{ areaSlug: task.areaSlug, threadSlug: task.threadSlug }}
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-surface-3/60"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{task.threadName}</p>
              {task.area && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {task.area.name}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 gap-1 text-[10px] ${className}`}
            >
              <CircleDot className="h-3 w-3" />
              {badge}
            </Badge>
          </Link>
        ))}
      </div>
    </section>
  );
}
