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
import { conditionDotClassName } from "@/features/areas/condition-presentation";
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
 * Persistent Area switcher in the top bar (ADR 0011): one hexagon per Area in
 * the user's own order, each a one-click jump with a visible 1..9 digit and a
 * condition dot for Areas asking for attention. Desktop-only — the strip is
 * hidden below md, but the component stays mounted so the shortcuts follow
 * the same rule everywhere.
 */
export function TopBarAreaStrip() {
  const areas = useQuery(api.areas.list);
  const areaRouteMatch = useMatch({
    from: "/_authenticated/$areaSlug",
    shouldThrow: false,
  });
  const activeSlug = areaRouteMatch?.params.areaSlug;

  useAreaJumpShortcuts(areas);

  if (areas === undefined || areas.length === 0) return null;

  return (
    <TooltipProvider delay={200}>
      <nav
        aria-label="Life Areas"
        // Lives in the left 1fr cell beside the brand mark: min-w-0 + scroll
        // keeps a long Area list from shoving the centred search off-centre.
        className="hidden min-w-0 items-center gap-1 overflow-x-auto py-1 -my-1 md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span aria-hidden className="mr-1 h-5 w-px shrink-0 bg-border" />
        {areas.map((area, index) => {
          const active = area.slug === activeSlug;
          const shortcut = index < MAX_SHORTCUTS ? index + 1 : undefined;
          const flagged = area.condition !== "healthy";
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
                    active
                      ? "bg-brand-ink text-brand-gold"
                      : "bg-muted-foreground/15 text-muted-foreground group-hover:bg-brand-ink group-hover:text-brand-gold",
                  )}
                >
                  <AreaIcon icon={area.icon} className="size-3" />
                </BrandHexagon>
                {/* Condition rides outside the hexagon — clipPath would eat it. */}
                {flagged && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0.5 right-0.5 size-1.5 rounded-full ring-2 ring-background",
                      conditionDotClassName[area.condition],
                    )}
                  />
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
                <span className="sr-only">{area.name}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <span className="font-medium">{area.name}</span>
                <span className="flex items-center gap-1 opacity-80">
                  {/* The vivid dot fill reads on the dark tooltip; the text
                      tints are tuned for cream surfaces and would vanish. */}
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      conditionDotClassName[area.condition],
                    )}
                  />
                  {conditionLabel(area.condition)}
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
