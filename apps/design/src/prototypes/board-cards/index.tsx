import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { CardBoard } from "./board";
import { eyebrow, gutter, keptAndLoose, sheets, threaded } from "./directions";

/**
 * Directions for the board's two cards, a Thread's and a Note's: each keeps
 * the Thread's three rows and the shipped behaviour, and tries one way to
 * tell the two apart that still reads as one family. Colour stays with time,
 * so none of them tells a Note by hue.
 */
export default definePrototype({
  title: "Board cards",
  description:
    "How Thread and Note cards could look alike, yet be told apart at a glance.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description:
        "As it ships: a Note differs by a faint margin rule and regular weight.",
      component: DashboardScreen,
    },
    {
      key: "gutter",
      name: "Kind gutter",
      description:
        "A glyph column on the left: a spool for a Thread, a sticky note for a Note.",
      component: () => <CardBoard cards={gutter} />,
    },
    {
      key: "eyebrow",
      name: "Eyebrow",
      description:
        "A small top line: a Thread's Area or the word Note, and the date; the words get the rest.",
      component: () => <CardBoard cards={eyebrow} />,
    },
    {
      key: "sheets",
      name: "Sheets in the folder",
      description:
        "Every card a sheet filed in its tab; a Note's sheet is dog-eared.",
      component: () => <CardBoard cards={sheets} />,
    },
    {
      key: "kept-and-loose",
      name: "Kept and loose",
      description:
        "A Thread is a solid sheet; a Note is a dashed outline, not yet filed.",
      component: () => <CardBoard cards={keptAndLoose} />,
    },
    {
      key: "threaded",
      name: "Threaded",
      description:
        "A Thread draws a thread from its title to its task; a Note sits on a flat slip.",
      component: () => <CardBoard cards={threaded} />,
    },
  ],
});
