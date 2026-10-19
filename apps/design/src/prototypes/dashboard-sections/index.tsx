import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { SectionsBoard } from "./board";
import { GradedList } from "./graded";
import { PagesList } from "./pages";
import { StripList } from "./strip";
import { TimelineList } from "./timeline";
import { ZoomList } from "./zoom";

/**
 * The Dashboard's list of when things come due, drawn other ways. "Graded list" is the one in play. The
 * chrome, the filter and No date stay as they ship; only the groups (Late,
 * Today, Tomorrow, the days, weeks and months) and the items in them change.
 * Try "Several dated Tasks" and "Busy". Round one's Agenda and Spotlight are
 * kept in commit 2d2fdb2.
 */
export default definePrototype({
  title: "Dashboard sections",
  description:
    "How the groups of the Dashboard's list look: file tabs of cards, day pages, a timeline, zoom, or a week strip.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description:
        "As it ships: each group a file tab on a fill, its items as sheets, two to a row.",
      component: DashboardScreen,
    },
    {
      key: "graded",
      name: "Graded list",
      description:
        "Week strip's list without the strip: ruled headings over lines, larger and darker the nearer they are.",
      component: () => <SectionsBoard List={GradedList} />,
    },
    {
      key: "pages",
      name: "Day pages",
      description:
        "Each day is one sheet with its date at the head and its items ruled on it; far groups have no sheet.",
      component: () => <SectionsBoard List={PagesList} />,
    },
    {
      key: "timeline",
      name: "Timeline",
      description:
        "A line down the left with a stop per group; near items are small sheets on it, quiet stretches show as space.",
      component: () => <SectionsBoard List={TimelineList} />,
    },
    {
      key: "zoom",
      name: "Zoom",
      description:
        "Items change form with distance: big for Late and Today, chips for the week, one line of names for later.",
      component: () => <SectionsBoard List={ZoomList} />,
    },
    {
      key: "strip",
      name: "Week strip",
      description:
        "A pinned strip of the next seven days with a dot per item, over a plain list with ruled headings.",
      component: () => <SectionsBoard List={StripList} />,
    },
  ],
});
