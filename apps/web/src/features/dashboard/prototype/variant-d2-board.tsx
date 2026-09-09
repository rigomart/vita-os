/**
 * PROTOTYPE — issue #314. D2: "Board" — kept from round 3 as the baseline,
 * with round 4's fix applied: the card now shows the Thread title with the
 * Next Move under it, instead of the move alone.
 *
 * It has no time axis at all. That is the point of keeping it: E2 is this
 * board plus a timeline, so the pair says exactly what the timeline buys.
 */
import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";

import { AttentionCard } from "./attention-card";
import { byAttention } from "./dense-shared";
import { areaMap, noteEntry, threadEntry } from "./prototype-shared";
import { StatStrip } from "./stat-strip";

export const variantD2Name = "Board (no time)";

export function VariantD2Board({
  areas,
  currentDate,
  notes,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  notes: DashboardInboxNote[];
  threads: DashboardThread[];
}) {
  const byArea = areaMap(areas);
  const entries = [
    ...threads.map((thread) => threadEntry(thread, byArea, currentDate)),
    ...notes.map(noteEntry),
  ].sort(byAttention(currentDate));

  return (
    <div className="flex flex-col gap-4">
      <StatStrip currentDate={currentDate} entries={entries} />

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {entries.map((entry) => (
          <li key={entry.id}>
            <AttentionCard currentDate={currentDate} entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}
