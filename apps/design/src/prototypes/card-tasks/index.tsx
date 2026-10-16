import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { CardBoard } from "./board";

/**
 * A Thread's card stands on the board once per dated Task, with the Task as
 * its headline, so a frequent Repeat stops hiding the Task due after it. No
 * Focus. Open it on the "Several dated Tasks" scenario. The directions that
 * lost are kept in commit bbb7c95.
 */
export default definePrototype({
  title: "A card per dated Task",
  description:
    "A Thread's card wherever one of its Tasks is dated, the Task first, so a frequent Repeat hides nothing.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description:
        "As it ships: one card per Thread, at its soonest dated Task.",
      component: DashboardScreen,
    },
    {
      key: "task-first",
      name: "Task first",
      description:
        "A copy per dated Task: the Task, then its Thread. Hovering a copy rings the Thread's other copies.",
      component: () => <CardBoard siblings />,
    },
    {
      key: "task-first-quiet",
      name: "Task first, no ring",
      description: "The same copies without the hover ring, to compare.",
      component: () => <CardBoard />,
    },
  ],
});
