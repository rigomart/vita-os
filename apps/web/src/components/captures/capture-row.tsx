import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface CaptureRowProps {
  capture: Doc<"captures">;
  onProcess?: (capture: Doc<"captures">) => void;
}

export function CaptureRow({ capture, onProcess }: CaptureRowProps) {
  const removeCapture = useMutation(api.captures.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.captures.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.captures.list,
          {},
          current.filter((c) => c._id !== args.id),
        );
      }

      const count = localStore.getQuery(api.captures.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.captures.count, {}, Math.max(0, count - 1));
      }
    },
  );

  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl">
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {capture.text}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(capture.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onProcess && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onProcess(capture)}
            aria-label="Process capture"
          >
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Discard capture"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard capture?</AlertDialogTitle>
              <AlertDialogDescription>
                This capture will be permanently deleted. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeCapture({ id: capture._id })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
