import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderBackLink {
  label: string;
  to: LinkProps["to"];
  // biome-ignore lint/suspicious/noExplicitAny: params type depends on route
  params?: any;
}

interface PageHeaderProps {
  title: string;
  backLink?: PageHeaderBackLink;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  backLink,
  description,
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
        <h1 className="text-2xl font-bold">{title}</h1>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
