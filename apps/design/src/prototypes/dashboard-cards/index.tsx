import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { ShapeBoard } from "./board";
import { Cards } from "./cards";

/** Scenarios to open: "Busy" for strain, "Sample life" for a light day, "Long tasks" for long words. */
export default definePrototype({
  title: "Dashboard cards",
  description:
    "Every item on the Dashboard a card, two to a row, graded by distance as the list is.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description: "As it ships: one graded list of lines, No date beside it.",
      component: DashboardScreen,
    },
    {
      key: "cards",
      name: "Cards",
      description:
        "The shipped list, headings, Later fold and No date, with every item a card, two to a row.",
      component: () => <ShapeBoard Body={Cards} />,
    },
  ],
});
