import { ThreadAttentionSection } from "@vita-os/application/internal/threads/components/thread-attention-section.tsx";

import { definePrototype } from "@/lab/prototype";

import { BottomBarAlways, BottomBarOnHover } from "./bottom-bar";
import {
  AgendaTasks,
  ChecklistTasks,
  FloatingTasks,
  OpenToActTasks,
} from "./directions";
import { TaskStage } from "./stage";

/**
 * Directions for a Thread's Tasks in its pane. Each gives the text the room
 * the shipped row spends on controls, and draws one list with no "No date"
 * divider. Open the "Long tasks" scenario to see them under strain.
 */
export default definePrototype({
  title: "Thread tasks",
  description:
    "How a Thread's Tasks could read in full, as one list, with fewer controls beside the text.",
  variants: [
    {
      key: "current",
      name: "Current",
      description:
        "As it ships: focus radio, text, date, remove, skip, note and complete on one line; dated first, then No date.",
      component: () => <TaskStage list={ThreadAttentionSection} />,
    },
    {
      key: "bottom-bar",
      name: "Bottom bar",
      description:
        "Text up to two lines, growing while edited; date at the bottom left, commands with tooltips at the bottom right, on hover.",
      component: () => <TaskStage list={BottomBarOnHover} />,
    },
    {
      key: "bottom-bar-always",
      name: "Bottom bar, always shown",
      description:
        "The same, with the commands always in view, quiet until pointed at.",
      component: () => <TaskStage list={BottomBarAlways} />,
    },
    {
      key: "checklist",
      name: "Checklist",
      description:
        "Complete leads; the text wraps in full with its date and focus under it; everything else behind ⋯. Capture order.",
      component: () => <TaskStage list={ChecklistTasks} />,
    },
    {
      key: "open-to-act",
      name: "Open to act",
      description:
        "Closed rows show complete, text and date; opening one spells out every command under its text. Capture order.",
      component: () => <TaskStage list={OpenToActTasks} />,
    },
    {
      key: "floating",
      name: "Floating toolbar",
      description:
        "No room reserved for commands: a pill floats over the hovered or focused row. Capture order.",
      component: () => <TaskStage list={FloatingTasks} />,
    },
    {
      key: "agenda",
      name: "Agenda",
      description:
        "The date is a column on the left, soonest first, undated after with an empty gutter; the rest behind ⋯.",
      component: () => <TaskStage list={AgendaTasks} />,
    },
  ],
});
