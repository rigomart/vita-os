import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { ShapeBoard } from "./board";
import { Desk } from "./desk";
import { TimeMap } from "./map";
import { Mosaic } from "./mosaic";
import { NearCards } from "./near-cards";
import { Piles } from "./piles";
import { Skyline } from "./skyline";
import { ZoomCards } from "./zoom-cards";

/**
 * Whether the board's shape can be seen before it is read: how many things
 * are late, how many today, how much is ahead. The data, the filter, the
 * lines and their controls are the product's; only the layout changes.
 * Open "Busy" for strain and "Sample life" for a light day.
 */
export default definePrototype({
  title: "Dashboard shape",
  description:
    "Seeing the board's shape before reading it: treemaps, cards, piles, a desk, a mosaic or a skyline.",
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
    {
      key: "zoom-cards",
      name: "Cards all the way down",
      description:
        "The shipped list, headings, Later fold and No date, with every item a card, two to a row, and each heading counted.",
      component: () => <ShapeBoard Body={ZoomCards} />,
    },
    {
      key: "desk",
      name: "Desk and margin",
      description:
        "Most of the page is a desk holding only Late and Today as large cards; the week, Later and No date are one quiet margin.",
      component: () => <ShapeBoard Body={Desk} wide />,
    },
    {
      key: "mosaic",
      name: "Mosaic",
      description:
        "The treemap with fixed tile sizes by nearness, so its area is the load: a light day is a small mosaic.",
      component: () => <ShapeBoard Body={Mosaic} wide />,
    },
    {
      key: "skyline",
      name: "Skyline",
      description:
        "A column per day stacked up from one ground line, so each column's height is its count. Closest to a calendar.",
      component: () => <ShapeBoard Body={Skyline} wide />,
    },
  ],
});
