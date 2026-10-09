import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";

import { latencies, type Latency, useLab } from "./lab-application";
import { readPrototypeSearch } from "./prototype-stage";
import { prototypes } from "./prototypes";
import { scenarios } from "./scenarios";

/**
 * The lab's controls, floating over whatever is showing: which scenario the
 * data comes from, how slow the pretend network is, and the way back to the
 * lab's pages.
 */
export function LabToolbar() {
  const lab = useLab();
  // A compare frame shows the variant alone.
  const embedded = useRouterState({
    select: (state) =>
      readPrototypeSearch(state.location.search as Record<string, unknown>)
        .embed,
  });
  const [open, setOpen] = useState(false);
  if (embedded) return null;

  // Picking a destination closes the controls, even when it is this page.
  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Lab controls"
            className="fixed bottom-4 left-4 z-50 rounded-full shadow-md"
          />
        }
      >
        <FlaskConical />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 gap-4">
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
  );
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
