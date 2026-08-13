// PROTOTYPE(thread-view) — throwaway. Swaps the thread pane's content subtree
// for one of the UI variants when ?variant= is set. The production content is
// the "current" stop so variants are judged against the real thing.
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type { ReactNode } from "react";

import { useLocation } from "@tanstack/react-router";

import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantA } from "./variant-a";
import { VariantB } from "./variant-b";
import { VariantC } from "./variant-c";
import { VariantD } from "./variant-d";
import { VariantE } from "./variant-e";

export interface ThreadVariantProps {
  thread: ProjectedThread;
  area: ProjectedArea;
}

const VARIANTS: Record<
  string,
  { name: string; Component: (props: ThreadVariantProps) => ReactNode }
> = {
  a: { name: "Dossier", Component: VariantA },
  b: { name: "Command deck", Component: VariantB },
  c: { name: "Briefing band", Component: VariantC },
  d: { name: "Inspector", Component: VariantD },
  e: { name: "Journal dock", Component: VariantE },
};

const SWITCHER_STOPS = [
  { key: "current", name: "Production UI" },
  ...Object.entries(VARIANTS).map(([key, { name }]) => ({ key, name })),
];

export function ThreadViewPrototypeGate({
  thread,
  area,
  children,
}: ThreadVariantProps & { children: ReactNode }) {
  // useLocation, not useSearch — the pane also renders under bare test
  // routers where no route is matched, and match-based hooks throw there.
  const { variant } = useLocation({
    select: (location) => location.search,
  }) as {
    variant?: string;
  };

  if (import.meta.env.PROD) return children;

  const active = variant !== undefined ? VARIANTS[variant] : undefined;

  return (
    <>
      {active ? <active.Component thread={thread} area={area} /> : children}
      <PrototypeSwitcher variants={SWITCHER_STOPS} />
    </>
  );
}
