import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { ChevronRight } from "lucide-react";

export function AttentionList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
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
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
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
