// PROTOTYPE — area quick-switcher variant B: slim full-height icon rail on the
// left edge. Throwaway; see use-area-switcher-variant.

import type { ProjectedArea } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { Link, useLocation, useMatch } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { LayoutDashboard } from "lucide-react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionDotClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

const slotClassName =
  "group relative flex h-11 w-full items-center justify-center";

const linkClassName =
  "relative flex size-10 items-center justify-center rounded-xl ring-ring outline-none transition-colors focus-visible:ring-2";

/** Discord-style left edge marker: tall pill when active, nub on hover. */
function ActiveMarker({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-0 w-1 rounded-r-full bg-foreground transition-all",
        active
          ? "h-6 opacity-100"
          : "h-2 opacity-0 group-hover:opacity-40 group-focus-within:opacity-40",
      )}
    />
  );
}

function AreaRailItem({
  area,
  active,
}: {
  area: ProjectedArea;
  active: boolean;
}) {
  const attention = area.condition !== "healthy";

  return (
    <li className={slotClassName}>
      <ActiveMarker active={active} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              to="/$areaSlug"
              params={{ areaSlug: area.slug }}
              aria-label={area.name}
              aria-current={active ? "page" : undefined}
              className={cn(
                linkClassName,
                active ? "bg-muted" : "hover:bg-muted/60",
              )}
            />
          }
        >
          <BrandHexagon
            className={cn(
              "size-8 transition-colors",
              active
                ? "bg-brand-ink text-brand-gold"
                : "bg-muted-foreground/15 text-muted-foreground group-hover:bg-brand-ink group-hover:text-brand-gold",
            )}
          >
            <AreaIcon icon={area.icon} className="size-4" />
          </BrandHexagon>
          {attention && (
            <span
              aria-hidden
              className={cn(
                "absolute top-0.5 right-0.5 size-2 rounded-full ring-2 ring-background",
                conditionDotClassName[area.condition],
              )}
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>
          {area.name}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

export function AreaIconRail() {
  const areas = useQuery(api.areas.list, {});
  const { pathname } = useLocation();
  const areaMatch = useMatch({
    from: "/_authenticated/$areaSlug",
    shouldThrow: false,
  });
  const activeSlug = areaMatch?.params.areaSlug;
  const dashboardActive = pathname === "/";

  return (
    <TooltipProvider delay={200}>
      <nav
        aria-label="Areas"
        className="sticky top-0 z-20 hidden h-svh w-14 shrink-0 flex-col items-center border-r bg-background py-2 md:flex"
      >
        <ul className="flex w-full shrink-0 flex-col items-center">
          <li className={slotClassName}>
            <ActiveMarker active={dashboardActive} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    to="/"
                    aria-label="Dashboard"
                    aria-current={dashboardActive ? "page" : undefined}
                    className={cn(
                      linkClassName,
                      dashboardActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  />
                }
              >
                <LayoutDashboard className="size-5" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                Dashboard
              </TooltipContent>
            </Tooltip>
          </li>
        </ul>

        <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-border" />

        {/* An undefined list renders no items; the rail keeps its width either
            way, so nothing shifts when the areas arrive. */}
        <ul className="flex w-full min-h-0 flex-1 flex-col items-center overflow-y-auto">
          {(areas ?? []).map((area) => (
            <AreaRailItem
              key={area._id}
              area={area}
              active={area.slug === activeSlug}
            />
          ))}
        </ul>
      </nav>
    </TooltipProvider>
  );
}
