import type { ReactNode } from "react";

interface GroupProps {
  children: ReactNode;
  title: string;
}

export function Group({ children, title }: GroupProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

interface ExampleProps {
  children: ReactNode;
  label: string;
}

export function Example({ children, label }: ExampleProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
