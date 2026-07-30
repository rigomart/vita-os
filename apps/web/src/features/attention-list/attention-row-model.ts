import type { ReactNode } from "react";

export interface AttentionRowModel {
  actions?: ReactNode;
  area?: { icon?: unknown; name: string };
  detail?: string;
  detailKind?: "next-move" | "summary";
  done?: boolean;
  isSavingText?: boolean;
  linkTo?: { areaSlug: string; threadSlug: string };
  onSetWhen?: (when: number | undefined) => void;
  onToggleDone?: () => void;
  onUpdateText?: (text: string) => void;
  title: string;
  toggleBusy?: boolean;
  when?: number;
  whenBusy?: boolean;
}
