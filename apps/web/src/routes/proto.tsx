import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { FlaskConical } from "lucide-react";

import { NOW } from "@/features/plan-prototypes/mock-data";
import { findPrototype, prototypes } from "@/features/plan-prototypes/registry";

interface ProtoSearch {
  p?: string;
}

/**
 * Plan view design-exploration gallery.
 *
 * Deliberately outside `_authenticated`: no sign-in, no Convex hooks, no
 * AppShell. Everything renders from `@/features/plan-prototypes/mock-data`.
 */
export const Route = createFileRoute("/proto")({
  head: () => ({
    meta: [{ title: "Plan prototypes | Vita OS" }],
  }),
  validateSearch: (search: Record<string, unknown>): ProtoSearch => ({
    p:
      typeof search.p === "string" && search.p.length > 0
        ? search.p
        : undefined,
  }),
  component: PrototypeGallery,
});

function PrototypeGallery() {
  const { p } = Route.useSearch();
  const selected = findPrototype(p);
  const Prototype = selected.component;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Plan prototypes
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Shared mock data · today is {format(new Date(NOW), "EEEE, MMMM d")}
        </p>
      </header>

      <nav
        aria-label="Prototypes"
        className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {prototypes.map((prototype) => {
          const isActive = prototype.key === selected.key;

          return (
            <Link
              key={prototype.key}
              to="/proto"
              search={{ p: prototype.key }}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isActive
                  ? "border-primary/60 bg-accent/60"
                  : "hover:bg-muted/50",
              )}
            >
              <span className="text-sm font-semibold">{prototype.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {prototype.blurb}
              </span>
            </Link>
          );
        })}
      </nav>

      <main className="mt-6 rounded-xl border p-4 md:p-6">
        <Prototype />
      </main>
    </div>
  );
}
