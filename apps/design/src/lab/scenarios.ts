import type {
  ApplicationClient,
  AreaIcon,
  AreaId,
  OperationResult,
  Repeat,
  TaskId,
  ThreadNoteId,
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
      "A Thread with weeks of history: long Tasks done, Area changes, a resolution with a note and dropped Tasks, a reopening. Beside it, two weeks of a daily rhythm.",
    seed: seedLongActivity,
  },
  {
    id: "thread-stories",
    name: "Thread stories",
    description:
      "Seven Threads, each a story told over weeks to years: a burst then a weekly rhythm, Notes then quiet, a plan that changes, a burst then resolved, a check-up twice a year, a daily rhythm, and one that only started.",
    seed: seedThreadStories,
  },
  {
    id: "info-notes",
    name: "Info notes",
    description:
      "The sample life plus a pile of undated Notes that are only information, two undated to-dos, and dated Notes.",
    seed: (client) => seedLife(client, infoNotesLife()),
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
 * Take the shared clock to past moments, so a seed's steps happen when the
 * story says they did. Call `back` when done, in a `finally`.
 *
 * StrictMode seeds a scenario twice at once, so one seed waits for the other
 * to put the clock back before it starts.
 */
async function travel() {
  const previous = travelling;
  let release = () => {};
  travelling = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  const start = clock.now();
  const offset = start - Date.now();
  /** `daysAgo` days before the seed began, at `time` (`HH:mm`). */
  const day = (daysAgo: number, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(start - daysAgo * DAY);
    date.setHours(hours!, minutes!, 0, 0);
    return date.getTime();
  };
  return {
    start,
    day,
    /** Set the clock to that `day`. */
    at(daysAgo: number, time: string) {
      clock.set(day(daysAgo, time));
    },
    /** Counts back from now, so today's steps never land in the future. */
    ago(minutes: number) {
      clock.set(start - minutes * 60 * 1000);
    },
    back() {
      clock.set(Date.now() + offset);
      release();
    },
  };
}

let travelling = Promise.resolve();

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * One Thread lived through over six weeks, so its Activity Log runs past a
 * page and holds every entry the product still writes, at its longest: long
 * Task text, Area moves, a resolution with a note and the Tasks it dropped,
 * a reopening.
 */
async function seedLongActivity(client: ApplicationClient) {
  const { start, at, ago, back } = await travel();

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

    at(46, "09:13");
    const quotes = await add(
      "Get three quotes from removal companies and ask whether they pack the kitchen too, or only move boxes",
    );
    at(46, "09:14");
    const alcove = await add(
      "Measure the bedroom alcove to see whether the wardrobe fits, otherwise list it on Marketplace before the move",
    );
    // Still open at the resolution, so it names them as dropped.
    at(46, "09:15");
    await add(
      "Cancel the old broadband contract — check the notice period first, it might be 30 days and they charge for the router",
    );
    at(46, "09:16");
    await add("Redirect post at the Post Office for six months");
    at(46, "09:17");
    const meter = await add("Read the meters");

    at(45, "18:40");
    await complete(quotes);
    at(44, "11:20");
    await complete(await add("Book the van for the 1st"));
    at(43, "19:05");
    must(
      await client.removeTask({
        threadId,
        taskId: await add("Ask the neighbours to keep the parking bay free"),
      }),
    );
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

    at(15, "08:00");
    const { _id: drops } = must(
      await client.createThread({ title: "Biscuit's eye drops" }),
    );
    const eveningDrops = newRecordId() as TaskId;
    let dropsThread = must(
      await client.addTask({
        threadId: drops,
        taskId: eveningDrops,
        text: "Evening drops",
        date: start - 14 * DAY,
      }),
    );
    dropsThread = must(
      await client.setTaskRepeat({
        threadId: drops,
        taskId: eveningDrops,
        repeat: { kind: "days", every: 1 },
        timeZone,
      }),
    );
    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      at(daysAgo, "20:15");
      const task = dropsThread.tasks?.find((each) => each._id === eveningDrops);
      dropsThread = must(
        await client.completeTask({
          threadId: drops,
          taskId: eveningDrops,
          expectedOccurrence: task?.date ?? null,
          timeZone,
          ...(daysAgo === 7
            ? {
                note: {
                  id: newRecordId() as ThreadNoteId,
                  body: "Vet says the left eye is clearing; keep going another week",
                },
              }
            : {}),
        }),
      );
    }

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
    back();
  }
}

/**
 * One Thread per case in the Activity Log spec (issue 524), each lived
 * through at its own past moments: Notes carrying the story, plans added and
 * dropped, daily and weekly rhythms, long quiet, long Notes, an Area move,
 * and a Thread resolved, reopened and resolved again. Among them, the odd
 * lines: a Note deleted after it was captured, a completion whose Note was
 * deleted, and a Thread started from a Standalone Note.
 */
