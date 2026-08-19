import { Calendar } from "@vita-os/ui/components/calendar";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { startOfDay } from "date-fns";

/**
 * The Later bucket's calendar — a drop on the bucket opens it instead of
 * writing a date, because the bucket stands for every day the axis does not
 * draw.
 *
 * Picking a day writes it and closes; closing any other way writes nothing.
 * The past is disabled — the Waiting bay shows debts, it does not take new
 * plans — and there is no forward limit.
 */
interface PlanLaterDialogProps {
  /** The dropped item's current date, preselected when it has one. */
  at?: number;
  /** What the pick will do, e.g. the item's title. */
  hint: string;
  now: number;
  onOpenChange: (open: boolean) => void;
  /** A confirmed day, at local midnight. */
  onPick: (at: number) => void;
  open: boolean;
}

export function PlanLaterDialog({
  at,
  hint,
  now,
  onOpenChange,
  onPick,
  open,
}: PlanLaterDialogProps) {
  const today = startOfDay(new Date(now));
  // A Waiting chip arrives with a past date: preselecting it would open the
  // calendar on a month where every day is disabled.
  const preselected =
    at == null || at < today.getTime() ? undefined : new Date(at);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="w-fit min-w-0">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Pick a day</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{hint}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Calendar
          mode="single"
          selected={preselected}
          defaultMonth={preselected}
          disabled={{ before: today }}
          // The clicked day, not the selection: re-picking the preselected day
          // is a confirmation, where the selection would toggle to nothing.
          onSelect={(_, day) => onPick(day.getTime())}
          className="mx-auto"
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
