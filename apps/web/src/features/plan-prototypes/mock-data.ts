import type { AreaIcon } from "@convex/lib/areaIcons";
import type { Condition } from "@convex/lib/condition";

/**
 * Shared mock dataset for the Plan view design exploration.
 *
 * Every prototype in `registry.tsx` reads from this file so the explorations
 * stay comparable. Timestamps are derived from {@link NOW}, which is evaluated
 * once at module load, so the follow-up buckets (overdue / today / tomorrow /
 * this weekend / next week / later) stay populated whenever the harness runs.
 */

/** Mirrors `DashboardArea` from `@/features/dashboard/components/dashboard-model`. */
export interface MockArea {
  condition: Condition;
  icon: AreaIcon;
  id: string;
  name: string;
  order: number;
  slug: string;
}

/** Mirrors `DashboardThread`, plus the most recent Activity Log entry. */
export interface MockThread {
  areaId: string;
  followUp?: number;
  id: string;
  lastActivity?: MockActivity;
  nextMove?: string;
  order: number;
  slug: string;
  summary?: string;
  title: string;
}

export interface MockActivity {
  content: string;
  createdAt: number;
}

/** Mirrors `DashboardInboxTask`. Tasks belong to no Area and no Thread. */
export interface MockTask {
  createdAt: number;
  id: string;
  text: string;
  when?: number;
}

export const DAY = 24 * 60 * 60 * 1000;

/** Evaluated once, at module load. Treat this as "today" in every prototype. */
export const NOW = Date.now();

const today = new Date(NOW);

/** Local-day timestamp `offset` days from today, at `hour` local time. */
function dayOffset(offset: number, hour = 9): number {
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + offset,
    hour,
  ).getTime();
}

/** Timestamp `days` days in the past, keeping the current time of day. */
function daysAgo(days: number, hour = 11): number {
  return dayOffset(-days, hour);
}

/** The next occurrence of `weekday` (0 = Sunday) strictly after today. */
function nextWeekday(weekday: number, hour = 10): number {
  const offset = (weekday - today.getDay() + 7) % 7 || 7;
  return dayOffset(offset, hour);
}

const SATURDAY = 6;
const MONDAY = 1;

/** The upcoming Saturday. */
const thisWeekend = nextWeekday(SATURDAY, 10);
/** The Monday that opens next week, and the two days after it. */
const nextMonday = nextWeekday(MONDAY, 9);
const nextTuesday = nextMonday + DAY;
const nextThursday = nextMonday + 3 * DAY;

export const mockAreas: MockArea[] = [
  {
    id: "area_family_health",
    name: "Family Health",
    slug: "family-health",
    icon: "HeartPulse",
    condition: "critical",
    order: 0,
  },
  {
    id: "area_career",
    name: "Career",
    slug: "career",
    icon: "BriefcaseBusiness",
    condition: "needs_attention",
    order: 1,
  },
  {
    id: "area_finances",
    name: "Finances",
    slug: "finances",
    icon: "WalletCards",
    condition: "needs_attention",
    order: 2,
  },
  {
    id: "area_home",
    name: "Home",
    slug: "home",
    icon: "Home",
    condition: "healthy",
    order: 3,
  },
  {
    id: "area_friends_social",
    name: "Friends & Social",
    slug: "friends-social",
    icon: "Users",
    condition: "healthy",
    order: 4,
  },
  {
    id: "area_personal_growth",
    name: "Personal Growth",
    slug: "personal-growth",
    icon: "BookOpen",
    condition: "healthy",
    order: 5,
  },
  {
    id: "area_administrative",
    name: "Administrative",
    slug: "administrative",
    icon: "Shield",
    condition: "healthy",
    order: 6,
  },
];