async function seedThreadStories(client: ApplicationClient) {
  const { at, day: daysAgo, back } = await travel();

  try {
    at(800, "09:00");
    const areas = new Map<string, AreaId>();
    for (const area of [
      { name: "Family", icon: "Users" },
      { name: "Money", icon: "WalletCards" },
      { name: "Home", icon: "Home" },
      { name: "Work", icon: "BriefcaseBusiness" },
      { name: "Health", icon: "HeartPulse" },
    ] as const) {
      areas.set(area.name, must(await client.createArea(area))._id);
    }
    const area = (name: string) => areas.get(name)!;
    const story = async (
      input: Parameters<ApplicationClient["createThread"]>[0],
    ) => threadStory(client, must(await client.createThread(input)));

    // 1. A relative's surgery, then rehab: a burst, then a weekly rhythm.
    at(124, "18:30");
    const surgery = await story({
      title: "Dad's knee operation and rehab",
      summary:
        "Operation on the 12th, then physio until he walks without the frame.",
      areaId: area("Family"),
    });
    at(122, "12:10");
    await surgery.note(
      "Pre-op appointment: fasting from midnight, stop the blood thinners five days before, bring the medication list.",
    );
    at(122, "12:20");
    const forms = await surgery.add("Pick up the pre-op forms");
    const leave = await surgery.add("Book time off for the operation week");
    const lift = await surgery.add("Arrange a lift to the hospital");
    at(119, "17:00");
    await surgery.complete(forms);
    at(118, "09:30");
    await surgery.complete(leave);
    at(116, "08:15");
    await surgery.complete(lift);
    at(116, "16:40");
    await surgery.note(
      "Operation went fine. Two nights on the ward, then home with a frame. Physio starts next week.",
    );
    at(115, "20:05");
    await surgery.note(
      "Visited in the evening. Pain is under control; the nurse showed him how to use the frame on the stairs.",
    );
    at(115, "20:15");
    const collect = await surgery.add("Collect him from the ward");
    const stool = await surgery.add("Buy a shower stool");
    at(114, "11:00");
    await surgery.complete(collect);
    at(114, "15:30");
    await surgery.note("Home. The discharge letter is in the blue folder.");
    at(114, "15:45");
    await surgery.note(
      [
        "Discharge instructions from the ward nurse:",
        "",
        "- Ice the knee for 20 minutes, three times a day",
        "- Painkillers every six hours for the first week, then only as needed",
        "- No kneeling and no low chairs for six weeks",
        "- Keep the dressing dry; the stitches come out at the GP after 12 days",
        "- Walk with the frame every hour while awake, a little further each day",
        "- Call the ward if the calf swells or feels hot",
      ].join("\n"),
    );
    at(113, "10:00");
    await surgery.complete(stool);
    at(113, "10:05");
    const physio = await surgery.add(
      "Drive him to physio",
      daysAgo(109, "10:00"),
      { kind: "days", every: 7 },
    );
    at(113, "10:10");
    await surgery.setArea(area("Health"));
    for (let days = 109; days >= 4; days -= 7) {
      at(days, "11:30");
      await surgery.complete(
        physio,
        days === 60
          ? "Physio says he can drop to one crutch at home. Keep the frame for outside."
          : undefined,
      );
    }

    // 2. A tax error: a letter, two calls, a Task to chase, then quiet.
    at(55, "08:30");
    const { _id: letter } = must(
      await client.createNote({
        body: "Letter from the tax office: they say last year's return underpaid by 412. Reference on page 2. Reply within 30 days.",
      }),
    );
    at(54, "19:00");
    const tax = threadStory(
      client,
      must(
        await client.createThreadFromNote({
          noteId: letter,
          title: "Tax office letter about last year",
          areaId: area("Money"),
        }),
      ).thread,
    );
    at(51, "13:20");
    await tax.note(
      "Called the helpline. They see a mismatch in the employer's figures; someone will check and call back within a week.",
    );
    at(51, "13:40");
    await tax.note(
      "What the agent said, for the file: the employer's figures for the year don't match the payslips for March and April. Their record shows the spring bonus paid twice, which would explain most of the difference. She can't change it herself; it goes to a caseworker, who compares it with the employer's own filing. If the employer confirms the double entry, the amount owed drops to about 30 and the rest is cancelled. Keep the March and April payslips to hand, and pay nothing until the written decision comes.",
    );
    at(47, "09:45");
    await tax.note(
      "Second call. No callback came. The new agent says the case is still open; asked for it in writing.",
    );
    at(47, "09:55");
    await tax.add(
      "Chase the tax office if no letter has come",
      daysAgo(33, "00:00"),
    );

    // 3. A home repair with an insurer: visits and claims, a changing plan.
    at(150, "08:20");
    const roof = await story({
      title: "Roof leak and the insurance claim",
      areaId: area("Home"),
    });
    at(150, "08:25");
    await roof.note(
      "Water stain on the bedroom ceiling after the storm. Took photos of the ceiling and the loft.",
    );
    at(150, "08:30");
    const claim = await roof.add("Call the insurer to open a claim");
    const roofer = await roof.add("Get a roofer to look at it");
    at(148, "10:15");
    await roof.complete(
      claim,
      "Claim opened. They want photos and two quotes before sending an adjuster.",
    );
    at(148, "10:20");
    const photos = await roof.add("Send the photos to the insurer");
    const secondQuote = await roof.add("Get a second quote");
    at(140, "14:00");
    await roof.complete(roofer);
    at(140, "14:10");
    await roof.note(
      "Roofer's visit: three cracked tiles and the flashing round the chimney is damaged. Quote to follow by email.",
    );
    at(136, "21:30");
    const photosNote = await roof.complete(
      photos,
      "Sent 14 photos through the claims portal.",
    );
    at(130, "09:00");
    await roof.note("Adjuster's visit booked for Tuesday morning.");
    at(126, "18:45");
    const draftNote = await roof.note(
      "Adjuster's draft report came in. The numbers look low; check against the roofer's quote.",
    );
    at(123, "12:30");
    await roof.note(
      "Adjuster's report: they cover the tiles, not the flashing. They call it wear and tear.",
    );
    at(123, "12:40");
    await roof.remove(secondQuote);
    const dispute = await roof.add("Dispute the flashing decision");
    const opinion = await roof.add(
      "Ask the roofer for a written opinion on the flashing",
    );
    at(110, "16:00");
    await roof.complete(opinion);
    at(110, "16:05");
    await roof.note(
      "The roofer's letter says the flashing failed from storm damage, not age. Forwarded to the insurer.",
    );
    at(95, "11:20");
    await roof.note(
      "The insurer accepted the full claim after the roofer's letter.",
    );
    at(95, "11:25");
    await roof.remove(dispute);
    const booking = await roof.add("Book the repair date");
    at(80, "09:10");
    await roof.complete(booking);
    at(80, "09:15");
    const clearLoft = await roof.add(
      "Clear the loft before the roofers come",
      daysAgo(62, "00:00"),
    );
    at(62, "08:00");
    await roof.complete(clearLoft);
    at(60, "17:30");
    await roof.note(
      "Roof repaired. The ceiling needs repainting once it has dried out.",
    );
    at(60, "17:35");
    const invoice = await roof.add("Send the final invoice to the insurer");
    await roof.add("Repaint the bedroom ceiling", daysAgo(-7, "00:00"));
    at(41, "20:00");
    await roof.complete(invoice);
    at(30, "13:00");
    await roof.note(
      "The insurer paid out. The ceiling stain is still there; waiting for a dry week to paint.",
    );
    // Deleting a Note writes nothing to the log.
    at(10, "10:00");
    await roof.deleteNote(draftNote);
    if (photosNote !== undefined) await roof.deleteNote(photosNote);

    // 4. A job change: a dense burst, then resolved with a note.
    at(40, "18:00");
    const job = await story({
      title: "Starting the new job",
      areaId: area("Work"),
    });
    at(40, "18:05");
    await job.note(
      "Offer accepted. Start date in four weeks; the notice period is one month.",
    );
    at(40, "18:20");
    const notice = await job.add("Hand in my notice");
    const contract = await job.add("Sign the contract");
    const hr = await job.add("Send ID and bank details to HR");
    const handover = await job.add("Hand over the monthly reports");
    const laptop = await job.add("Return the old laptop");
    await job.add("Set up the pension transfer");
    at(39, "09:00");
    await job.complete(notice);
    at(39, "21:15");
    await job.complete(contract);
    at(38, "12:30");
    await job.complete(hr);
    at(38, "15:00");
    await job.note(
      "HR call: the first day starts at 9 with an induction. Bring photo ID.",
    );
    at(30, "16:20");
    await job.note("Handover meeting: two reports still to document.");
    at(20, "17:45");
    await job.complete(handover);
    at(13, "16:00");
    await job.complete(laptop);
    at(13, "18:30");
    await job.note("Last day. Lunch with the team and a leaving card.");
    at(13, "18:40");
    await job.resolve();
    at(12, "19:05");
    await job.reopen();
    at(12, "19:10");
    await job.note(
      "First day done. The laptop arrives tomorrow; a buddy is assigned for the first month.",
    );
    at(6, "20:00");
    await job.resolve(
      "Settled in. The pension transfer can wait until the probation review; nothing else to do here.",
    );

    // 5. A check-up every six months, for two years.
    at(735, "09:00");
    const dental = await story({
      title: "Dental check-up",
      areaId: area("Health"),
    });
    const checkup = await dental.add("Dental check-up", daysAgo(730, "10:00"), {
      kind: "days",
      every: 182,
    });
    for (const [days, note] of [
      [730, "All fine. The hygienist next time."],
      [548, undefined],
      [366, "A small filling on the upper right, done the same day."],
      [184, undefined],
    ] as const) {
      at(days, "11:00");
      await dental.complete(checkup, note);
    }

    // 6. A pet's daily medication: every day for two months, one day missed.
    at(62, "19:00");
    const cat = await story({ title: "The cat's daily tablet" });
    const tablet = await cat.add("Evening tablet", daysAgo(61, "20:00"), {
      kind: "days",
      every: 1,
    });
    for (let days = 61; days >= 1; days--) {
      if (days === 44) continue;
      at(days, "20:10");
      // The day after the missed one, the late tablet moves to today.
      if (days === 43) await cat.setDate(tablet, daysAgo(43, "20:00"));
      await cat.complete(
        tablet,
        days === 30
          ? "Vet check: kidney values are stable. Keep the same dose."
          : undefined,
      );
    }

    // 7. Someday: started, and nothing else.
    at(200, "22:00");
    await story({ title: "Learn piano, someday" });
  } finally {
    back();
  }
}

