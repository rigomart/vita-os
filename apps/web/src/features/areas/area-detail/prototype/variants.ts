// PROTOTYPE — throwaway code. Registry for the Area view design variants.
// Round 2: refining direction B ("Triage Lanes"). Round-1 variants A/C/D/E
// remain on disk (and in git history) as primary sources but are out of the
// switcher cycle.

import type { ComponentType } from "react";

import type { AreaVariantProps } from "./variant-props";

import { AreaVariantB } from "./variant-b";
import { AreaVariantB1 } from "./variant-b1";
import { AreaVariantB2 } from "./variant-b2";
import { AreaVariantB3 } from "./variant-b3";

export const VARIANT_COMPONENTS: Record<
  string,
  ComponentType<AreaVariantProps>
> = {
  b: AreaVariantB,
  b1: AreaVariantB1,
  b2: AreaVariantB2,
  b3: AreaVariantB3,
};

export const VARIANT_LABELS: Record<string, string> = {
  current: "Current design",
  b: "Triage Lanes (round 1)",
  b1: "Quiet Lanes",
  b2: "Hot Lane",
  b3: "Workbench",
};

export const VARIANT_KEYS = ["current", "b", "b1", "b2", "b3"];

export function normalizeVariantKey(raw: string | undefined): string {
  return raw !== undefined && raw in VARIANT_COMPONENTS ? raw : "current";
}
