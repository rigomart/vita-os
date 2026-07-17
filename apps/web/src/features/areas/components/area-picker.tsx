import type { Doc } from "@convex/_generated/dataModel";

import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useState } from "react";

import { AreaIcon } from "./area-icon";

interface AreaPickerProps {
  areas: Doc<"areas">[];
  selectedAreaId: string | undefined;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function AreaPicker({
  areas,
  selectedAreaId,
  onSelect,
  disabled = false,
}: AreaPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = areas.find((a) => a._id === selectedAreaId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={disabled}
          />
        }
      >
        <AreaIcon icon={selected?.icon} className="h-3 w-3" />
        {selected ? selected.name : "Area"}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {areas.map((a) => (
          <button
            key={a._id}
            type="button"
            onClick={() => {
              onSelect(a._id);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
          >
            <AreaIcon icon={a.icon} className="size-3.5 shrink-0" />
            {a.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
