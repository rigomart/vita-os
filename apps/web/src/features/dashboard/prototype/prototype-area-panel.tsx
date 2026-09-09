/**
 * PROTOTYPE — issue #314, round 6. The Area Quick Panel, stubbed.
 *
 * Same shape as the production `AreaQuickPanel` — title through to the Area
 * page, Condition as a segmented control, the Standard when there is one,
 * capture scoped to this Area — but the two writes are stubbed: Condition
 * changes land in the prototype's local state (so the header visibly
 * re-sorts), and New Thread does nothing but say so. The fixture's Area ids
 * are not real, and a prototype has no business writing.
 */
import type { Condition } from "@convex/lib/condition";
import type { ReactElement, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { ArrowUpRight, Plus } from "lucide-react";
import { useState } from "react";

import { ConditionSegments } from "@/features/areas/components/condition-segments";

import type { DashboardArea } from "../components/dashboard-model";

export function PrototypeAreaPanel({
  area,
  children,
  onConditionChange,
  trigger,
}: {
  area: DashboardArea;
  children: ReactNode;
  onConditionChange: (areaId: string, condition: Condition) => void;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[21rem] gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-col divide-y divide-border">
          <header className="flex flex-col gap-2.5 px-4 pb-3.5 pt-3">
            <PopoverTitle className="min-w-0 truncate font-heading text-base font-semibold leading-6 tracking-tight">
              <Link
                to="/$areaSlug"
                params={{ areaSlug: area.slug }}
                onClick={() => setOpen(false)}
                className="group inline-flex max-w-full items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate underline-offset-4 group-hover:underline">
                  {area.name}
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              </Link>
            </PopoverTitle>
            <ConditionSegments
              condition={area.condition}
              label={`Condition for ${area.name}`}
              onConditionChange={(condition) =>
                onConditionChange(area.id, condition)
              }
            />
          </header>

          {area.standard?.trim() && (
            <section className="flex flex-col gap-2 px-4 py-4">
              <h3 className="font-heading text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Standard
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {area.standard}
              </p>
            </section>
          )}

          <footer className="p-2">
            <span className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-muted-foreground">
              <Plus className="size-4" />
              New Thread
              <span className="ml-auto text-2xs">stubbed</span>
            </span>
          </footer>
        </div>
      </PopoverContent>
    </Popover>
  );
}
