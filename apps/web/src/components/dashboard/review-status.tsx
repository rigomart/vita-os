import { formatDistanceToNow } from "date-fns";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface ReviewStatusProps {
  lastReviewDate: number | null;
  onMarkReviewed: () => void;
}

export function ReviewStatus({
  lastReviewDate,
  onMarkReviewed,
}: ReviewStatusProps) {
  const isOverdue =
    !lastReviewDate || Date.now() - lastReviewDate >= SEVEN_DAYS_MS;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span
        className={`inline-flex h-1.5 w-1.5 rounded-full ${
          isOverdue ? "bg-amber-500" : "bg-green-500"
        }`}
        role="img"
        aria-label={isOverdue ? "Review overdue" : "Up to date"}
      />
      <Clock className="h-3.5 w-3.5" />
      <span>
        {lastReviewDate
          ? `Reviewed ${formatDistanceToNow(new Date(lastReviewDate), { addSuffix: true })}`
          : "Never reviewed"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs text-muted-foreground"
        onClick={onMarkReviewed}
      >
        <Check className="h-3 w-3" />
        Mark reviewed
      </Button>
    </div>
  );
}
