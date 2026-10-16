import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { CardBoard } from "./board";
import { DatedTasksCard, DayCard, EveryTaskCard, ThenCard } from "./cards";

/**
 * How many of a Thread's Tasks its Dashboard card names, so a frequent Repeat
 * stops hiding the Task due after it. Every direction drops the Focused Task
 * from the card. Open it on the Rhythms scenario.
 */
export default definePrototype({
  title: "Tasks on the card",
  description:
    "Which of a Thread's Tasks its card names, when a frequent Repeat hides the next one.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description:
        "As it ships: the dated Task that placed the card, or the Focused Task in No date.",
      component: DashboardScreen,
    },
    {
      key: "every-task",
      name: "Every Task",
      description:
        "Every Task on every card, dated soonest first, then undated. No focus.",
      component: () => <CardBoard ThreadCard={EveryTaskCard} />,
    },
    {
      key: "dated-tasks",
      name: "Dated Tasks",
      description:
        "Every dated Task with its own date; undated ones counted. In No date, every Task.",
      component: () => <CardBoard ThreadCard={DatedTasksCard} />,
    },
    {
      key: "then",
      name: "Then",
      description:
        "The Tasks due on the card's day, one 'Then' line for the next dated Task, a count of the rest.",
      component: () => <CardBoard ThreadCard={ThenCard} />,
    },
    {
      key: "every-day",
      name: "Every day it's due",
      description:
        "A Thread stands on each day one of its Tasks is due, naming that day's Tasks.",
      component: () => <CardBoard ThreadCard={DayCard} spread />,
    },
  ],
});
