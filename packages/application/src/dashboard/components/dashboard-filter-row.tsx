import { Link, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown, Layers, Settings2, StickyNote, Tag } from "lucide-react";
import { Fragment, useState } from "react";

import type { DashboardFilterOption } from "./dashboard-filter-model";

import { AreaIcon } from "../../areas/components/area-icon";
import { ManageAreasDialog } from "../../areas/manage-areas/manage-areas-dialog";
import { useIsMobile } from "../../hooks/use-mobile";
import { withDashboardFilter } from "../../navigation/search-params";

/**
 * All · each Area with its count · No area, then Notes with its own count.
 * Choosing one filters the board and writes the choice to the URL, so a
 * filtered Dashboard survives a reload and an open Thread. On a phone the row
 * folds into one dropdown. Manage areas sits beside the Areas it edits, which
 * also sets Notes apart from them: Notes is not an Area.
 */
export function DashboardFilterRow({
  options,
}: {
  options: DashboardFilterOption[];
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <div className="flex items-center gap-1">
        <FilterDropdown options={options} />
        <ManageAreasButton />
      </div>
    );
  }

  const threadOptions = options.filter((option) => !option.separated);
  const noteOptions = options.filter((option) => option.separated);
  return (
    <nav
      aria-label="Filter the board"
      className="flex flex-wrap items-center gap-1"
    >
      <ul className="flex flex-wrap items-center gap-1">
        {threadOptions.map((option) => (
          <FilterLink key={option.key} option={option} />
        ))}
      </ul>
      <ManageAreasButton />
      {noteOptions.length > 0 && (
        <>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <ul className="flex items-center gap-1">
            {noteOptions.map((option) => (
              <FilterLink key={option.key} option={option} />
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}

function FilterLink({ option }: { option: DashboardFilterOption }) {
  return (
    <li>
      <Link
        to="/"
        search={withDashboardFilter(option.search)}
        // Exact, so All — whose search only clears — is not active under
        // every other option too.
        activeOptions={{ exact: true }}
        aria-current={option.selected ? "true" : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          option.selected ? "bg-foreground text-surface-1" : "hover:bg-muted",
          !option.selected && option.muted
            ? "text-muted-foreground/50"
            : !option.selected && "text-muted-foreground",
        )}
      >
        <OptionIcon option={option} />
        <span className="max-w-40 truncate">{option.label}</span>
        <span className="tabular-nums opacity-70">{option.count}</span>
      </Link>
    </li>
  );
}

function FilterDropdown({ options }: { options: DashboardFilterOption[] }) {
  const navigate = useNavigate();
  const selected = options.find((option) => option.selected) ?? options[0];
  if (selected === undefined) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Filter the board: ${selected.label}`}
            className="inline-flex h-8 items-center gap-1.5 self-start rounded-full border px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        }
      >
        <OptionIcon option={selected} />
        <span className="max-w-48 truncate">{selected.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {selected.count}
        </span>
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuRadioGroup
          value={selected.key}
          onValueChange={(key) => {
            const option = options.find((candidate) => candidate.key === key);
            if (option === undefined) return;
            void navigate({
              to: "/",
              search: withDashboardFilter(option.search),
            });
          }}
        >
          {options.map((option) => (
            <Fragment key={option.key}>
              {option.separated && <DropdownMenuSeparator />}
              <DropdownMenuRadioItem
                value={option.key}
                closeOnClick
                className={cn(option.muted && "text-muted-foreground")}
              >
                <OptionIcon option={option} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {option.count}
                </span>
              </DropdownMenuRadioItem>
            </Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ManageAreasButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Manage areas"
              onClick={() => setOpen(true)}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          }
        >
          <Settings2 aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>Manage areas</TooltipContent>
      </Tooltip>
      {/* Mounted on demand, like the shell's dialogs: it holds form state
          that should not survive a close. */}
      {open && <ManageAreasDialog open onOpenChange={setOpen} />}
    </>
  );
}

function OptionIcon({ option }: { option: DashboardFilterOption }) {
  if (option.area !== undefined) {
    return <AreaIcon icon={option.area.icon} className="size-3.5 shrink-0" />;
  }
  const Icon =
    option.key === "notes"
      ? StickyNote
      : option.search.area === undefined
        ? Layers
        : Tag;
  return <Icon aria-hidden className="size-3.5 shrink-0" />;
}
