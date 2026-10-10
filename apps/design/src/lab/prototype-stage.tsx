import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

import { findVariant, type Prototype } from "./prototype";

/** What a prototype page reads from its address. */
export interface PrototypeSearch {
  variant?: string;
  /** Set on the frames of the compare view: the variant alone, no lab chrome. */
  embed?: boolean;
}

export function readPrototypeSearch(
  search: Record<string, unknown>,
): PrototypeSearch {
  return {
    ...(typeof search.variant === "string" ? { variant: search.variant } : {}),
    ...(search.embed === true || search.embed === 1 || search.embed === "1"
      ? { embed: true }
      : {}),
  };
}

/**
 * One prototype, showing one of its variants; the lab toolbar steps through
 * the others. Stepping keeps the scenario's data, so every direction is seen
 * against the same situation, including whatever was changed in the last one.
 */
export function PrototypeStage({
  prototype,
  search,
}: {
  prototype: Prototype;
  search: PrototypeSearch;
}) {
  const variant = findVariant(prototype, search.variant);
  const Component = variant.component;
  return <Component key={variant.key} />;
}

const devices = {
  desktop: { label: "Desktop", width: 1440, height: 900 },
  mobile: { label: "Mobile", width: 390, height: 844 },
} as const;
type Device = keyof typeof devices;

/**
 * Every variant at once, each in its own frame at a real device width and
 * scaled down to fit, so layouts respond as they would on that device.
 *
 * Each frame is its own copy of the lab, seeded from the same scenario: good
 * for looking, but a change in one frame stays in that frame. Open a variant
 * to work in it.
 */
export function CompareVariants({
  id,
  prototype,
}: {
  id: string;
  prototype: Prototype;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const { width, height } = devices[device];
  const path = `/lab/${id}`;

  return (
    <main className="flex min-h-svh flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <Link
            to="/lab"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Lab
          </Link>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            {prototype.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {prototype.description}
          </p>
        </div>
        <div className="flex gap-1">
          {(Object.keys(devices) as Device[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={device === key ? "default" : "ghost"}
              aria-pressed={device === key}
              onClick={() => setDevice(key)}
            >
              {devices[key].label}
            </Button>
          ))}
        </div>
      </header>

      <div
        className={cn(
          "grid gap-6",
          device === "desktop"
            ? "grid-cols-1 xl:grid-cols-2"
            : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
        )}
      >
        {prototype.variants.map((variant) => (
          <section key={variant.key} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-medium">{variant.name}</h2>
              <Link
                to={path}
                search={{ variant: variant.key }}
                className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Open
              </Link>
            </div>
            <p
              className="line-clamp-1 min-h-5 text-sm text-muted-foreground"
              title={variant.description}
            >
              {variant.description}
            </p>
            <ScaledFrame
              title={variant.name}
              src={`${path}?variant=${encodeURIComponent(variant.key)}&embed=1`}
              width={width}
              height={height}
            />
          </section>
        ))}
      </div>
    </main>
  );
}

/** A frame at `width` × `height` CSS pixels, shrunk to the column it sits in. */
function ScaledFrame({
  title,
  src,
  width,
  height,
}: {
  title: string;
  src: string;
  width: number;
  height: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry!.contentRect.width / width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={container}
      className="overflow-hidden rounded-xl border bg-background"
      style={{ height: height * scale }}
    >
      {scale > 0 && (
        <iframe
          title={title}
          src={src}
          width={width}
          height={height}
          className="origin-top-left border-0"
          style={{ transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
