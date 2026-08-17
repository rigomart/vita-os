import type { ReactElement, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import type { AreaActionTarget } from "@/features/areas/area-actions";

import { useAreaActions } from "@/features/areas/area-actions";

import { AreaConditionSelect } from "./area-condition-select";
// PROTOTYPE — remove with the quick-panel-prototype directory.
import { usePanelVariantPrototype } from "./quick-panel-prototype/prototype";

/** The Area a panel speaks for: an action target plus the words it shows. */
export interface QuickPanelArea extends AreaActionTarget {
  standard?: string;
}

/**
 * **Area Quick Panel** — the Area's own controls, brought to wherever the Area
 * is named instead of making the user go to the Area page for them.
 *
 * It holds exactly what you need to act without leaving: the Condition pill
 * that writes straight through, the Standard as a reminder of what "healthy"
 * was supposed to mean here, capture scoped to this Area, and the way through
 * to the page for everything else. Nothing here is editable but the Condition
 * — the Standard is authored on the Area page, and saying so is kinder than a
 * second editor that disagrees with the first.
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
  const openArea = actions.find((action) => action.kind === "open-area")!;

  // PROTOTYPE — `?variant=` swaps the panel body for a design candidate.
  const variant = usePanelVariantPrototype();
  if (variant) {
    return (
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
        <PopoverContent align="start" className={variant.contentClassName}>
          <variant.Component
            area={area}
            setCondition={setCondition}
            onNewThread={() => {
              setOpen(false);
              newThread.run();
            }}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    // `modal` so the panel holds the keyboard while it is open: tabbing runs
    // the panel's own controls rather than escaping into the canvas behind it.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <PopoverTitle className="font-heading text-sm font-semibold tracking-tight">
            {area.name}
          </PopoverTitle>
          <AreaConditionSelect
            condition={area.condition}
            label={`Condition for ${area.name}`}
            onConditionChange={setCondition}
          />
        </div>

        <div>
          <p className="text-2xs font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
            Standard
          </p>
          {area.standard ? (
            <p className="mt-1 text-sm whitespace-pre-line text-foreground/85">
              {area.standard}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground/60">
              No Standard yet — write it on the Area page.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="justify-start"
            onClick={() => {
              // Close first: the dialog that opens next must inherit focus
              // from a panel that is already gone, not race it for the ring.
              setOpen(false);
              newThread.run();
            }}
          >
            <newThread.icon />
            {newThread.label}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            render={
              <Link
                to="/$areaSlug"
                params={{ areaSlug: area.slug }}
                onClick={() => setOpen(false)}
              />
            }
          >
            <ArrowRight />
            {openArea.label}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