export const mockThreads: MockThread[] = [
  // --- Family Health (7) ---------------------------------------------------
  {
    id: "thread_mom_knee",
    areaId: "area_family_health",
    title: "Mom's knee surgery recovery",
    slug: "moms-knee-surgery-recovery",
    order: 0,
    summary:
      "Replacement went fine. She's home, walking with the frame, and doing physio twice a week — the second slot keeps getting cancelled.",
    nextMove: "Call the PT clinic about a standing Thursday slot",
    followUp: daysAgo(2),
    lastActivity: {
      content: "She managed the stairs on her own for the first time.",
      createdAt: daysAgo(1, 20),
    },
  },
  {
    id: "thread_dad_cardiology",
    areaId: "area_family_health",
    title: "Dad's cardiology follow-up",
    slug: "dads-cardiology-follow-up",
    order: 1,
    summary:
      "Cardiologist wants a stress test before touching the beta blocker dose. Dad keeps saying he feels fine.",
    nextMove: "Book the stress test at St. Anne's",
    followUp: daysAgo(5),
    lastActivity: {
      content: "Left a message with the referrals desk, no callback yet.",
      createdAt: daysAgo(4, 15),
    },
  },
  {
    id: "thread_leo_inhaler",
    areaId: "area_family_health",
    title: "Leo's asthma inhaler refill",
    slug: "leos-asthma-inhaler-refill",
    order: 2,
    summary: "Down to one spare canister and the school needs its own.",
    nextMove: "Ask the pediatrician for a 90-day script",
    followUp: dayOffset(0, 17),
    lastActivity: {
      content: "School nurse asked again for a labelled spare.",
      createdAt: daysAgo(3, 9),
    },
  },
  {
    id: "thread_family_dental",
    areaId: "area_family_health",
    title: "Family dental checkups",
    slug: "family-dental-checkups",
    order: 3,
    summary: "Everyone is roughly a year overdue.",
    nextMove: "Book both kids into the same afternoon slot",
    followUp: dayOffset(3),
  },
  {
    id: "thread_annual_physical",
    areaId: "area_family_health",
    title: "My own annual physical",
    slug: "my-own-annual-physical",
    order: 4,
    summary: "Skipped last year. The old practice dropped me when they merged.",
    nextMove: "Find a GP taking new patients near the office",
  },
  {
    id: "thread_mom_home_care",
    areaId: "area_family_health",
    title: "Sort out Mom's home care hours",
    slug: "sort-out-moms-home-care-hours",
    order: 5,
    summary:
      "Insurance covers eight hours a week; realistically she needs closer to fifteen while the knee settles.",
    nextMove: "Get the case manager on the phone with the insurer",
    followUp: nextMonday,
    lastActivity: {
      content: "Found the policy number in the folder in the hall cupboard.",
      createdAt: daysAgo(6, 19),
    },
  },
  {
    id: "thread_grandpa_hearing",
    areaId: "area_family_health",
    title: "Grandpa's hearing aid fitting",
    slug: "grandpas-hearing-aid-fitting",
    order: 6,
  },

  // --- Career (5) ----------------------------------------------------------
  {
    id: "thread_salary_review",
    areaId: "area_career",
    title: "Negotiate salary review",
    slug: "negotiate-salary-review",
    order: 0,
    summary:
      "Review window closes at the end of the month. Two people on the team moved up a band last cycle and I didn't ask.",
    nextMove: "Draft the impact doc with the Q2 numbers in it",
    followUp: dayOffset(1),
    lastActivity: {
      content: "Pulled the incident-response metrics from the old dashboard.",
      createdAt: daysAgo(2, 16),
    },
  },
  {
    id: "thread_platform_migration",
    areaId: "area_career",
    title: "Platform migration project",
    slug: "platform-migration-project",
    order: 1,
    summary:
      "I own the cutover plan. Two teams still haven't given me their dependency lists.",
    nextMove: "Chase the two missing dependency lists",
    followUp: dayOffset(2),
  },
  {
    id: "thread_mentoring_priya",
    areaId: "area_career",
    title: "Mentoring Priya",
    slug: "mentoring-priya",
    order: 2,
    summary:
      "Every other Wednesday. She's aiming at a senior packet in the spring.",
    nextMove: "Read her design doc before the next session",
  },
  {
    id: "thread_staff_track",
    areaId: "area_career",
    title: "Decide on the staff engineer track",
    slug: "decide-on-the-staff-engineer-track",
    order: 3,
    summary:
      "Manager asked whether I want the management track instead. I keep deferring the answer.",
    nextMove: "Write out what I actually want from the next two years",
  },
  {
    id: "thread_conference_talk",
    areaId: "area_career",
    title: "Conference talk proposal",
    slug: "conference-talk-proposal",
    order: 4,
    summary: "CFP closes in about three weeks.",
    nextMove: "Outline the three case studies",
    followUp: dayOffset(16),
  },

  // --- Finances (4) --------------------------------------------------------
  {
    id: "thread_gym_charge",
    areaId: "area_finances",
    title: "Dispute the duplicate gym charge",
    slug: "dispute-the-duplicate-gym-charge",
    order: 0,
    summary:
      "Charged twice in June and again in July. The 60-day window is closing.",
    nextMove: "Call the billing line with both statement lines to hand",
    followUp: daysAgo(9),
    lastActivity: {
      content: "Screenshotted both statements into the folder.",
      createdAt: daysAgo(11, 21),
    },
  },
  {
    id: "thread_rebalance_retirement",
    areaId: "area_finances",
    title: "Rebalance the retirement accounts",
    slug: "rebalance-the-retirement-accounts",
    order: 1,
    summary: "Drifted to roughly 82% equities after the run-up. Target is 70%.",
    nextMove: "Move the old employer account into the low-cost index fund",
    followUp: nextTuesday,
  },
  {
    id: "thread_emergency_fund",
    areaId: "area_finances",
    title: "Emergency fund top-up",
    slug: "emergency-fund-top-up",
    order: 2,
    summary:
      "Sits at about four months of expenses. The boiler and the car both feel due.",
  },
  {
    id: "thread_mortgage_refinance",
    areaId: "area_finances",
    title: "Mortgage refinance math",
    slug: "mortgage-refinance-math",
    order: 3,
    summary:
      "Rates are close to where refinancing breaks even inside two years. Worth an evening with a spreadsheet.",
    nextMove: "Pull three rate quotes and compare against the break-even",
    followUp: dayOffset(25),
  },

  // --- Home (4) ------------------------------------------------------------
  {
    id: "thread_faucet_leak",
    areaId: "area_home",
    title: "Kitchen faucet leak",
    slug: "kitchen-faucet-leak",
    order: 0,
    summary: "Slow drip under the sink. The cabinet base is starting to swell.",
    nextMove: "Pick up the replacement cartridge at the hardware store",
    followUp: dayOffset(0, 18),
    lastActivity: {
      content: "Put a towel and a tray under it as a stopgap.",
      createdAt: daysAgo(2, 8),
    },
  },
  {
    id: "thread_boiler_service",
    areaId: "area_home",
    title: "Winter boiler service",
    slug: "winter-boiler-service",
    order: 1,
    summary: "Annual service, and the pressure has been dropping again.",
    nextMove: "Book the engineer before the autumn rush",
    followUp: dayOffset(4),
  },
  {
    id: "thread_garage_clear_out",
    areaId: "area_home",
    title: "Garage clear-out",
    slug: "garage-clear-out",
    order: 2,
  },
  {
    id: "thread_repaint_hallway",
    areaId: "area_home",
    title: "Repaint the hallway",
    slug: "repaint-the-hallway",
    order: 3,
    summary: "Scuffed badly along the stairs since the move.",
    nextMove: "Put colour samples on the wall and live with them a week",
  },

  // --- Friends & Social (3) ------------------------------------------------
  {
    id: "thread_sam_fortieth",
    areaId: "area_friends_social",
    title: "Sam's 40th in October",
    slug: "sams-40th-in-october",
    order: 0,
    summary:
      "Eight of us, a cabin, one weekend. Nobody has actually booked anything.",
    nextMove: "Get a yes or no from the group on the cabin",
    followUp: thisWeekend,
    lastActivity: {
      content: "Shared the two cabin options in the group chat.",
      createdAt: daysAgo(5, 22),
    },
  },
  {
    id: "thread_reconnect_nadia",
    areaId: "area_friends_social",
    title: "Reconnect with Nadia",
    slug: "reconnect-with-nadia",
    order: 1,
    summary: "Six months of near-misses since she moved back.",
    nextMove: "Send the voice note I keep re-recording",
  },
  {
    id: "thread_dinner_club",
    areaId: "area_friends_social",
    title: "Monthly dinner club",
    slug: "monthly-dinner-club",
    order: 2,
    summary: "My turn to host. Six people, one of them vegetarian.",
    followUp: dayOffset(1, 18),
  },

  // --- Personal Growth (2) -------------------------------------------------
  {
    id: "thread_swimming",
    areaId: "area_personal_growth",
    title: "Get back to swimming twice a week",
    slug: "get-back-to-swimming-twice-a-week",
    order: 0,
    summary: "Managed it for a month in spring and then the pool closed.",
    nextMove: "Buy a ten-visit pass so it's already paid for",
    followUp: dayOffset(1, 7),
  },
  {
    id: "thread_spanish_b1",
    areaId: "area_personal_growth",
    title: "Spanish to B1 before the trip",
    slug: "spanish-to-b1-before-the-trip",
    order: 1,
    summary:
      "Fifteen minutes a day plus a conversation hour on Sundays. The conversation hour is the part that slips.",
    followUp: nextThursday,
    lastActivity: {
      content: "Eleven-day streak on the app, no speaking practice yet.",
      createdAt: daysAgo(1, 7),
    },
  },

  // --- Administrative (1) --------------------------------------------------
  {
    id: "thread_passport_renewal",
    areaId: "area_administrative",
    title: "Passport renewal",
    slug: "passport-renewal",
    order: 0,
    summary:
      "Expires inside six months, which several countries won't accept. Processing is running long.",
    nextMove: "Get the photos taken and start the online form",
    followUp: thisWeekend,
  },
];

