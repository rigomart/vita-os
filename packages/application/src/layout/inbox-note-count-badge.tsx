import { Badge } from "@vita-os/ui/components/badge";

interface InboxNoteCountBadgeProps {
  noteCount: number | undefined;
}

export function InboxNoteCountBadge({ noteCount }: InboxNoteCountBadgeProps) {
  if (noteCount === undefined || noteCount === 0) return null;

  return (
    <Badge
      variant="secondary"
      className="ml-auto h-5 min-w-5 justify-center px-1.5 text-2xs tabular-nums"
      aria-label={`${noteCount} Open ${noteCount === 1 ? "Note" : "Notes"}`}
    >
      {noteCount}
    </Badge>
  );
}
