import { formatDistanceToNow } from "date-fns";
import { Check } from "lucide-react";
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
    <div className="mb-6 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isOverdue ? "bg-amber-500" : "bg-green-500"
        }`}
        role="img"
        aria-label={isOverdue ? "Review overdue" : "Up to date"}
      />
      <span className="text-muted-foreground">
        {lastReviewDate
          ? `Last reviewed ${formatDistanceToNow(new Date(lastReviewDate), { addSuffix: true })}`
          : "Never reviewed"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs"
        onClick={onMarkReviewed}
      >
        <Check className="h-3 w-3" />
        Mark reviewed
      </Button>
    </div>
  );
}
