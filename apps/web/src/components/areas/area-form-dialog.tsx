import type { Doc } from "@convex/_generated/dataModel";
import type { HealthStatus } from "@convex/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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

const healthOptions: { value: HealthStatus; label: string; color: string }[] = [
  { value: "healthy", label: "Healthy", color: "bg-green-500" },
  {
    value: "needs_attention",
    label: "Needs attention",
    color: "bg-yellow-500",
  },
  { value: "critical", label: "Critical", color: "bg-red-500" },
];

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
                {healthOptions.map((opt) => (
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
