import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { ShapeBoard } from "./board";
import { TimeMap } from "./map";
import { NearCards } from "./near-cards";
import { Piles } from "./piles";

/**
 * Whether the board's shape can be seen before it is read: how many things
 * are late, how many today, how much is ahead. The data, the filter, the
 * lines and their controls are the product's; only the layout changes.
 * Open "Busy" for strain and "Sample life" for a light day.
 */
export default definePrototype({
  title: "Dashboard shape",
  description:
    "Seeing the board's shape before reading it: a time treemap, cards for what is asking, or piles per span.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description: "As it ships: one graded list, No date beside it.",
      component: DashboardScreen,
    },
    {
      key: "map",
      name: "Time treemap",
      description:
        "The whole board on one screen: a region per span led by its count, a tile per item sized by how near it is.",
      component: () => <ShapeBoard Body={TimeMap} wide />,
    },
    {
      key: "cards",
      name: "Cards for what is asking",
      description:
        "The shipped list, but Late and Today are cards under a large count; the days after stay graded lines.",
      component: () => <ShapeBoard Body={NearCards} />,
    },
    {
      key: "piles",
      name: "Piles",
      description:
        "Untangle's glance: a pile per span side by side, a large count over the first card, fanned out on click.",
      component: () => <ShapeBoard Body={Piles} wide />,
    },
  ],
});
