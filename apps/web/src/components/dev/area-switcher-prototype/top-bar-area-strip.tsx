// PROTOTYPE — area quick-switcher variant A: persistent hexagon strip in the
// top bar with visible ⌘1..9 jumps. Throwaway; see use-area-switcher-variant.

import { api } from "@convex/_generated/api";
import { Link, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect } from "react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionDotClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

/** Slack-style direct jumps stop at 9 — the digit row is the whole point. */
const MAX_SHORTCUTS = 9;

export function TopBarAreaStrip() {
  const areas = useQuery(api.areas.list);
  const navigate = useNavigate();
  const areaRouteMatch = useMatch({
    from: "/_authenticated/$areaSlug",
    shouldThrow: false,
  });
  const activeSlug = areaRouteMatch?.params.areaSlug;

  // ⌘/Ctrl + 1..9 jumps to the Nth Area in the user's own order.
  useEffect(() => {
    if (areas === undefined) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key < "1" || e.key > "9") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const area = areas?.[Number(e.key) - 1];
      if (area === undefined) return;
      e.preventDefault();
      void navigate({ to: "/$areaSlug", params: { areaSlug: area.slug } });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [areas, navigate]);

  if (areas === undefined || areas.length === 0) return null;

  return (
    <nav
      aria-label="Life Areas"
      // Lives in the left 1fr cell beside the brand mark: min-w-0 + scroll keeps
      // a long Area list from shoving the centred search trigger off-centre.
      className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      <span aria-hidden className="mr-1 h-5 w-px shrink-0 bg-border" />
      {areas.map((area, index) => {
        const active = area.slug === activeSlug;
        const shortcut = index < MAX_SHORTCUTS ? index + 1 : undefined;
        const flagged = area.condition !== "healthy";
        return (
          <Link
            key={area._id}
            to="/$areaSlug"
            params={{ areaSlug: area.slug }}
            title={
              shortcut === undefined ? area.name : `${area.name} — ⌘${shortcut}`
            }
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 w-8 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md ring-ring outline-none transition-colors focus-visible:ring-2",
              active ? "bg-muted" : "hover:bg-muted/60",
            )}
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
                "text-[0.5625rem] leading-none font-semibold tabular-nums transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground/60 group-hover:text-muted-foreground",
              )}
            >
              {shortcut ?? ""}
            </span>
            <span className="sr-only">{area.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
