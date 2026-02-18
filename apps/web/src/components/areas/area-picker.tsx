import type { Doc } from "@convex/_generated/dataModel";
import { Compass, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AreaPickerProps {
  areas: Doc<"areas">[];
  selectedAreaId: string | undefined;
  onSelect: (id: string | undefined) => void;
}

export function AreaPicker({
  areas,
  selectedAreaId,
  onSelect,
}: AreaPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = areas.find((a) => a._id === selectedAreaId);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <Compass className="h-3 w-3" />
            {selected ? selected.name : "Area"}
          </Button>
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
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              {a.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {selected && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onSelect(undefined)}
          aria-label="Clear area"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
