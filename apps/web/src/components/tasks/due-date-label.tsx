import { format, isToday, isTomorrow } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

export function DueDateLabel({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  let label: string;
  let className = "text-xs text-muted-foreground";

  if (isToday(date)) {
    label = "Today";
    className = "text-xs text-green-600";
  } else if (isTomorrow(date)) {
    label = "Tomorrow";
    className = "text-xs text-orange-600";
  } else if (date < new Date()) {
    label = format(date, "MMM d");
    className = "text-xs text-red-600";
  } else {
    label = format(date, "MMM d");
  }

  return (
    <div className="mt-0.5 flex items-center gap-1">
      <CalendarIcon className="h-3 w-3" />
      <span className={className}>{label}</span>
    </div>
  );
}
