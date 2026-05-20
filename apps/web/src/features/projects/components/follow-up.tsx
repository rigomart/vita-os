import { DatePicker } from "@vita-os/ui/components/date-picker";
import { Bell } from "lucide-react";

interface FollowUpProps {
  followUp: number | undefined;
  onSet: (date: number) => void;
  onClear: () => void;
}

export function FollowUp({ followUp, onSet, onClear }: FollowUpProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Bell className="h-3.5 w-3.5" />
        Follow-up
      </div>

      <DatePicker
        value={followUp ? new Date(followUp) : undefined}
        onChange={(date) => {
          if (date) {
            onSet(date.getTime());
          } else {
            onClear();
          }
        }}
        placeholder="Add a follow-up..."
      />
    </div>
  );
}
