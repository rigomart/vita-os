import type {
  ApplicationClient,
  AreaIcon,
  AreaId,
  OperationResult,
  Repeat,
  TaskId,
  Thread,
  UpdateThreadInput,
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
    id: "long-tasks",
    name: "Long tasks",
    description: "A Thread with many long Tasks: dated, repeating, late.",
    seed: (client) => seedLife(client, LONG_TASKS),
  },
  {
    id: "dated-tasks",
    name: "Several dated Tasks",
    description:
      "Eight Threads, most with two to four dated Tasks: a daily Repeat beside one-offs, two Tasks on one day, a late one, one far out.",
    seed: (client) => seedLife(client, SEVERAL_DATED),
  },
  {
    id: "long-activity",
    name: "Long activity",
    description:
      "A Thread with weeks of history: long Tasks done, Area changes, a resolution with a note and dropped Tasks, a reopening.",
    seed: seedLongActivity,
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
  tasks?: (string | SeedTask)[];
  /** A dated "Follow up" Task this many days from today. */
  followUpInDays?: number;
  /** The Follow-up's time of day, `HH:mm`. */
  followUpAt?: string;
  notes?: { body: string }[];
  resolution?: string;
}

/** A Task with a date this many days from today, and optionally a Repeat. */
interface SeedTask {
  text: string;
  inDays: number;
  /** Its time of day, `HH:mm`. */
  at?: string;
  repeat?: Repeat;
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
    for (const task of spec.tasks ?? []) {
      const taskId = newRecordId() as TaskId;
      if (typeof task === "string") {
        must(await client.addTask({ threadId, taskId, text: task }));
        continue;
      }
      const date = dayFromToday(task.inDays, task.at);
      must(await client.addTask({ threadId, taskId, text: task.text, date }));
      if (task.repeat !== undefined) {
        must(
          await client.setTaskRepeat({
            threadId,
            taskId,
            repeat: task.repeat,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        );
      }
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
      must(await client.createThreadNote({ threadId, body: note.body }));
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
        },
      ],
    },
    {
      title: "File quarterly taxes",
      area: "Money",
      tasks: ["Gather Q3 receipts", "Send the summary to the accountant"],
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

/**
 * One Thread whose Tasks fill the pane: long text, dates near and far, a late
 * one, and two that repeat. The rest are there to compare against.
 */
const LONG_TASKS: Life = {
  areas: [
    { name: "Health", icon: "HeartPulse" },
    { name: "Home", icon: "Home" },
  ],
  threads: [
    {
      title: "Mum's hip recovery",
      area: "Health",
      summary:
        "Home from hospital on the 2nd; six weeks of rehab before the follow-up X-ray.",
      tasks: [
        "Call the physio to move Thursday's session to the afternoon so I can drive her there",
        {
          text: "Evening check-in: ask how the pain was today and whether she did her exercises",
          inDays: 0,
          at: "19:00",
          repeat: { kind: "days", every: 1 },
        },
        {
          text: "Pick up the second box of painkillers from the pharmacy on Elm Street",
          inDays: -1,
        },
        "Ask the surgeon whether she can sleep on her side yet",
        {
          text: "Physio session",
          inDays: 1,
          at: "15:00",
          repeat: { kind: "weekly", weekdays: [2, 4] },
        },
        {
          text: "Follow-up X-ray at St Mary's — bring the discharge letter and the medication list",
          inDays: 12,
          at: "09:30",
        },
        "Order a raised toilet seat and a grab rail for the bathroom",
      ],
    },
    {
      title: "Fix the leaking kitchen tap",
      area: "Home",
      tasks: ["Buy a replacement cartridge"],
      followUpInDays: 2,
    },
    { title: "Learn to bake sourdough" },
  ],
  notes: [],
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * One Thread lived through over six weeks, so its Activity Log runs past a
 * page and holds every entry the product still writes, at its longest: long
 * Task text, Area moves, a resolution with a note and the Tasks it dropped,
 * a reopening. Each step runs at its own past moment by setting the clock,
 * which is put back afterwards.
 *
 * The clock is shared, and StrictMode seeds a scenario twice at once, so one
 * seed waits for the other to put it back before it starts.
 */
async function seedLongActivity(client: ApplicationClient) {
  const previous = travelling;
  let release = () => {};
  travelling = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  const start = clock.now();
  const offset = start - Date.now();
  const at = (daysAgo: number, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(start - daysAgo * DAY);
    date.setHours(hours!, minutes!, 0, 0);
    clock.set(date.getTime());
  };
  // Today's steps count back from now, so they never land in the future.
  const ago = (minutes: number) => clock.set(start - minutes * 60 * 1000);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    at(46, "09:12");
    const areas = new Map<string, AreaId>();
    for (const area of [
      { name: "Home", icon: "Home" },
      { name: "Money", icon: "WalletCards" },
      { name: "Family", icon: "HeartPulse" },
    ] as const) {
      areas.set(area.name, must(await client.createArea(area))._id);
    }
    const area = (name: string) => areas.get(name)!;

    let thread: Thread = must(
      await client.createThread({
        title: "Move to the flat on Carrow Road",
        summary:
          "Keys on the 1st. Old place handed back by the 30th, deposit back in full.",
        areaId: area("Home"),
      }),
    );
    const threadId = thread._id;
    const add = async (text: string, date?: number) => {
      const taskId = newRecordId() as TaskId;
      thread = must(
        await client.addTask({
          threadId,
          taskId,
          text,
          ...(date === undefined ? {} : { date }),
        }),
      );
      return taskId;
    };
    const complete = async (taskId: TaskId) => {
      const task = thread.tasks?.find((each) => each._id === taskId);
      thread = must(
        await client.completeTask({
          threadId,
          taskId,
          expectedOccurrence: task?.date ?? null,
          timeZone,
        }),
      );
    };
    const update = async (patch: Omit<UpdateThreadInput, "threadId">) => {
      thread = must(await client.updateThread({ threadId, ...patch }));
    };

    const quotes = await add(
      "Get three quotes from removal companies and ask whether they pack the kitchen too, or only move boxes",
    );
    const alcove = await add(
      "Measure the bedroom alcove to see whether the wardrobe fits, otherwise list it on Marketplace before the move",
    );
    // Still open at the resolution, so it names them as dropped.
    await add(
      "Cancel the old broadband contract — check the notice period first, it might be 30 days and they charge for the router",
    );
    await add("Redirect post at the Post Office for six months");
    const meter = await add("Read the meters");

    at(45, "18:40");
    await complete(quotes);
    at(44, "11:20");
    await complete(await add("Book the van for the 1st"));
    at(41, "08:05");
    await complete(alcove);
    at(38, "21:17");
    await complete(meter);
    at(37, "12:30");
    await update({ areaId: area("Money") });
    at(33, "10:02");
    const deposit = await add(
      "Email the letting agent with the move-in inventory and the photos of the carpet in the second bedroom, and ask for the deposit to be released through the DPS portal rather than by cheque",
    );
    at(32, "16:45");
    await complete(deposit);
    at(30, "19:20");
    await update({
      state: "resolved",
      resolutionNote:
        "Keys handed back and the deposit claim is with the agency. If they deduct for the carpet in the second bedroom I'll dispute it with the move-in photos; otherwise this is done.",
    });

    at(22, "09:48");
    await update({ state: "open" });
    at(22, "09:50");
    await update({ areaId: null });
    at(21, "14:05");
    await update({ areaId: area("Home") });

    const portal = await add(
      "Check the deposit portal for a decision",
      start - 21 * DAY,
    );
    must(
      await client.setTaskRepeat({
        threadId,
        taskId: portal,
        repeat: { kind: "days", every: 7 },
        timeZone,
      }),
    );
    for (const daysAgo of [21, 14, 7]) {
      at(daysAgo, "08:30");
      await complete(portal);
    }

    at(12, "13:15");
    const dispute = await add(
      "Open a dispute: agency wants £340 for 'carpet replacement' but the inventory already lists two stains and a burn mark by the window",
    );
    const photos = await add(
      "Find the move-in photos — they're in the shared album named 'Flat 2B Sept' or on the old phone",
    );
    at(16, "15:40");
    await complete(
      await add("Ask the agency for a written breakdown of the deductions"),
    );
    at(11, "20:30");
    await complete(photos);
    at(9, "11:00");
    await complete(dispute);
    at(5, "17:25");
    const keys = await add("Return the spare keys to Dad");
    await update({ areaId: area("Family") });
    at(3, "10:10");
    await complete(keys);
    at(1, "09:00");
    const tv = await add(
      "Wall-mount the TV: https://www.example.com/guides/how-to-mount-a-tv-on-a-plasterboard-wall-without-finding-a-stud",
    );
    await complete(tv);
    at(1, "19:30");
    await complete(await add("Hang the bathroom mirror"));
    ago(35);
    await update({ areaId: area("Home") });
    const boxes = await add(
      "Flatten the last boxes and put them out for recycling",
    );
    ago(5);
    await complete(boxes);

    at(10, "12:00");
    const { _id: tyres } = must(
      await client.createThread({ title: "Replace the car tyres" }),
    );
    must(
      await client.updateThread({
        threadId: tyres,
        state: "resolved",
        resolutionNote: "Done at the garage on the high street.",
      }),
    );
    at(2, "12:00");
    must(await client.createThread({ title: "Learn to bake sourdough" }));
  } finally {
    clock.set(Date.now() + offset);
    release();
  }
}

let travelling = Promise.resolve();

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

/**
 * Threads that each hold several dated Tasks and little else, so a board
 * that places a Thread by more than its soonest Task can be judged without
 * noise. One Thread with a single Task and one with none dated are there to
 * compare against.
 */
const SEVERAL_DATED: Life = {
  areas: [
    { name: "Health", icon: "HeartPulse" },
    { name: "Home", icon: "Home" },
    { name: "Money", icon: "WalletCards" },
  ],
  threads: [
    {
      title: "Recovery after a knee operation",
      area: "Health",
      tasks: [
        {
          text: "Evening check-in",
          inDays: 0,
          at: "19:00",
          repeat: { kind: "days", every: 1 },
        },
        { text: "Pick up the second prescription", inDays: 1 },
        { text: "Follow-up appointment", inDays: 4, at: "09:30" },
      ],
    },
    {
      title: "Moving flat",
      area: "Home",
      tasks: [
        { text: "Book the van", inDays: 0 },
        { text: "Ask about the deposit return", inDays: 2 },
        { text: "Hand back the keys", inDays: 6, at: "10:00" },
        { text: "Change the address at the bank", inDays: 9 },
      ],
    },
    {
      title: "Kitchen tap",
      area: "Home",
      tasks: [
        { text: "Call the plumber", inDays: 0 },
        { text: "Buy a replacement cartridge", inDays: 0 },
      ],
    },
    {
      title: "Dog's medication",
      tasks: [
        {
          text: "Give the evening tablet",
          inDays: 0,
          at: "20:00",
          repeat: { kind: "days", every: 1 },
        },
        { text: "Book the vet check", inDays: -1 },
      ],
    },
    {
      title: "Tax return",
      area: "Money",
      tasks: [
        { text: "Send the receipts to the accountant", inDays: 3 },
        { text: "Sign and file the return", inDays: 12 },
      ],
    },
    {
      title: "Learn Spanish",
      tasks: [
        {
          text: "Practice session",
          inDays: 1,
          repeat: { kind: "weekly", weekdays: [1, 4] },
        },
        { text: "Sit the A2 exam", inDays: 25, at: "09:00" },
      ],
    },
    {
      title: "Choose between two cars",
      tasks: [{ text: "Test drive the second one", inDays: 5 }],
    },
    {
      title: "Garden shed",
      area: "Home",
      tasks: ["Measure the space", "Compare three kits"],
    },
  ],
  notes: [],
};
