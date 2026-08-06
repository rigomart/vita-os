import type { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  description?: string;
  id: string;
  title: string;
}

export function Section({ children, description, id, title }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-20 space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
