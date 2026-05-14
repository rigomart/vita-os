interface AreaStandardCardProps {
  standard?: string;
}

export function AreaStandardCard({ standard }: AreaStandardCardProps) {
  if (!standard) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-5">
      <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Standard
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{standard}</p>
    </div>
  );
}
