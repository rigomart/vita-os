import type { Doc } from "@convex/_generated/dataModel";
import { AttentionList } from "./attention-list";

interface AttentionItem {
  projectName: string;
  projectSlug: string;
  area?: Doc<"areas">;
  areaSlug: string;
  key: string;
}

interface AttentionSectionProps {
  items: AttentionItem[];
}

export function AttentionSection({ items }: AttentionSectionProps) {
  return <AttentionList items={items} />;
}
