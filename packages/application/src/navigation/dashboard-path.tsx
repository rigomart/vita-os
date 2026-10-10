import type { ReactNode } from "react";

import { createContext, useContext } from "react";

const DashboardPathContext = createContext("/");

/**
 * Where the Dashboard is, for whatever below takes a person to it: choosing a
 * filter, `0..9`, the logo, or Dashboard in the palette. It is `/` unless a
 * host shows the Dashboard somewhere else, as the lab does inside a prototype.
 */
export function DashboardPathProvider({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return <DashboardPathContext value={path}>{children}</DashboardPathContext>;
}

/**
 * The Dashboard's path. Typed as the product's `/`, which it is everywhere
 * but under a host's `DashboardPathProvider`, so the router accepts it.
 */
export function useDashboardPath(): "/" {
  return useContext(DashboardPathContext) as "/";
}
