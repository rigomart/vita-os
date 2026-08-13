// PROTOTYPE — throwaway code. Registry for the Area view design variants.
// Plan: five variants of the Area view, switchable via `?variant=`, mounted
// on the existing `/$areaSlug` route ("current" = the existing design).

import type { ComponentType } from "react";

import type { AreaVariantProps } from "./variant-props";

import { AreaVariantA } from "./variant-a";
import { AreaVariantB } from "./variant-b";
import { AreaVariantC } from "./variant-c";
import { AreaVariantD } from "./variant-d";
import { AreaVariantE } from "./variant-e";

export const VARIANT_COMPONENTS: Record<
  string,
  ComponentType<AreaVariantProps>
> = {
  a: AreaVariantA,
  b: AreaVariantB,
  c: AreaVariantC,
  d: AreaVariantD,
  e: AreaVariantE,
};

export const VARIANT_LABELS: Record<string, string> = {
  current: "Current design",
  a: "The Ledger",
  b: "Triage Lanes",
  c: "Cockpit",
  d: "Focus Stack",
  e: "Mosaic",
};

export const VARIANT_KEYS = ["current", "a", "b", "c", "d", "e"];

export function normalizeVariantKey(raw: string | undefined): string {
  return raw !== undefined && raw in VARIANT_COMPONENTS ? raw : "current";
}
