import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronRight } from "lucide-react";

export function AttentionList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

export function AttentionCollapsed({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  return (
    <Collapsible className="mt-4">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        {/* Base UI marks an open trigger with `data-panel-open`, not a state. */}
        <ChevronRight className="size-3.5 transition-transform group-data-panel-open:rotate-90" />
        {title}
        <span className="tabular-nums opacity-60">{count}</span>
        <div className="ml-1 h-px flex-1 bg-border/40" />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function AttentionEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-surface-2 px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
