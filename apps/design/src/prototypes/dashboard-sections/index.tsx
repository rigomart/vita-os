import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { SectionsBoard } from "./board";
import { AgendaList, PagesList, SpotlightList } from "./lists";

/**
 * The Dashboard's list of when things come due, drawn three other ways. The
 * chrome, the filter and No date stay as they ship; only the groups (Late,
 * Today, Tomorrow, the days, weeks and months) and the items in them change.
 * Try "Several dated Tasks" and "Busy".
 */
export default definePrototype({
  title: "Dashboard sections",
  description:
    "How the groups of the Dashboard's list look: file tabs of cards, a calendar gutter, one spotlight, or a page per day.",
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
      key: "agenda",
      name: "Agenda",
      description:
        "No boxes. The day in a sticky gutter at the left, its items as lines; only Today has a fill.",
      component: () => <SectionsBoard List={AgendaList} />,
    },
    {
      key: "spotlight",
      name: "Spotlight",
      description:
        "Late and Today in one raised panel of cards; everything after as quiet lines under plain headings.",
      component: () => <SectionsBoard List={SpotlightList} />,
    },
    {
      key: "pages",
      name: "Day pages",
      description:
        "Each day is one sheet with its date at the head and its items ruled on it; far groups have no sheet.",
      component: () => <SectionsBoard List={PagesList} />,
    },
  ],
});
