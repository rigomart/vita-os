import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { LaterBoard } from "./board";
import { GroupFoldList, LaterFoldList, TodayFirstList } from "./lists";

/**
 * How much of the Dashboard's list is open on arrival. The chrome, the filter
 * and No date stay as they ship; only how far out the list stays open
 * changes. Try "Busy" and "Several dated Tasks". Every fold is held for the
 * visit and starts folded on a fresh load.
 */
export default definePrototype({
  title: "Dashboard later",
  description:
    "Fold what is a week or more away: one Later line, each far group folded, or only Late, Today and Tomorrow open.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description: "As it ships: every group open, out to the months.",
      component: DashboardScreen,
    },
    {
      key: "later",
      name: "Later folds",
      description:
        "Late through the next six days open; everything from a week out folds into one Later line at the foot.",
      component: () => <LaterBoard List={LaterFoldList} />,
    },
    {
      key: "groups",
      name: "Far groups fold",
      description:
        "Every heading stays; from a week out each heading folds its lines into one line of names.",
      component: () => <LaterBoard List={GroupFoldList} />,
    },
    {
      key: "today",
      name: "Today first",
      description:
        "Late, Today and Tomorrow open; the rest of the week folds into one line, and from a week out into one Later line.",
      component: () => <LaterBoard List={TodayFirstList} />,
    },
  ],
});
