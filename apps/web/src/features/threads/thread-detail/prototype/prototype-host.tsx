/**
 * PROTOTYPE (issue #280) — "Three variants of the thread detail view with Up
 * Next, switchable via `?variant=` on the existing thread pane." Mock data
 * only; nothing here touches Convex. Remove this directory (plus the
 * `variant` search param and the ThreadDetailView bypass) when done.
 */
import type { PrototypeVariant } from "@/routes/_authenticated/route";

import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantA } from "./variant-a";
import { VariantB } from "./variant-b";
import { VariantC } from "./variant-c";
import { VariantD } from "./variant-d";
import { VariantE } from "./variant-e";

export function ThreadViewPrototype({
  variant,
}: {
  variant: PrototypeVariant;
}) {
  return (
    <>
      {variant === "a" && <VariantA />}
      {variant === "b" && <VariantB />}
      {variant === "c" && <VariantC />}
      {variant === "d" && <VariantD />}
      {variant === "e" && <VariantE />}
      <PrototypeSwitcher current={variant} />
    </>
  );
}
