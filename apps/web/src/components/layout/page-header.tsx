import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderBackLink {
  label: string;
  to: LinkProps["to"];
  params?: LinkProps["params"];
}

interface PageHeaderProps {
  title: string;
  backLink?: PageHeaderBackLink;
  description?: string;
  titleAccessory?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  backLink,
  description,
  titleAccessory,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {backLink && (
        <Link
          to={backLink.to}
          params={backLink.params}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {backLink.label}
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
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
