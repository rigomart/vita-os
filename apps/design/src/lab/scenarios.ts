import type {
  ApplicationClient,
  AreaIcon,
  AreaId,
  OperationResult,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import { clock } from "@vita-os/application";
import { newRecordId } from "@vita-os/core";

/**
 * A situation to open the lab in. Each one is built by issuing the same
 * commands a person would, so the data is whatever the real rules make of it.
 */
export interface Scenario {
  id: string;
  name: string;
  description: string;
  seed: (client: ApplicationClient) => Promise<void>;
}

export const scenarios = [
  {
    id: "sample",
    name: "Sample life",
    description: "The dev seed: every Dashboard column, Areas, Notes.",
    seed: (client) => seedLife(client, SAMPLE),
  },
  {
    id: "empty",
    name: "Empty",
    description: "A first visit: nothing captured yet.",
    seed: async () => {},
  },
  {
    id: "busy",
    name: "Busy",
    description: "Forty Threads and a full Notes pile, for density.",
    seed: (client) => seedLife(client, busyLife()),
  },
] as const satisfies readonly Scenario[];

export type ScenarioId = (typeof scenarios)[number]["id"];

export function findScenario(id: string): Scenario {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

interface SeedThread {
  title: string;
  summary?: string;
  area?: string;
  tasks?: string[];
  /** Index into `tasks` of the Focused Task. */
  focus?: number;
  /** A dated "Follow up" Task this many days from today. */
  followUpInDays?: number;
  /** The Follow-up's time of day, `HH:mm`. */
  followUpAt?: string;
  notes?: { body: string; done?: boolean }[];
  resolution?: string;
}

interface Life {
  areas: { name: string; icon: AreaIcon }[];
  threads: SeedThread[];
  notes: { body: string; inDays?: number; at?: string }[];
}

async function seedLife(client: ApplicationClient, life: Life) {
  const areaIds = new Map<string, AreaId>();
  for (const area of life.areas) {
    areaIds.set(area.name, must(await client.createArea(area))._id);
  }

  for (const spec of life.threads) {
    const areaId = spec.area === undefined ? undefined : areaIds.get(spec.area);
    const thread: Thread = must(
      await client.createThread({
        title: spec.title,
        ...(spec.summary === undefined ? {} : { summary: spec.summary }),
        ...(areaId === undefined ? {} : { areaId }),
      }),
    );
    const threadId = thread._id;
    const taskIds: TaskId[] = [];
    for (const text of spec.tasks ?? []) {
      const taskId = newRecordId() as TaskId;
      taskIds.push(taskId);
      must(await client.addTask({ threadId, taskId, text }));
    }
    if (spec.focus !== undefined) {
      must(await client.focusTask({ threadId, taskId: taskIds[spec.focus]! }));
    }
    if (spec.followUpInDays !== undefined) {
      must(
        await client.addTask({
          threadId,
          taskId: newRecordId() as TaskId,
          text: "Follow up",
          date: dayFromToday(spec.followUpInDays, spec.followUpAt),
        }),
      );
    }
    for (const note of spec.notes ?? []) {
      const created = must(
        await client.createThreadNote({ threadId, body: note.body }),
      );
      if (note.done) {
        must(await client.markThreadNoteDone({ threadNoteId: created._id }));
      }
    }
    if (spec.resolution !== undefined) {
      must(
        await client.updateThread({
          threadId,
          state: "resolved",
          resolutionNote: spec.resolution,
        }),
      );
    }
  }

  for (const note of life.notes) {
    must(
      await client.createNote({
        body: note.body,
        ...(note.inDays === undefined
          ? {}
          : { followUp: dayFromToday(note.inDays, note.at) }),
      }),
    );
  }
}

/** A seed that the rules refuse is a broken scenario; say so loudly. */
function must<T>(result: OperationResult<T>): T {
  if (!result.ok) {
    throw new Error(`Lab scenario refused: ${result.error.message}`);
  }
  return result.value;
}

/**
 * `days` from today, as the date pickers store it: local midnight for a date
 * alone, or that day at `at` (`HH:mm`).
 */
function dayFromToday(days: number, at?: string): number {
  const date = new Date(clock.now());
  const [hours = 0, minutes = 0] = at?.split(":").map(Number) ?? [];
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** The same life `bun run setup` seeds a dev account with. */
const SAMPLE: Life = {
  areas: [
    { name: "Health", icon: "HeartPulse" },
    { name: "Home", icon: "Home" },
    { name: "Work", icon: "BriefcaseBusiness" },
    { name: "Money", icon: "WalletCards" },
  ],
  threads: [
    {
      title: "Dentist follow-up",
      area: "Health",
      summary: "Crown on the lower left molar still feels high.",
      tasks: ["Call the clinic to reschedule", "Ask about a night guard"],
      focus: 0,
      followUpInDays: -3,
      notes: [
        {
          body: `# Consultation — crown follow-up

## What we discussed
- The lower left crown still feels high.
- Bring the previous treatment summary to the next appointment.

## Before the appointment
- [ ] Call the clinic
- [ ] Write down the questions`,
        },
        { body: "Called the clinic\nWaiting for a reply" },
        {
          body: "## Previous visit\nCollected the treatment summary and saved the clinic's contact details.",
          done: true,
        },
      ],
    },
    {
      title: "File quarterly taxes",
      area: "Money",
      tasks: ["Gather Q3 receipts", "Send the summary to the accountant"],
      focus: 0,
      followUpInDays: 0,
      followUpAt: "10:00",
    },
    {
      title: "Quarterly review prep",
      area: "Work",
      tasks: ["Draft the wins list", "Book a 1:1 with my manager"],
      followUpInDays: 3,
      notes: [
        {
          body: `## Wins to bring to the review
- Shipped the onboarding update.
- Helped unblock the release.

**Bring concrete examples**, including feedback from the team.`,
        },
      ],
    },
    {
      title: "Fix the leaking kitchen tap",
      area: "Home",
      tasks: ["Buy a replacement cartridge"],
      followUpInDays: 5,
    },
    {
      title: "Plan the Lisbon trip",
      tasks: ["Compare flight dates"],
      followUpInDays: 20,
    },
    {
      title: "Marathon training block",
      area: "Health",
      tasks: ["Pick a 16-week plan"],
    },
    { title: "Build an emergency fund", area: "Money" },
    { title: "Learn to bake sourdough" },
    {
      title: "Replace the car tyres",
      area: "Home",
      resolution: "Done at the garage on the high street.",
    },
  ],
  notes: [
    { body: "Ask Sam about the spare moving boxes", inDays: 1 },
    { body: "Pick up the dry cleaning", inDays: 0, at: "16:30" },
    { body: "Book club picks: The Overstory, Piranesi" },
    { body: "Guest wifi password is on the fridge" },
  ],
};

/** The sample life, then many more of everything, spread across time. */
function busyLife(): Life {
  const subjects = [
    "Renew the passport",
    "Sort the garage",
    "Physio for the knee",
    "Team offsite agenda",
    "Compare energy tariffs",
    "Birthday gift for Mum",
    "Paint the hallway",
    "Learn basic Portuguese",
    "Cancel unused subscriptions",
    "Annual eye test",
    "Hire a cleaner",
    "Update the CV",
    "Back up the photo library",
    "Service the bike",
    "Plan the garden beds",
    "Review the pension",
  ];
  const areaNames = ["Health", "Home", "Work", "Money", undefined];
  const threads: SeedThread[] = [];
  for (let index = 0; index < 31; index += 1) {
    const subject = subjects[index % subjects.length]!;
    const round = Math.floor(index / subjects.length);
    threads.push({
      title: round === 0 ? subject : `${subject} (${round + 1})`,
      ...(areaNames[index % areaNames.length] === undefined
        ? {}
        : { area: areaNames[index % areaNames.length] }),
      tasks: [`Next step for ${subject.toLowerCase()}`, "Check in again"],
      ...(index % 3 === 0 ? { focus: 0 } : {}),
      ...(index % 4 === 3 ? {} : { followUpInDays: (index % 9) * 3 - 6 }),
    });
  }
  const notes = Array.from({ length: 24 }, (_, index) => ({
    body: `Loose thought #${index + 1}: something to come back to`,
    ...(index % 3 === 0 ? { inDays: (index % 7) - 2 } : {}),
  }));
  return {
    areas: SAMPLE.areas,
    threads: [...SAMPLE.threads, ...threads],
    notes: [...SAMPLE.notes, ...notes],
  };
}
