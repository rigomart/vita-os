import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  titleLeading?: ReactNode;
  titleAccessory?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  titleLeading,
  titleAccessory,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1">
          {titleLeading}
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {titleAccessory}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
