import type { Doc } from "@convex/_generated/dataModel";

import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { FolderOpen } from "lucide-react";
import { useState } from "react";

interface ThreadPickerProps {
  threads: Doc<"threads">[];
  areas: Doc<"areas">[];
  selectedThreadId: string | undefined;
  onSelect: (id: string) => void;
}

export function ThreadPicker({
  threads,
  areas,
  selectedThreadId,
  onSelect,
}: ThreadPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = threads.find((p) => p._id === selectedThreadId);

  const threadsByArea = areas
    .map((area) => ({
      area,
      threads: threads.filter((p) => p.areaId === area._id),
    }))
    .filter((group) => group.threads.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" />
        }
      >
        <FolderOpen className="h-3 w-3" />
        {selected ? selected.title : "Select thread"}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {threadsByArea.map(({ area, threads: areaThreads }) => (
          <div key={area._id}>
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {area.name}
            </p>
            {areaThreads.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => {
                  onSelect(p._id);
                  setOpen(false);
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
              >
                {p.title}
              </button>
            ))}
          </div>
        ))}
        {threadsByArea.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No open threads
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
