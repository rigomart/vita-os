import type { CSSProperties } from "react";

import { Skeleton } from "@vita-os/ui/components/skeleton";
import { cn } from "@vita-os/ui/lib/utils";

import { lookAt, NO_DATE_FILL } from "./dashboard-list-model";

const GROUPS = [
  { distance: 0, label: "w-[3.2em]", lines: ["w-3/5", "w-2/5"] },
  { distance: 1, label: "w-[5em]", lines: ["w-1/2"] },
  { distance: 2, label: "w-[3.5em]", lines: ["w-2/3", "w-1/3"] },
  { distance: 4, label: "w-[4.5em]", lines: ["w-1/2", "w-2/5"] },
];

const OPACITY_BY_DISTANCE = [
  "",
  "opacity-85",
  "opacity-70",
  "opacity-55",
  "opacity-45",
];

/**
 * The Dashboard before its three queries land. Invisible for its first 300ms,
 * so a quick answer never flashes it.
 */
export function DashboardOverviewSkeleton() {
  return (
    <div
      aria-busy
      className="mx-auto grid max-w-[76rem] animate-in gap-x-12 px-4 duration-500 fade-in fill-mode-backwards delay-300 sm:px-6 lg:min-h-full lg:grid-cols-[minmax(0,1fr)_20rem]"
      data-testid="dashboard-overview-skeleton"
    >
      <p role="status" className="sr-only">
        Loading the Dashboard
      </p>
      <div className="min-w-0 lg:pb-16">
        <div className="pt-5 pb-3">
          <Skeleton className="h-10 w-56 rounded-full bg-muted/70" />
        </div>

        <div className="pt-1 pb-3 lg:hidden">
          <div className={cn("h-[5.25rem] rounded-2xl", NO_DATE_FILL)} />
        </div>

        <div className="@container">
          {GROUPS.map((group, index) => {
            const look = lookAt(group.distance);
            const hasNumeral = look.heading.numeral !== "";
            const wave = { animationDelay: `${index * 150}ms` };
            return (
              <div
                key={group.distance}
                className={cn(
                  look.heading.section,
                  OPACITY_BY_DISTANCE[group.distance],
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-2.5 border-t px-1",
                    look.heading.rule,
                  )}
                >
                  {hasNumeral && (
                    <Bar
                      className={cn("font-heading", look.heading.numeral)}
                      width="w-[1.2em]"
                      style={wave}
                    />
                  )}
                  <Bar
                    className={cn("font-heading", look.heading.label)}
                    width={group.label}
                    style={wave}
                  />
                </div>
                <div className="-mx-1.5">
                  {group.lines.map((width, line) => (
                    <div
                      key={line}
                      className={cn(
                        "grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 px-2.5 leading-snug",
                        look.line.frame,
                      )}
                    >
                      <div className="flex h-lh items-center justify-center">
                        <Skeleton
                          className="size-2.5 rounded-full bg-foreground/10"
                          style={wave}
                        />
                      </div>
                      <Bar width={width} style={wave} />
                      <Bar
                        className={cn(
                          "col-start-2 opacity-70",
                          look.line.detail,
                        )}
                        width="w-1/3"
                        style={wave}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden min-w-0 border-l pt-6 pr-3 pb-24 pl-8 lg:-mr-3 lg:block">
        <Bar className="font-heading text-xl font-semibold" width="w-[4.5em]" />
        <div className="flex flex-col gap-1.5 pt-4">
          <Bar className="pb-1 text-[13px]" width="w-[7em]" />
          {["w-3/5", "w-2/5"].map((width) => (
            <div
              key={width}
              className="-mx-3 flex h-[5.5rem] flex-col gap-2 rounded-xl border border-border/60 px-3 py-3"
            >
              <Skeleton className={cn("h-2.5 rounded-full", width)} />
              <Skeleton className="h-2 w-4/5 rounded-full opacity-70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bar({
  className,
  style,
  width,
}: {
  className?: string;
  style?: CSSProperties;
  width: string;
}) {
  return (
    <div className={cn("flex h-lh items-center", className)}>
      <Skeleton
        className={cn("h-[0.6em] rounded-full bg-foreground/10", width)}
        style={style}
      />
    </div>
  );
}
