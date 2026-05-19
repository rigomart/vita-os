import type { Doc } from "@convex/_generated/dataModel";
import {
  CONDITION_OPTIONS,
  conditionColors,
  isCondition,
} from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
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
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";

interface AreaHeaderProps {
  area: Doc<"areas">;
  projectCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onConditionChange: (value: Doc<"areas">["healthStatus"]) => void;
}

export function AreaHeader({
  area,
  projectCount,
  onEdit,
  onDelete,
  onConditionChange,
}: AreaHeaderProps) {
  return (
    <div>
      <Link
        to="/"
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Dashboard
        <ChevronRight className="h-3 w-3" />
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{area.name}</h1>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${conditionColors[area.healthStatus]}`}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label="Edit area"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete area"
                />
              }
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete area?</AlertDialogTitle>
                <AlertDialogDescription>
                  This area and its data will be permanently deleted. Move or
                  delete all threads first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Select
          value={area.healthStatus}
          onValueChange={(value) => {
            if (isCondition(value)) onConditionChange(value);
          }}
        >
          <SelectTrigger
            className="h-7 w-auto gap-2 border-none bg-surface-3/60 px-3 text-xs"
            aria-label="Area condition"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${option.color}`} />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {projectCount} {projectCount === 1 ? "thread" : "threads"}
        </span>
      </div>
    </div>
  );
}
