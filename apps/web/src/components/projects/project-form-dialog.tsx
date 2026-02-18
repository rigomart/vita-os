import type { Doc } from "@convex/_generated/dataModel";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { AreaPicker } from "@/components/areas/area-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    definitionOfDone?: string;
    areaId?: string;
    startDate?: number;
    endDate?: number;
  }) => void;
  project?: Doc<"projects">;
  areas?: Doc<"areas">[];
  defaultAreaId?: string;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  onSubmit,
  project,
  areas,
  defaultAreaId,
}: ProjectFormDialogProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [definitionOfDone, setDefinitionOfDone] = useState(
    project?.definitionOfDone ?? "",
  );
  const [areaId, setAreaId] = useState<string | undefined>(
    project?.areaId ?? defaultAreaId,
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    project?.startDate ? new Date(project.startDate) : undefined,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    project?.endDate ? new Date(project.endDate) : undefined,
  );

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (!date || (endDate && date > endDate)) {
      setEndDate(undefined);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onSubmit({
      name: trimmedName,
      description: description.trim() || undefined,
      definitionOfDone: definitionOfDone.trim() || undefined,
      areaId,
      startDate: startDate?.getTime(),
      endDate: endDate?.getTime(),
    });

    if (!project) {
      setName("");
      setDescription("");
      setDefinitionOfDone("");
      setAreaId(defaultAreaId);
      setStartDate(undefined);
      setEndDate(undefined);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-dod">Definition of Done</Label>
            <Textarea
              id="project-dod"
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              placeholder="When is this project considered done?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Dates</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {startDate
                      ? format(startDate, "MMM d, yyyy")
                      : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateChange}
                  />
                </PopoverContent>
              </Popover>
              {startDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleStartDateChange(undefined)}
                  aria-label="Clear start date"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground">&ndash;</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={!startDate}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => (startDate ? date < startDate : false)}
                  />
                </PopoverContent>
              </Popover>
              {endDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEndDate(undefined)}
                  aria-label="Clear end date"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          {areas && areas.length > 0 && (
            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                areas={areas}
                selectedAreaId={areaId}
                onSelect={setAreaId}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {project ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
