import type { AreaId, AreaSummary } from "@vita-os/contracts";

import { DEFAULT_AREA_ICON, slugify } from "@vita-os/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { Check, Plus, Tag, X } from "lucide-react";
import { useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../ui/command";
import { useAreas, useCreateArea } from "../hooks";
import { AreaIcon } from "./area-icon";

interface AreaPickerProps {
  /** The picked Area, or `undefined` for none. */
  value: AreaId | undefined;
  /** Called with the picked Area, or `undefined` when the Area is removed. */
  onChange: (areaId: AreaId | undefined) => void | Promise<void>;
  disabled?: boolean;
}

/**
 * The one way to put an Area on a Thread: a chip that opens a searchable list.
 *
 * Typing a name that is not there offers to create it; typing one that is
 * (in any case or spacing) only ever offers that Area, so a label is never
 * duplicated. When an Area is set, the list also offers to remove it.
 */
export function AreaPicker({
  value,
  onChange,
  disabled = false,
}: AreaPickerProps) {
  const areas = useAreas().data ?? [];
  const createArea = useCreateArea();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Opening the list puts the caret in its search, so typing and the arrow
  // keys work straight away, however the chip was opened.
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = areas.find((area) => area._id === value);

  // Filtered here rather than by cmdk, so surrounding spaces and case never
  // hide the Area a name already belongs to; that Area is listed first.
  const typed = query.trim();
  const exactMatch =
    typed === ""
      ? undefined
      : areas.find((area) => slugify(area.name) === slugify(typed));
  const shown =
    typed === ""
      ? areas
      : [
          ...(exactMatch === undefined ? [] : [exactMatch]),
          ...areas.filter(
            (area) =>
              area !== exactMatch &&
              area.name.toLowerCase().includes(typed.toLowerCase()),
          ),
        ];

  const { run: createAndPick, isPending: isCreating } = useGuardedAsyncAction(
    async (name: string) => {
      const area = await createArea.mutateAsync({
        name,
        icon: DEFAULT_AREA_ICON,
      });
      await onChange(area._id);
    },
    { errorToast: true },
  );

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (area: AreaSummary) => {
    close();
    if (area._id !== value) void onChange(area._id);
  };

  const create = (name: string) => {
    close();
    void createAndPick(name);
  };

  const remove = () => {
    close();
    void onChange(undefined);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={selected ? `Area: ${selected.name}` : "Add area"}
            disabled={disabled || isCreating}
            className={cn(
              "inline-flex h-7 max-w-48 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "text-foreground"
                : "border-dashed text-muted-foreground",
            )}
          />
        }
      >
        {selected ? (
          <AreaIcon icon={selected.icon} className="size-3.5 shrink-0" />
        ) : (
          <Tag aria-hidden className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{selected ? selected.name : "Area"}</span>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-0"
        align="start"
        initialFocus={searchRef}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={searchRef}
            placeholder="Find or create an area…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Type a name to create an area.</CommandEmpty>
            {shown.length > 0 && (
              <CommandGroup>
                {shown.map((area) => (
                  <CommandItem
                    key={area._id}
                    value={`area-${area._id}`}
                    onSelect={() => pick(area)}
                  >
                    <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{area.name}</span>
                    {area._id === value && (
                      <Check aria-hidden className="size-3.5 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {typed !== "" && exactMatch === undefined && (
              <CommandGroup>
                <CommandItem
                  value={`create-${typed}`}
                  onSelect={() => create(typed)}
                >
                  <Plus aria-hidden className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Create “{typed}”
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {selected && typed === "" && (
              <CommandGroup>
                <CommandItem value="remove-area" onSelect={remove}>
                  <X aria-hidden className="size-3.5 shrink-0" />
                  Remove area
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
