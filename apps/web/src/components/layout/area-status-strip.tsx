import { api } from "@convex/_generated/api";
import { CONDITION_OPTIONS } from "@convex/lib/condition";
import { Link, useMatch } from "@tanstack/react-router";
import { Kbd } from "@vita-os/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionPillClassName } from "@/features/areas/condition-presentation";
import { useAreaJumpShortcuts } from "@/features/navigation/use-area-jump-shortcuts";
import { cn } from "@/lib/utils";

/** Slack-style direct jumps stop at 9 — the visible digit row is the point. */
const MAX_SHORTCUTS = 9;

function conditionLabel(condition: string) {
  return (
    CONDITION_OPTIONS.find(({ value }) => value === condition)?.label ??
    condition
  );
}

/**
 * Persistent Area switcher in the chrome (ADR 0011): one hexagon per Area in
 * the user's own order, each a one-click jump with a visible 1..9 digit.
 *
 * It also carries the Areas' **status**, which the Dashboard used to state a
 * second time in its own header. Condition is the hexagon's own colour rather
 * than a dot beside it — healthy Areas stay grey, so the only colour in the
 * strip belongs to the parts of life that are slipping — and the corner badge
 * is how much of the board is that Area's, so the strip answers "what is off,
 * and how much of it" without the Dashboard repeating itself.
 */
export function AreaStatusStrip() {
  const areas = useQuery(api.areas.list);
  // The same cached subscription the Dashboard and palette already hold, so
  // the counts cost a read of state this client has rather than a new query.
  const threads = useQuery(api.threads.list);
  const areaRouteMatch = useMatch({
    from: "/_authenticated/$areaSlug",
    shouldThrow: false,
  });
  const activeSlug = areaRouteMatch?.params.areaSlug;

  useAreaJumpShortcuts(areas);

  if (areas === undefined || areas.length === 0) return null;

  const openPerArea = new Map<string, number>();
  for (const thread of threads ?? []) {
    if (thread.state !== "open") continue;
    openPerArea.set(thread.areaId, (openPerArea.get(thread.areaId) ?? 0) + 1);
  }

  return (
    <TooltipProvider delay={200}>
      <nav
        aria-label="Life Areas"
        // min-w-0 + scroll keeps a long Area list from widening the cluster
        // past the room the chrome has for it.
        className="hidden min-w-0 items-center gap-1 overflow-x-auto py-1 -my-1 md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {areas.map((area, index) => {
          const active = area.slug === activeSlug;
          const shortcut = index < MAX_SHORTCUTS ? index + 1 : undefined;
          const flagged = area.condition !== "healthy";
          const open = openPerArea.get(area._id) ?? 0;

          return (
            <Tooltip key={area._id}>
              <TooltipTrigger
                render={
                  <Link
                    to="/$areaSlug"
                    params={{ areaSlug: area.slug }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 w-8 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md ring-ring outline-none transition-colors focus-visible:ring-2",
                      active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  />
                }
              >
                <BrandHexagon
                  className={cn(
                    "size-6 transition-colors",
                    flagged
                      ? conditionPillClassName[area.condition]
                      : active
                        ? "bg-brand-ink text-brand-accent"
                        : "bg-muted-foreground/15 text-muted-foreground group-hover:bg-brand-ink group-hover:text-brand-accent",
                  )}
                >
                  <AreaIcon icon={area.icon} className="size-3" />
                </BrandHexagon>
                {/* The Area's share of the board. Rides outside the hexagon —
                    clipPath would eat it. */}
                {open > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-0 right-0 min-w-3.5 rounded-full bg-background px-0.5 text-center text-2xs leading-3.5 font-semibold tabular-nums text-muted-foreground ring-1 ring-border"
                  >
                    {open}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "text-2xs leading-none font-semibold tabular-nums transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground/60 group-hover:text-muted-foreground",
                  )}
                >
                  {shortcut ?? ""}
                </span>
                <span className="sr-only">
                  {area.name}
                  {open > 0 ? `, ${open} open` : ""}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <span className="font-medium">{area.name}</span>
                <span className="opacity-80">
                  {conditionLabel(area.condition)}
                  {open > 0 ? ` · ${open} open` : ""}
                </span>
                {shortcut !== undefined && <Kbd>{shortcut}</Kbd>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
