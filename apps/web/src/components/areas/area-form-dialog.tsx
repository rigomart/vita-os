import type { Doc } from "@convex/_generated/dataModel";
import type { HealthStatus } from "@convex/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AreaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    standard?: string;
    healthStatus: HealthStatus;
  }) => void;
  area?: Doc<"areas">;
}

export function AreaFormDialog({
  open,
  onOpenChange,
  onSubmit,
  area,
}: AreaFormDialogProps) {
  const [name, setName] = useState(area?.name ?? "");
  const [standard, setStandard] = useState(area?.standard ?? "");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(
    area?.healthStatus ?? "healthy",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onSubmit({
      name: trimmedName,
      standard: standard.trim() || undefined,
      healthStatus,
    });

    if (!area) {
      setName("");
      setStandard("");
      setHealthStatus("healthy");
    }
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {area ? "Edit area" : "New area"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="area-name">Name</Label>
            <Input
              id="area-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Health, Career, Finances"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-standard">Standard</Label>
            <Textarea
              id="area-standard"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              placeholder="What does 'good enough' look like?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-health">Health status</Label>
            <Select
              value={healthStatus}
              onValueChange={(v) => setHealthStatus(v as HealthStatus)}
            >
              <SelectTrigger id="area-health">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="needs_attention">Needs attention</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {area ? "Save" : "Create"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
