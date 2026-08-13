// PROTOTYPE — throwaway code. Registry for the Area view design variants.
// Round 3: converged on B3 (workbench drawers) + B1's census line, no gold
// top rule. Earlier variants remain on disk (and in git history) as primary
// sources but are out of the switcher cycle.

import type { ComponentType } from "react";

import type { AreaVariantProps } from "./variant-props";

import { AreaVariantB3 } from "./variant-b3";
import { AreaVariantB4 } from "./variant-b4";

export const VARIANT_COMPONENTS: Record<
  string,
  ComponentType<AreaVariantProps>
> = {
  b3: AreaVariantB3,
  b4: AreaVariantB4,
};

export const VARIANT_LABELS: Record<string, string> = {
  current: "Current design",
  b3: "Workbench (round 2)",
  b4: "Converged",
};

export const VARIANT_KEYS = ["current", "b3", "b4"];

export function normalizeVariantKey(raw: string | undefined): string {
  return raw !== undefined && raw in VARIANT_COMPONENTS ? raw : "current";
}
