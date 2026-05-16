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
import { useEffect, useState } from "react";
import type { AreaFormValue } from "./types";

interface AreaFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: AreaFormValue;
  onSubmit: (value: AreaFormValue) => Promise<void> | void;
}

export function AreaFormDialog({
  mode,
  open,
  onOpenChange,
  initialValue,
  onSubmit,
}: AreaFormDialogProps) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [standard, setStandard] = useState(initialValue?.standard ?? "");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(
    initialValue?.healthStatus ?? DEFAULT_HEALTH_STATUS,
  );

  useEffect(() => {
    if (!open) return;
    setName(initialValue?.name ?? "");
    setStandard(initialValue?.standard ?? "");
    setHealthStatus(initialValue?.healthStatus ?? DEFAULT_HEALTH_STATUS);
  }, [open, initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    await onSubmit({
      name: trimmedName,
      standard: standard.trim() || undefined,
      healthStatus,
    });

    if (mode === "create") {
      setName("");
      setStandard("");
      setHealthStatus(DEFAULT_HEALTH_STATUS);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === "edit" ? "Edit area" : "New area"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "edit"
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
              {mode === "edit" ? "Save changes" : "Create area"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
