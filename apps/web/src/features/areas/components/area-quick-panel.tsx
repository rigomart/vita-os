import type { ReactElement, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import type { AreaActionTarget } from "@/features/areas/area-actions";

import { useAreaActions } from "@/features/areas/area-actions";

import { ConditionSegments } from "./condition-segments";

/** The Area a panel speaks for: an action target plus the words it shows. */
export interface QuickPanelArea extends AreaActionTarget {
  standard?: string;
}

/**
 * **Area Quick Panel** — the Area's own controls, brought to wherever the Area
 * is named instead of making the user go to the Area page for them.
 *
 * It holds exactly what you need to act without leaving: the Condition as a
 * segmented control that writes straight through, the Standard as a reminder
 * of what "healthy" was supposed to mean here, and capture scoped to this
 * Area. The title itself is the way through to the page — a trailing arrow
 * marks the jump — so everything else in the panel can stay an action.
 * Nothing here is editable but the Condition: the Standard is authored on the
 * Area page, and saying so is kinder than a second editor that disagrees with
 * the first.
 *
 * The host supplies the trigger element so the panel can hang off anything
 * that already draws an Area — a Plan lane header, a palette row — without the
 * panel dictating how that thing looks.
 */
export function AreaQuickPanel({
  area,
  children,
  onNewThread,
  trigger,
}: {
  area: QuickPanelArea;
  /** The trigger's contents. */
  children: ReactNode;
  onNewThread: (areaId: string) => void;
  /** The element the panel hangs off, rendered as the popover trigger. */
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const { actions, setCondition } = useAreaActions(area, { onNewThread });

  const newThread = actions.find((action) => action.kind === "new-thread")!;

  return (
    // `modal` so the panel holds the keyboard while it is open: tabbing runs
    // the panel's own controls rather than escaping into the canvas behind it.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[21rem] gap-0 overflow-hidden p-0"
      >
        <div className="flex flex-col divide-y divide-border">
          <header className="flex flex-col gap-2.5 px-4 pt-3 pb-3.5">
            <PopoverTitle className="min-w-0 truncate font-heading text-base leading-6 font-semibold tracking-tight">
              <Link
                to="/$areaSlug"
                params={{ areaSlug: area.slug }}
                onClick={() => setOpen(false)}
                className="group inline-flex max-w-full items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
              >
                <span className="truncate underline-offset-4 group-hover:underline">
                  {area.name}
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
                />
              </Link>
            </PopoverTitle>
            <ConditionSegments
              condition={area.condition}
              label={`Condition for ${area.name}`}
              onConditionChange={setCondition}
            />
          </header>

          <section className="flex flex-col gap-2 px-4 py-4">
            <h3 className="font-heading text-2xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Standard
            </h3>
            {area.standard ? (
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                {area.standard}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic">
                No Standard yet — write it on the Area page.
              </p>
            )}
          </section>

          <footer className="p-2">
            <Button
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 rounded-xl px-2.5 text-sm font-medium [&_svg]:text-muted-foreground"
              onClick={() => {
                // Close first: the dialog that opens next must inherit focus
                // from a panel that is already gone, not race it for the ring.
                setOpen(false);
                newThread.run();
              }}
            >
              <newThread.icon />
              <span className="truncate">{newThread.label}</span>
            </Button>
          </footer>
        </div>
      </PopoverContent>
    </Popover>
  );
}
