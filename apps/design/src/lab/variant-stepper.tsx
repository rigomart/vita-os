import { useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

import type { Prototype } from "./prototype";

/**
 * Step through a prototype's variants, in the lab toolbar: the one showing,
 * and the way to the previous and next.
 */
export function VariantStepper({
  id,
  prototype,
  active,
}: {
  id: string;
  prototype: Prototype;
  active: string;
}) {
  const navigate = useNavigate();
  const { variants } = prototype;
  const index = variants.findIndex((variant) => variant.key === active);
  const current = variants[index]!;

  const step = (by: number) => {
    const next = variants[(index + by + variants.length) % variants.length]!;
    void navigate({
      to: "/lab/$prototypeId",
      params: { prototypeId: id },
      search: (previous) => ({ ...previous, variant: next.key }),
    });
  };

  // `[` and `]` step, unless someone is typing; digits are the app's own.
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "[" && event.key !== "]") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      stepRef.current(event.key === "]" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="Previous variant ([)"
        onClick={() => step(-1)}
      >
        <ChevronLeft />
      </Button>
      <div
        className="flex min-w-36 flex-col items-center px-2 text-center"
        title={current.description}
      >
        <span className="text-[13px] leading-tight font-medium">
          {current.name}
        </span>
        <span className="text-[11px] leading-tight text-muted-foreground">
          {index + 1} of {variants.length}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="Next variant (])"
        onClick={() => step(1)}
      >
        <ChevronRight />
      </Button>
    </>
  );
}