/** The commands one Thread's story is told with, keeping its latest state. */
function threadStory(client: ApplicationClient, created: Thread) {
  let thread = created;
  const threadId = thread._id;
  return {
    async add(text: string, date?: number, repeat?: Repeat) {
      const taskId = newRecordId() as TaskId;
      thread = must(
        await client.addTask({
          threadId,
          taskId,
          text,
          ...(date === undefined ? {} : { date }),
        }),
      );
      if (repeat !== undefined) {
        thread = must(
          await client.setTaskRepeat({ threadId, taskId, repeat, timeZone }),
        );
      }
      return taskId;
    },
    /** Returns the Note written with the completion, if any. */
    async complete(taskId: TaskId, note?: string) {
      const task = thread.tasks?.find((each) => each._id === taskId);
      const written =
        note === undefined
          ? undefined
          : { id: newRecordId() as ThreadNoteId, body: note };
      thread = must(
        await client.completeTask({
          threadId,
          taskId,
          expectedOccurrence: task?.date ?? null,
          timeZone,
          ...(written === undefined ? {} : { note: written }),
        }),
      );
      return written?.id;
    },
    async setDate(taskId: TaskId, date: number) {
      thread = must(
        await client.setTaskDate({ threadId, taskId, date, timeZone }),
      );
    },
    async remove(taskId: TaskId) {
      thread = must(await client.removeTask({ threadId, taskId }));
    },
    async note(body: string) {
      return must(await client.createThreadNote({ threadId, body }))._id;
    },
    async deleteNote(threadNoteId: ThreadNoteId) {
      must(await client.removeThreadNote({ threadNoteId }));
    },
    async resolve(resolutionNote?: string) {
      thread = must(
        await client.updateThread({
          threadId,
          state: "resolved",
          ...(resolutionNote === undefined ? {} : { resolutionNote }),
        }),
      );
    },
    async reopen() {
      thread = must(await client.updateThread({ threadId, state: "open" }));
    },
    async setArea(areaId: AreaId) {
      thread = must(await client.updateThread({ threadId, areaId }));
    },
  };
}

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
 * Notes that never ask: facts and lists kept to look up, beside two undated
 * to-dos that the rule would take off All, and the sample's dated Notes.
 */
function infoNotesLife(): Life {
  return {
    ...SAMPLE,
    notes: [
      ...SAMPLE.notes,
      {
        body: "Car\n\n- Tyres: 205/55 R16\n- Oil: 5W-30, 4.2 litres\n- Last service at 48,000 km",
      },
      {
        body: "Gift ideas\n\n- A good kitchen knife\n- Concert tickets\n- Framed photo from the trip",
      },
      { body: "Clinic opens 8:00 to 14:00 on weekdays, closed on holidays" },
      {
        body: "Films people recommended: Perfect Days, Past Lives, Aftersun",
      },
      {
        body: "Router admin is at 192.168.1.1, login on the sticker underneath",
      },
      {
        body: "Cat food: the salmon one, half a pouch morning and evening",
      },
      {
        body: "Idea: a shelf above the desk would free the whole left side",
      },
      { body: "Passport number and expiry are in the blue folder" },
      { body: "Buy batteries for the smoke alarm" },
      { body: "Call the bank about the card limit" },
      { body: "Water the plants", inDays: 2 },
      { body: "Return the library books", inDays: -1 },
    ],
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
