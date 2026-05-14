import type { Doc } from "@convex/_generated/dataModel";
import {
  DEFAULT_HEALTH_STATUS,
  HEALTH_STATUS_OPTIONS,
  type HealthStatus,
} from "@convex/lib/healthStatus";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useState } from "react";

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
    area?.healthStatus ?? DEFAULT_HEALTH_STATUS,
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
      setHealthStatus(DEFAULT_HEALTH_STATUS);
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
          <ResponsiveDialogDescription>
            {area
              ? "Update this life area's details."
              : "Areas are stable life domains like Health, Career, or Finances."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
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
            <Label htmlFor="area-standard">
              Standard
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="area-standard"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              placeholder="What does 'good enough' look like for this area?"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              The maintenance threshold, not an aspirational goal.
            </p>
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
                {HEALTH_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
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
              {area ? "Save changes" : "Create area"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
