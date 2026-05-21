import { api } from "@convex/_generated/api";

import { useStableQuery } from "@/hooks/use-stable-query";

import { AreaStandardCard } from "./area-standard-card";

interface AreaStandardCardProps {
  areaSlug: string;
}

export function AreaStandardCardSection({ areaSlug }: AreaStandardCardProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const standard = area?.standard;

  if (!standard) return null;

  return <AreaStandardCard standard={standard} />;
}
