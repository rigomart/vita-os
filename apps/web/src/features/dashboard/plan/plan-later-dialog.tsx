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
 * The Later bay's calendar — a drop on the bay opens it instead of writing a
 * date, because the bay stands for every day the axis does not draw.
 *
 * Picking a day writes it and closes; closing any other way writes nothing.
 * The past is disabled — the Waiting bay shows debts, it does not take new
 * plans — and there is no forward limit.
 */
interface PlanLaterDialogProps {
  /** The dropped item's current date, preselected when it has one. */
  at?: number;
  /** What the pick will do, e.g. the item's title and any Area move. */
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
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="w-fit min-w-0">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Pick a day</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{hint}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Calendar
          mode="single"
          selected={at == null ? undefined : new Date(at)}
          defaultMonth={at == null ? undefined : new Date(at)}
          disabled={{ before: startOfDay(new Date(now)) }}
          onSelect={(date) => {
            if (!date) return;
            onPick(date.getTime());
          }}
          className="mx-auto"
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