export const mockTasks: MockTask[] = [
  {
    id: "task_sam_card",
    text: "Buy a card for Sam's birthday",
    createdAt: daysAgo(1, 13),
    when: dayOffset(2, 12),
  },
  {
    id: "task_cancel_streaming",
    text: "Cancel the second streaming subscription",
    createdAt: daysAgo(3, 22),
    when: dayOffset(0, 20),
  },
  {
    id: "task_library_books",
    text: "Return the library books",
    createdAt: daysAgo(2, 9),
    when: dayOffset(1, 17),
  },
  {
    id: "task_roofer_number",
    text: "Ask Tom for the roofer's number",
    createdAt: daysAgo(4, 18),
    when: dayOffset(4, 10),
  },
  {
    id: "task_espresso_receipt",
    text: "Find the receipt for the espresso machine",
    createdAt: daysAgo(6, 20),
  },
  {
    id: "task_sleep_podcast",
    text: "Look up that podcast episode about sleep debt",
    createdAt: daysAgo(8, 23),
  },
  {
    id: "task_parking_permit",
    text: "Renew the residents' parking permit",
    createdAt: daysAgo(5, 12),
  },
  {
    id: "task_photo_frames",
    text: "Pick a frame for the print in the hall",
    createdAt: daysAgo(9, 16),
  },
];

/** Convenience lookup, since every prototype needs the Area behind a Thread. */
export const mockAreaById: ReadonlyMap<string, MockArea> = new Map(
  mockAreas.map((area) => [area.id, area]),
);

/** Threads grouped by Area, in Area order then Thread order. */
export function threadsByArea(): { area: MockArea; threads: MockThread[] }[] {
  return mockAreas.map((area) => ({
    area,
    threads: mockThreads.filter((thread) => thread.areaId === area.id),
  }));
}
