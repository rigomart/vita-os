import { groupThreadsByAttentionState } from "@/features/dashboard/attention-state";
import { AttentionList, type AttentionListItem } from "./attention-list";

interface AttentionSectionProps {
  currentDate: number;
  threads: AttentionListItem[];
}

const groups = [
  { key: "followUpDue", title: "Follow-up Due", tone: "due" },
  { key: "scheduled", title: "Scheduled", tone: "scheduled" },
  { key: "ready", title: "Ready", tone: "ready" },
  { key: "open", title: "Open", tone: "open" },
] as const;

export function AttentionSection({
  currentDate,
  threads,
}: AttentionSectionProps) {
  const groupedThreads = groupThreadsByAttentionState({
    currentDate,
    threads,
  });

  if (
    groupedThreads.followUpDue.length === 0 &&
    groupedThreads.scheduled.length === 0 &&
    groupedThreads.ready.length === 0 &&
    groupedThreads.open.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <AttentionList
          key={group.key}
          title={group.title}
          tone={group.tone}
          items={groupedThreads[group.key]}
        />
      ))}
    </div>
  );
}
