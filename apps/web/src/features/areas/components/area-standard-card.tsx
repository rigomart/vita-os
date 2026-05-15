import { api } from "@convex/_generated/api";
import { useStableQuery } from "@/hooks/use-stable-query";

interface AreaStandardCardProps {
  areaSlug: string;
}

export function AreaStandardCard({ areaSlug }: AreaStandardCardProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const standard = area?.standard;

  if (!standard) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-5">
      <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Standard
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{standard}</p>
    </div>
  );
}
