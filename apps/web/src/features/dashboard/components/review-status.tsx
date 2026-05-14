import { Button } from "@vita-os/ui/components/button";
import { formatDistanceToNow } from "date-fns";
import { Check, Clock } from "lucide-react";

interface ReviewStatusProps {
  lastReviewDate: number | null;
  onMarkReviewed: () => void;
}

export function ReviewStatus({
  lastReviewDate,
  onMarkReviewed,
}: ReviewStatusProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
