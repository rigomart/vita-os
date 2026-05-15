import { api } from "@convex/_generated/api";
import {
  HEALTH_STATUS_OPTIONS,
  healthColors,
  isHealthStatus,
} from "@convex/lib/healthStatus";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import {
  optimisticallyRemoveArea,
  optimisticallyUpdateArea,
} from "@/features/areas/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

interface AreaHeaderProps {
  areaSlug: string;
  onEdit: () => void;
}

export function AreaHeader({ areaSlug, onEdit }: AreaHeaderProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const projects = useQuery(
    api.projects.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const navigate = useNavigate();
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args, { areaSlug });
    },
  );
  const removeArea = useMutation(api.areas.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveArea(localStore, args, { areaSlug });
    },
  );

  const handleDelete = async () => {
    if (!area) return;
    await removeArea({ id: area._id });
    navigate({ to: "/" });
  };

  const handleHealthChange = (value: string | null) => {
    if (!area || !isHealthStatus(value)) return;
    updateArea({ id: area._id, healthStatus: value });
  };

  if (!area) return null;

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
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthColors[area.healthStatus]}`}
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
                  delete all projects first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
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
        <Select value={area.healthStatus} onValueChange={handleHealthChange}>
          <SelectTrigger className="h-7 w-auto gap-2 border-none bg-surface-3/60 px-3 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEALTH_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {projects?.length ?? 0}{" "}
          {projects?.length === 1 ? "project" : "projects"}
        </span>
      </div>
    </div>
  );
}
