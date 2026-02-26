import type { Doc, Id } from "@convex/_generated/dataModel";
import { CalendarPlus, Crosshair, FolderPlus, ListPlus } from "lucide-react";
import { useState } from "react";
import { AreaPicker } from "@/components/areas/area-picker";
import { ProjectPicker } from "@/components/projects/project-picker";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProcessMode =
  | "add_date"
  | "create_project"
  | "add_to_project"
  | "set_next_action";

interface ProcessItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Doc<"items">;
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
  onProcess: (
    itemId: Id<"items">,
    action:
      | { type: "add_date"; date: number }
      | {
          type: "create_project";
          name: string;
          areaId: Id<"areas">;
          definitionOfDone?: string;
        }
      | { type: "add_to_project"; projectId: Id<"projects"> }
      | { type: "set_next_action"; projectId: Id<"projects"> },
  ) => void;
}

export function ProcessItemDialog({
  open,
  onOpenChange,
  item,
  areas,
  projects,
  onProcess,
}: ProcessItemDialogProps) {
  const [mode, setMode] = useState<ProcessMode>("add_date");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [name, setName] = useState("");
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [areaId, setAreaId] = useState<string | undefined>(areas[0]?._id);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "add_date") {
      if (!date) return;
      onProcess(item._id, { type: "add_date", date: date.getTime() });
    } else if (mode === "create_project") {
      const trimmedName = name.trim();
      if (!trimmedName || !areaId) return;
      onProcess(item._id, {
        type: "create_project",
        name: trimmedName,
        areaId: areaId as Id<"areas">,
        definitionOfDone: definitionOfDone.trim() || undefined,
      });
    } else if (mode === "add_to_project") {
      if (!projectId) return;
      onProcess(item._id, {
        type: "add_to_project",
        projectId: projectId as Id<"projects">,
      });
    } else if (mode === "set_next_action") {
      if (!projectId) return;
      onProcess(item._id, {
        type: "set_next_action",
        projectId: projectId as Id<"projects">,
      });
    }

    onOpenChange(false);
  };

  const canSubmit =
    (mode === "add_date" && date) ||
    (mode === "create_project" && name.trim() && areaId) ||
    (mode === "add_to_project" && projectId) ||
    (mode === "set_next_action" && projectId);

  const submitLabel = {
    add_date: "Add date",
    create_project: "Create project",
    add_to_project: "Add to project",
    set_next_action: "Set next action",
  }[mode];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Process item</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Item text reference */}
        <div className="border-l-2 border-primary/30 bg-surface-3/30 py-2 pr-3 pl-3">
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {item.text}
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as ProcessMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="add_date" className="text-xs">
              <CalendarPlus className="h-3.5 w-3.5" />
              Add date
            </TabsTrigger>
            <TabsTrigger value="create_project" className="text-xs">
              <FolderPlus className="h-3.5 w-3.5" />
              New project
            </TabsTrigger>
            <TabsTrigger value="add_to_project" className="text-xs">
              <ListPlus className="h-3.5 w-3.5" />
              Add to project
            </TabsTrigger>
            <TabsTrigger value="set_next_action" className="text-xs">
              <Crosshair className="h-3.5 w-3.5" />
              Set next action
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TabsContent value="add_date">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  placeholder="Pick a date"
                />
                <p className="text-xs text-muted-foreground">
                  The item will leave the inbox and become a standalone dated
                  action.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="create_project">
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="process-name"
                      className="text-xs text-muted-foreground"
                    >
                      Name
                    </Label>
                    <Input
                      id="process-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Project name"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Area
                    </Label>
                    <AreaPicker
                      areas={areas}
                      selectedAreaId={areaId}
                      onSelect={setAreaId}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="process-dod"
                    className="text-xs text-muted-foreground"
                  >
                    Definition of Done
                  </Label>
                  <Input
                    id="process-dod"
                    value={definitionOfDone}
                    onChange={(e) => setDefinitionOfDone(e.target.value)}
                    placeholder="What does done look like?"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="add_to_project">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <ProjectPicker
                  projects={projects}
                  areas={areas}
                  selectedProjectId={projectId}
                  onSelect={setProjectId}
                />
                <p className="text-xs text-muted-foreground">
                  The item text will be added as a note on the selected project.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="set_next_action">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <ProjectPicker
                  projects={projects}
                  areas={areas}
                  selectedProjectId={projectId}
                  onSelect={setProjectId}
                />
                <p className="text-xs text-muted-foreground">
                  The item text will replace the project's current next action.
                </p>
              </div>
            </TabsContent>

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitLabel}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
