import type { Doc } from "@convex/_generated/dataModel";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { Label } from "@vita-os/ui/components/label";
import { Textarea } from "@vita-os/ui/components/textarea";
import { CheckCircle2, Ellipsis, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

interface ThreadLifecycleMenuProps {
  thread: Doc<"threads">;
  onResolve: (resolutionNote?: string) => void;
  onReopen: () => void;
  onDelete: () => void;
  isResolving?: boolean;
  isReopening?: boolean;
  isDeleting?: boolean;
}

export function ThreadLifecycleMenu({
  thread,
  onResolve,
  onReopen,
  onDelete,
  isResolving = false,
  isReopening = false,
  isDeleting = false,
}: ThreadLifecycleMenuProps) {
  const [resolveOpen, setResolveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const isResolved = thread.state === "resolved";

  const handleResolve = () => {
    onResolve(resolutionNote.trim() || undefined);
    setResolveOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setDeleteOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Thread actions"
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {isResolved ? (
              <DropdownMenuItem disabled={isReopening} onClick={onReopen}>
                <RotateCcw />
                Reopen
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={isResolving}
                onClick={() => setResolveOpen(true)}
              >
                <CheckCircle2 />
                Resolve
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve thread?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{thread.title}&rdquo; will be marked as resolved. Its
              current Next Move and Follow-up will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resolution-note">Resolution note</Label>
            <Textarea
              id="resolution-note"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Add context..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResolving}
              aria-busy={isResolving}
              onClick={handleResolve}
            >
              Resolve thread
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{thread.title}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              aria-busy={isDeleting}
              onClick={handleDelete}
            >
              Delete thread
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
