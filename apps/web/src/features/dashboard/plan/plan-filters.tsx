import { cn } from "@vita-os/ui/lib/utils";

import type { DashboardArea } from "@/features/dashboard/components/dashboard-model";

import { AreaIcon } from "@/features/areas/components/area-icon";

/**
 * Area filter chips.
 *
 * `null` means "everything", which is not the same as a set containing every
 * Area: the first click on a chip **isolates** that Area (the common intent),
 * and further clicks add or remove. Emptying the selection falls back to all.
 *
 * Filtering here also reshapes the axis — days only the hidden Areas occupied
 * collapse back to ticks.
 */
export function AreaFilterChips({
  active,
  areas,
  counts,
  onChange,
}: {
  active: ReadonlySet<string> | null;
  areas: DashboardArea[];
  counts: ReadonlyMap<string, number>;
  onChange: (next: ReadonlySet<string> | null) => void;
}) {
  const needsMe = areas.filter((area) => area.condition !== "healthy");
  const needsMeActive =
    active != null &&
    needsMe.length > 0 &&
    active.size === needsMe.length &&
    needsMe.every((area) => active.has(area.id));

  function toggle(areaId: string) {
    if (active == null) {
      onChange(new Set([areaId]));
      return;
    }
    const next = new Set(active);
    if (next.has(areaId)) next.delete(areaId);
    else next.add(areaId);

    if (next.size === 0 || next.size === areas.length) onChange(null);
    else onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip
        active={active == null}
        label="All Areas"
        onClick={() => onChange(null)}
      />
      {needsMe.length > 0 && (
        <FilterChip
          active={needsMeActive}
          label="Needs me"
          onClick={() =>
            onChange(needsMeActive ? null : new Set(needsMe.map((a) => a.id)))
          }
        />
      )}

      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />

      {areas.map((area) => {
        const on = active == null || active.has(area.id);
        return (
          <button
            key={area.id}
            type="button"
            aria-pressed={active != null && active.has(area.id)}
            onClick={() => toggle(area.id)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors",
              on
                ? "bg-surface-2 text-foreground ring-border hover:bg-surface-3"
                : "bg-transparent text-muted-foreground/45 ring-border/40 hover:text-muted-foreground",
            )}
          >
            <AreaIcon
              icon={area.icon}
              className={cn("size-3", !on && "opacity-50")}
            />
            <span>{area.name}</span>
            <span
              className={cn(
                "tabular-nums",
                on ? "text-muted-foreground" : "text-muted-foreground/40",
              )}
            >
              {counts.get(area.id) ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-surface-1"
          : "bg-surface-3 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
