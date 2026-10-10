import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { FlaskConical, GripVertical, RotateCcw } from "lucide-react";
import { useState } from "react";

import { latencies, type Latency, useLab } from "./lab-application";
import { findVariant } from "./prototype";
import { readPrototypeSearch } from "./prototype-stage";
import { findPrototype, prototypes } from "./prototypes";
import { scenarios } from "./scenarios";
import { useSnappedPlacement } from "./use-snapped-placement";
import { VariantStepper } from "./variant-stepper";

/**
 * The lab's controls, in one pill floating over whatever is showing. The
 * flask opens the settings: which scenario the data comes from, how slow the
 * pretend network is, what time it is, and the way back to the lab's pages.
 * On a prototype with variants, the pill also steps through them. Drag it
 * by its grip or its label to another corner or edge.
 */
export function LabToolbar() {
  const lab = useLab();
  const search = useRouterState({
    select: (state) =>
      readPrototypeSearch(state.location.search as Record<string, unknown>),
    structuralSharing: true,
  });
  const prototypeId = useRouterState({
    select: (state) =>
      (
        state.matches.find((match) => match.routeId === "/lab/$prototypeId")
          ?.params as { prototypeId?: string } | undefined
      )?.prototypeId,
  });
  const entry =
    prototypeId === undefined ? undefined : findPrototype(prototypeId);
  const [open, setOpen] = useState(false);
  const placement = useSnappedPlacement("vita-os:lab:toolbar", "bottom-right");
  // A compare frame shows the variant alone.
  if (search.embed) return null;

  // Picking a destination closes the controls, even when it is this page.
  const close = () => setOpen(false);
  // The settings open away from the edge the pill rests on.
  const [edge, along] = placement.point.split("-");

  return (
    <div
      ref={placement.ref}
      role="toolbar"
      aria-label="Lab"
      {...placement.handlers}
      style={placement.style}
      className={cn(
        "fixed z-50 flex touch-none items-center gap-1 rounded-full border bg-popover/95 p-1 shadow-lg backdrop-blur select-none",
        placement.dragging
          ? "cursor-grabbing shadow-2xl"
          : "cursor-grab transition-[left,top] duration-200 ease-out",
      )}
    >
      <GripVertical
        aria-hidden
        className="-mr-1 ml-0.5 size-3.5 text-muted-foreground"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Lab controls"
              className="rounded-full"
            />
          }
        >
          <FlaskConical />
        </PopoverTrigger>
        <PopoverContent
          side={edge === "top" ? "bottom" : "top"}
          align={
            along === "left" ? "start" : along === "right" ? "end" : "center"
          }
          sideOffset={8}
          className="w-72 gap-4"
        >
          <PopoverTitle>Lab</PopoverTitle>

          <Choice label="Scenario">
            {scenarios.map((scenario) => (
              <Option
                key={scenario.id}
                active={lab.scenarioId === scenario.id}
                onClick={() => lab.change({ scenarioId: scenario.id })}
              >
                {scenario.name}
              </Option>
            ))}
          </Choice>

          <Choice label="Latency">
            {(Object.keys(latencies) as Latency[]).map((latency) => (
              <Option
                key={latency}
                active={lab.latency === latency}
                onClick={() => lab.change({ latency })}
              >
                {latency}
              </Option>
            ))}
          </Choice>

          <Choice label="Clock">
            <Input
              type="datetime-local"
              aria-label="Date and time"
              value={lab.at === undefined ? "" : toLocalInput(lab.at)}
              onChange={(event) =>
                lab.change({
                  at:
                    event.target.value === ""
                      ? undefined
                      : new Date(event.target.value).getTime(),
                })
              }
              className="w-auto flex-1"
            />
            <Option
              active={lab.at === undefined}
              onClick={() => lab.change({ at: undefined })}
            >
              Real time
            </Option>
          </Choice>

          <Button variant="outline" size="sm" onClick={lab.reset}>
            <RotateCcw />
            Reset data
          </Button>

          {prototypes.length > 0 && (
            <Choice label="Prototypes">
              <nav className="flex w-full flex-col">
                {prototypes.map(({ id, prototype }) => (
                  <Link
                    key={id}
                    to="/lab/$prototypeId"
                    params={{ prototypeId: id }}
                    onClick={close}
                    className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
                  >
                    {prototype.title}
                    {prototype.variants.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {prototype.variants.length} variants
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </Choice>
          )}

          <nav className="flex gap-3 text-sm">
            <Link to="/" onClick={close} className="hover:underline">
              App
            </Link>
            <Link to="/lab" onClick={close} className="hover:underline">
              Lab
            </Link>
            <Link to="/lab/system" onClick={close} className="hover:underline">
              Design system
            </Link>
          </nav>
        </PopoverContent>
      </Popover>
      {entry !== undefined && entry.prototype.variants.length > 1 && (
        <>
          <span aria-hidden className="h-6 w-px bg-border" />
          <VariantStepper
            id={entry.id}
            prototype={entry.prototype}
            active={findVariant(entry.prototype, search.variant).key}
          />
        </>
      )}
    </div>
  );
}

/** `at` as a `datetime-local` input holds it: local time, to the minute. */
function toLocalInput(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Choice({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
      className={cn("capitalize", !active && "text-muted-foreground")}
    >
      {children}
    </Button>
  );
}
