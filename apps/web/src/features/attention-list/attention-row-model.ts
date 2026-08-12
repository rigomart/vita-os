import type { AreaIcon } from "@convex/lib/areaIcons";
import type { ReactNode } from "react";

export interface AttentionRowModel {
  actions?: ReactNode;
  area?: { icon: AreaIcon; name: string };
  detail?: string;
  detailKind?: "next-move" | "summary";
  done?: boolean;
  isSavingText?: boolean;
  linkTo?: { threadSlug: string };
  onSetWhen?: (when: number | undefined) => void;
  onToggleDone?: () => void;
  onUpdateText?: (text: string) => void;
  title: string;
  toggleBusy?: boolean;
  when?: number;
  whenBusy?: boolean;
}
