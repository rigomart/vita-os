import { definePrototype } from "@/lab/prototype";

import { NextDashboard } from "./dashboard";

/**
 * The next Dashboard: the sky as an ambient header, the filter on the board,
 * one attention-first list with each day on a file tab and cards two to a row
 * when there is room, and No date pinned beside it. Below `lg`, No date leads
 * the list as a folded tab and the actions sit in a bar at the bottom.
 *
 * The cards, the board's placement and the filter are the shipped ones. Not
 * `shell`: the product's shell draws the chrome this replaces, so the page
 * mounts `PrototypeShell`, which keeps the Thread pane, the palette and the
 * dialogs without any chrome. `?hour=19` previews the sky at dusk.
 */
export default definePrototype({
  title: "Dashboard redesign",
  description:
    "The sky as the header, one list from now outward on file tabs, and No date beside it.",
  component: NextDashboard,
});
