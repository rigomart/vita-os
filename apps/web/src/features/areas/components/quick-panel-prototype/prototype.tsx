// PROTOTYPE — throwaway code. Answers one question: what should the Area
// Quick Panel's contents look like? Four variants of the panel body render
// inside the real popover on the live Dashboard, switchable via `?variant=`
// (see the floating PrototypeSwitcher). Delete this directory once a
// direction wins.
import type { Condition } from "@convex/lib/condition";
import type { ReactElement } from "react";

import { useSearch } from "@tanstack/react-router";

import type { QuickPanelArea } from "../area-quick-panel";

import { VariantA, VariantA2, VariantA3 } from "./variants-ab";

export interface PanelVariantProps {
  area: QuickPanelArea;
  /** Writes the Condition through immediately (optimistic). */
  setCondition: (condition: Condition) => void;
  /** Closes the panel, then opens the create-Thread dialog scoped to the Area. */
  onNewThread: () => void;
  /** Close the panel (call from the open-Area link's onClick). */
  onClose: () => void;
}

export interface PanelVariant {
  /** `?variant=` value. */
  key: string;
  /** Shown in the switcher bar. */
  name: string;
  /** Replaces the PopoverContent className (width/padding/gap are yours). */
  contentClassName: string;
  Component: (props: PanelVariantProps) => ReactElement;
}

// Neutral shell: each variant's root element owns its own width, padding,
// and vertical rhythm, so the two variant files never fight over this one.
const NEUTRAL_SHELL = "w-auto gap-0 overflow-hidden p-0";

export const PANEL_VARIANTS: PanelVariant[] = [
  {
    key: "a",
    name: "A — Refined card",
    contentClassName: NEUTRAL_SHELL,
    Component: VariantA,
  },
  {
    key: "a2",
    name: "A2 — Header segments",
    contentClassName: NEUTRAL_SHELL,
    Component: VariantA2,
  },
  {
    key: "a3",
    name: "A3 — Segment strip",
    contentClassName: NEUTRAL_SHELL,
    Component: VariantA3,
  },
];

/** The variant picked by `?variant=`, or undefined for the shipped design. */
export function usePanelVariantPrototype(): PanelVariant | undefined {
  let search: { variant?: string } = {};
  try {
    search = useSearch({ strict: false }) as { variant?: string };
  } catch {
    // Outside a routed tree (component tests) there is never a variant.
  }
  if (!import.meta.env.DEV || import.meta.env.TEST) return undefined;
  return PANEL_VARIANTS.find((variant) => variant.key === search.variant);
}
