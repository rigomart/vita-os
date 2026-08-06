import type { CSSProperties } from "react";

export interface TokenEntry {
  name: string;
  light?: string;
  dark?: string;
}

export type TokenGroup =
  | "Brand"
  | "Surfaces"
  | "Semantic"
  | "Condition"
  | "Charts"
  | "Sidebar"
  | "Other";

export const TOKEN_GROUP_ORDER: TokenGroup[] = [
  "Brand",
  "Surfaces",
  "Semantic",
  "Condition",
  "Charts",
  "Sidebar",
  "Other",
];

export type VarStyle = CSSProperties & Record<`--${string}`, string>;

const SEMANTIC_KEYS = new Set([
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
]);

function collectFromRules(
  rules: CSSRuleList,
  target: Map<string, { light?: string; dark?: string }>,
) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const selector = rule.selectorText.trim();
      if (selector !== ":root" && selector !== ".dark") continue;
      const { style } = rule;
      for (let i = 0; i < style.length; i++) {
        const prop = style.item(i);
        if (!prop.startsWith("--") || prop.startsWith("--tw-")) continue;
        const value = style.getPropertyValue(prop).trim();
        const entry = target.get(prop) ?? {};
        if (selector === ":root") entry.light = value;
        else entry.dark = value;
        target.set(prop, entry);
      }
    } else if (rule instanceof CSSGroupingRule) {
      collectFromRules(rule.cssRules, target);
    }
  }
}

/**
 * Walks every loaded stylesheet and collects custom properties declared on
 * `:root` (light) and `.dark` (dark), recursing into layer/media blocks.
 */
export function collectTokens(): TokenEntry[] {
  const collected = new Map<string, { light?: string; dark?: string }>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    collectFromRules(rules, collected);
  }
  return Array.from(collected.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Buckets a token by name; returns null for radius/font tokens, which have their own sections. */
export function groupToken(name: string): TokenGroup | null {
  const key = name.replace(/^--/, "");
  if (
    key === "radius" ||
    key.startsWith("radius-") ||
    key.startsWith("font-")
  ) {
    return null;
  }
  if (key.startsWith("brand-")) return "Brand";
  if (key.startsWith("surface-")) return "Surfaces";
  if (key.startsWith("condition-")) return "Condition";
  if (key.startsWith("chart-")) return "Charts";
  if (key.startsWith("sidebar")) return "Sidebar";
  if (SEMANTIC_KEYS.has(key)) return "Semantic";
  return "Other";
}

/**
 * Inlines every token's declared value as a CSS custom property so a wrapper
 * renders correctly for a given mode regardless of the ambient `.dark` class
 * on `<html>` (the global theme toggle). Chained `var(--x)` references
 * resolve locally since every referenced token is set on the same element.
 */
export function tokenStyleVars(
  tokens: TokenEntry[],
  mode: "light" | "dark",
): VarStyle {
  const style: Record<string, string> = {};
  for (const token of tokens) {
    const value = mode === "dark" ? (token.dark ?? token.light) : token.light;
    if (value) style[token.name] = value;
  }
  return style as VarStyle;
}
