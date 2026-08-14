// PROTOTYPE — throwaway.
// "Briefing": the hero is prose — a greeting with the date, one sentence about
// which Areas need you (names as condition-coloured inline links), and a
// quieter follow-on line about the nearest Thread. No cards, pills or tiles.
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { format, formatDistance } from "date-fns";
import { Fragment } from "react";

import type {
  DashboardArea,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import type { DashboardHeroProps } from "@/features/dashboard/prototype/hero-contract";

import { conditionTextClassName } from "@/features/areas/condition-presentation";
import {
  followUpDateLabel,
  recentActivity,
  startOfLocalDay,
} from "@/features/dashboard/components/dashboard-model";
import { cn } from "@/lib/utils";

/** Past this many names the sentence would stop being a sentence. */
const MAX_NAMED_AREAS = 3;

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

function numberWord(count: number) {
  return NUMBER_WORDS[count] ?? String(count);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function byOrder(a: DashboardArea, b: DashboardArea) {
  return a.order - b.order;
}

type ThreadWithFollowUp = DashboardThread & { followUp: number };

function upcomingFollowUps(threads: DashboardThread[], currentDate: number) {
  const today = startOfLocalDay(currentDate);
  return threads
    .filter(
      (thread): thread is ThreadWithFollowUp =>
        thread.followUp !== undefined &&
        startOfLocalDay(thread.followUp) >= today,
    )
    .sort((a, b) => a.followUp - b.followUp);
}

/** "today" / "tomorrow" / "on Aug 20" — the tail of "… is due …". */
function dueWhen(timestamp: number, currentDate: number) {
  const label = followUpDateLabel(timestamp, currentDate);
  if (label === "Today") return "today";
  if (label === "Tomorrow") return "tomorrow";
  return `on ${label}`;
}

interface Piece {
  key: string;
  node: ReactNode;
}

/** Reads as a list: "A", "A and B", "A, B and C". */
function joinPieces(pieces: Piece[]) {
  return pieces.map((piece, index) => (
    <Fragment key={piece.key}>
      {index > 0 && (index === pieces.length - 1 ? " and " : ", ")}
      {piece.node}
    </Fragment>
  ));
}

function AreaLink({ area }: { area: DashboardArea }) {
  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      className={cn(
        "font-semibold underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70",
        conditionTextClassName[area.condition],
      )}
    >
      {area.name}
    </Link>
  );
}

function ThreadLink({ thread }: { thread: DashboardThread }) {
  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      className="font-medium text-foreground underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
    >
      {thread.title}
    </Link>
  );
}

export function HeroVariantBriefing({
  areas,
  threads,
  currentDate,
}: DashboardHeroProps) {
  const date = new Date(currentDate);

  const critical = areas
    .filter((area) => area.condition === "critical")
    .sort(byOrder);
  const attention = areas
    .filter((area) => area.condition === "needs_attention")
    .sort(byOrder);
  const steady = areas.filter((area) => area.condition === "healthy");
  // Worst first: the sentence names the loudest Areas before it runs out of room.
  const needing = [...critical, ...attention];

  const named = needing.slice(0, MAX_NAMED_AREAS);
  const unnamed = needing.length - named.length;
  const namePieces: Piece[] = named.map((area) => ({
    key: area.id,
    node: <AreaLink area={area} />,
  }));
  if (unnamed > 0) {
    namePieces.push({
      key: "rest",
      node: (
        <span className="text-muted-foreground">
          {numberWord(unnamed)} more
        </span>
      ),
    });
  }

  // A critical Area is addressed to you; a watch-list one only invites a look.
  const verb =
    critical.length > 0
      ? needing.length === 1
        ? "needs you"
        : "need you"
      : "could use a look";

  const steadyTail =
    steady.length === 0
      ? "."
      : steady.length === 1
        ? " — the one other is steady."
        : ` — the other ${numberWord(steady.length)} are steady.`;

  const nextFollowUps = upcomingFollowUps(threads, currentDate);
  const nextUp = nextFollowUps[0];
  const behind = nextFollowUps.length - 1;
  const lastTouched = recentActivity(threads, 1)[0];

  return (
    <section aria-label="Daily briefing" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {greetingFor(date)} —{" "}
        <time
          dateTime={date.toISOString()}
          title={format(date, "EEEE, MMMM d, yyyy")}
        >
          {format(date, "EEEE, MMMM d")}
        </time>
      </p>

      <h1 className="max-w-prose break-words font-heading text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl">
        {areas.length === 0 ? (
          <>Nothing in view yet — start with a Life Area.</>
        ) : needing.length === 0 ? (
          areas.length === 1 ? (
            <>Your one area is steady.</>
          ) : (
            <>All {numberWord(areas.length)} areas are steady.</>
          )
        ) : (
          <>
            {capitalize(numberWord(needing.length))}{" "}
            {needing.length === 1 ? "area" : "areas"} {verb} —{" "}
            {joinPieces(namePieces)}
            <span
              title={steady.map((area) => area.name).join(", ") || undefined}
            >
              {steadyTail}
            </span>
          </>
        )}
      </h1>

      {nextUp ? (
        <p className="max-w-prose break-words text-sm leading-relaxed text-muted-foreground">
          <ThreadLink thread={nextUp} /> is due{" "}
          {dueWhen(nextUp.followUp, currentDate)}
          {behind > 0 && `, with ${numberWord(behind)} more behind it`}.
        </p>
      ) : lastTouched ? (
        <p className="max-w-prose break-words text-sm leading-relaxed text-muted-foreground">
          Nothing is due. You last touched <ThreadLink thread={lastTouched} />,{" "}
          {formatDistance(new Date(lastTouched.lastActivityAt), date, {
            addSuffix: true,
          })}
          .
        </p>
      ) : null}
    </section>
  );
}
