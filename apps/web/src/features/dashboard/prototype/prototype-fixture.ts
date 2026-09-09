/**
 * PROTOTYPE — issue #314. Throwaway; do not import from production code.
 *
 * A fixed cast of Areas, Threads and standalone Notes that covers every
 * temporal case the comparison has to show: overdue, today, near-term future,
 * distant future, undated Threads with Next Moves, plain open Threads, and
 * dated Notes returning to attention. Dates are relative to the clock so the
 * fixture never goes stale.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";

import { DAY, startOfLocalDay } from "../components/dashboard-model";

const day = (currentDate: number, offset: number, hour = 9) =>
  startOfLocalDay(currentDate) + offset * DAY + hour * 60 * 60 * 1000;

export interface PrototypeData {
  areas: DashboardArea[];
  notes: DashboardInboxNote[];
  threads: DashboardThread[];
}

export function buildPrototypeData(currentDate: number): PrototypeData {
  const areas: DashboardArea[] = [
    {
      id: "area-health",
      name: "Health",
      slug: "health",
      condition: "critical",
      icon: "HeartPulse",
      order: 0,
      standard: "Move daily, sleep before midnight.",
    },
    {
      id: "area-work",
      name: "Work",
      slug: "work",
      condition: "needs_attention",
      icon: "BriefcaseBusiness",
      order: 1,
      standard: "No thread silent for more than a week.",
    },
    {
      id: "area-home",
      name: "Home",
      slug: "home",
      condition: "needs_attention",
      icon: "Home",
      order: 2,
    },
    {
      id: "area-money",
      name: "Money",
      slug: "money",
      condition: "healthy",
      icon: "WalletCards",
      order: 3,
    },
    {
      id: "area-people",
      name: "People",
      slug: "people",
      condition: "healthy",
      icon: "Users",
      order: 4,
    },
  ];

  const threads: DashboardThread[] = [
    // Overdue
    {
      id: "t-overdue-1",
      title: "Dentist follow-up appointment",
      slug: "dentist-follow-up",
      areaId: "area-health",
      followUp: day(currentDate, -6),
      nextMove: "Call the clinic and book the crown fitting",
      lastActivityAt: day(currentDate, -12),
      lastActivityContent: "Left a voicemail, no callback yet",
      order: 0,
    },
    {
      id: "t-overdue-2",
      title: "Q3 budget sign-off",
      slug: "q3-budget-sign-off",
      areaId: "area-work",
      followUp: day(currentDate, -2),
      nextMove: "Send the revised sheet to Finance",
      summary: "Finance blocked on two line items in the contractor budget.",
      lastActivityAt: day(currentDate, -3),
      lastActivityContent: "Finance asked for the contractor breakdown",
      order: 1,
    },
    // Today
    {
      id: "t-today-1",
      title: "Landlord lease renewal",
      slug: "landlord-lease-renewal",
      areaId: "area-home",
      followUp: day(currentDate, 0, 17),
      nextMove: "Reply with the counter-offer before 5pm",
      lastActivityAt: day(currentDate, -1),
      lastActivityContent: "Landlord proposed +8%",
      order: 2,
    },
    {
      id: "t-today-2",
      title: "Standup notes for the platform migration",
      slug: "platform-migration",
      areaId: "area-work",
      followUp: day(currentDate, 0, 11),
      summary: "Migration is on step 4 of 7; staging cut over last night.",
      lastActivityAt: day(currentDate, 0, 8),
      lastActivityContent: "Staging cutover finished cleanly",
      order: 3,
    },
    // Near-term future (1-6 days)
    {
      id: "t-near-1",
      title: "Blood test results review",
      slug: "blood-test-results",
      areaId: "area-health",
      followUp: day(currentDate, 1),
      nextMove: "Read the panel and flag anything for the GP",
      order: 4,
    },
    {
      id: "t-near-2",
      title: "Team offsite agenda",
      slug: "team-offsite-agenda",
      areaId: "area-work",
      followUp: day(currentDate, 4),
      nextMove: "Draft the three sessions and circulate",
      lastActivityAt: day(currentDate, -2),
      lastActivityContent: "Venue confirmed for the 14th",
      order: 5,
    },
    {
      id: "t-near-3",
      title: "Boiler service booking",
      slug: "boiler-service",
      areaId: "area-home",
      followUp: day(currentDate, 6),
      order: 6,
    },
    // Distant future (10+ days)
    {
      id: "t-far-1",
      title: "Annual insurance renewal",
      slug: "insurance-renewal",
      areaId: "area-money",
      followUp: day(currentDate, 12),
      nextMove: "Compare three quotes before auto-renew",
      order: 7,
    },
    {
      id: "t-far-2",
      title: "Passport expires — start renewal",
      slug: "passport-renewal",
      areaId: "area-people",
      followUp: day(currentDate, 27),
      order: 8,
    },
    {
      id: "t-far-3",
      title: "Tax return documents",
      slug: "tax-return-documents",
      areaId: "area-money",
      followUp: day(currentDate, 45),
      nextMove: "Collect receipts from the shoebox",
      order: 9,
    },
    // Undated, with a Next Move (actionable now)
    {
      id: "t-move-1",
      title: "Physio exercise routine",
      slug: "physio-routine",
      areaId: "area-health",
      nextMove: "Do the 15-minute shoulder set",
      lastActivityAt: day(currentDate, -9),
      lastActivityContent: "Skipped three days running",
      order: 10,
    },
    {
      id: "t-move-2",
      title: "Hiring: senior backend role",
      slug: "hiring-senior-backend",
      areaId: "area-work",
      nextMove: "Score the four take-home submissions",
      summary: "Four candidates through to take-home; two strong.",
      lastActivityAt: day(currentDate, -1),
      lastActivityContent: "Fourth submission arrived",
      order: 11,
    },
    {
      id: "t-move-3",
      title: "Kitchen shelf replacement",
      slug: "kitchen-shelf",
      areaId: "area-home",
      nextMove: "Measure the alcove and order the bracket",
      lastActivityAt: day(currentDate, -16),
      lastActivityContent: "Old shelf came down",
      order: 12,
    },
    {
      id: "t-move-4",
      title: "Mum's birthday plan",
      slug: "mums-birthday",
      areaId: "area-people",
      nextMove: "Ask Sara whether the weekend of the 20th works",
      order: 13,
    },
    // Plain open Threads
    {
      id: "t-open-1",
      title: "Marathon training block",
      slug: "marathon-training",
      areaId: "area-health",
      summary: "Week 6 of 16. Long run creeping up to 28km.",
      lastActivityAt: day(currentDate, -2),
      lastActivityContent: "18km at an easy pace",
      order: 14,
    },
    {
      id: "t-open-2",
      title: "Design system rollout",
      slug: "design-system-rollout",
      areaId: "area-work",
      summary: "Three of eleven surfaces migrated.",
      lastActivityAt: day(currentDate, -11),
      lastActivityContent: "Settings screen migrated",
      order: 15,
    },
    {
      id: "t-open-3",
      title: "Garden replanting",
      slug: "garden-replanting",
      areaId: "area-home",
      lastActivityAt: day(currentDate, -23),
      lastActivityContent: "Cleared the back bed",
      order: 16,
    },
    {
      id: "t-open-4",
      title: "Pension contribution review",
      slug: "pension-review",
      areaId: "area-money",
      summary: "Contribution rate unchanged since 2023.",
      order: 17,
    },
    {
      id: "t-open-5",
      title: "Book club",
      slug: "book-club",
      areaId: "area-people",
      lastActivityAt: day(currentDate, -4),
      lastActivityContent: "Picked the next book",
      order: 18,
    },
  ];

  const notes: DashboardInboxNote[] = [
    {
      id: "n-overdue-1",
      body: "Chase the pharmacy about the repeat prescription",
      when: day(currentDate, -4),
      createdAt: day(currentDate, -10),
    },
    {
      id: "n-overdue-2",
      body: "Cancel the unused streaming subscription",
      when: day(currentDate, -1),
      createdAt: day(currentDate, -8),
    },
    {
      id: "n-today-1",
      body: "Water the plants before the trip",
      when: day(currentDate, 0),
      createdAt: day(currentDate, -3),
    },
    {
      id: "n-near-1",
      body: "Ask about the cycle-to-work scheme",
      when: day(currentDate, 3),
      createdAt: day(currentDate, -5),
    },
    {
      id: "n-far-1",
      body: "Check whether the festival tickets went on sale",
      when: day(currentDate, 21),
      createdAt: day(currentDate, -2),
    },
    {
      id: "n-undated-1",
      body: "Idea: a weekly review ritual on Sunday evenings",
      createdAt: day(currentDate, -1),
    },
    {
      id: "n-undated-2",
      body: "The espresso machine makes a new noise",
      createdAt: day(currentDate, -6),
    },
  ];

  return { areas, threads, notes };
}
