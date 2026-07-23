import { DatePicker } from "@vita-os/ui/components/date-picker";
import { Bell } from "lucide-react";

interface FollowUpProps {
  followUp: number | undefined;
  onSet: (date: number) => void;
  onClear: () => void;
  isPending?: boolean;
}

export function FollowUp({
  followUp,
  onSet,
  onClear,
  isPending = false,
}: FollowUpProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Bell className="size-3.5" />
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
        disabled={isPending}
      />
    </div>
  );
}
