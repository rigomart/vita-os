import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";

import { definePrototype } from "@/lab/prototype";

import { CardBoard } from "./board";
import { AlsoCard, DayCard, PerTaskCard, TaskFirstCard } from "./cards";

/**
 * A Thread's card on the board wherever one of its Tasks is dated, so a
 * frequent Repeat stops hiding the Task due after it. Every direction drops
 * the Focused Task. Open it on the Rhythms scenario.
 */
export default definePrototype({
  title: "A card per dated Task",
  description:
    "A Thread's card wherever one of its Tasks is dated, so a frequent Repeat hides nothing.",
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
      key: "per-task",
      name: "A card per dated Task",
      description:
        "The Thread's card stands on every dated Task, each copy naming its Task. No focus.",
      component: () => <CardBoard ThreadCard={PerTaskCard} spread="task" />,
    },
    {
      key: "per-day",
      name: "A card per day",
      description:
        "One copy per day the Thread has something due, naming that day's Tasks.",
      component: () => <CardBoard ThreadCard={DayCard} spread="day" />,
    },
    {
      key: "task-first",
      name: "Task first",
      description:
        "A copy per dated Task with the Task as its headline and the Thread in the footer.",
      component: () => <CardBoard ThreadCard={TaskFirstCard} spread="task" />,
    },
    {
      key: "also",
      name: "Copies that point at each other",
      description:
        "A copy per dated Task, each saying the Thread's other days: 'Also Sat · Tue 9:30 AM'.",
      component: () => <CardBoard ThreadCard={AlsoCard} spread="task" />,
    },
    {
      key: "echo",
      name: "First card, then lines",
      description:
        "A Thread's soonest copy is a card; its later copies are one line, 'Thread · Task'.",
      component: () => (
        <CardBoard ThreadCard={PerTaskCard} spread="task" echo />
      ),
    },
    {
      key: "rhythms",
      name: "Rhythms apart",
      description:
        "Repeating Tasks leave the cards for a strip of pills atop their day; one-off dated Tasks each get a copy.",
      component: () => (
        <CardBoard ThreadCard={PerTaskCard} spread="task" rhythms />
      ),
    },
  ],
});
