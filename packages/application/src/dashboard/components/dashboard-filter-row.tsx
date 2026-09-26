import { Link, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown, Layers, Tag } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";
import type { DashboardFilterOption } from "./dashboard-filter-model";

import { AreaIcon } from "../../areas/components/area-icon";
import { useIsMobile } from "../../hooks/use-mobile";

/** Where choosing an option leaves the URL: only `?area=` changes. */
function withArea(param: string | undefined) {
  return (previous: ProductSearch): ProductSearch => ({
    ...previous,
    area: param,
  });
}

/**
 * All · each Area with its count · No area. Choosing one filters the board
 * and writes the choice to the URL, so a filtered Dashboard survives a reload
 * and an open Thread. On a phone the row folds into one dropdown.
 */
export function DashboardFilterRow({
  options,
}: {
  options: DashboardFilterOption[];
}) {
  const isMobile = useIsMobile();
  return isMobile ? (
    <FilterDropdown options={options} />
  ) : (
    <nav aria-label="Filter by area">
      <ul className="flex flex-wrap items-center gap-1">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              to="/"
              search={withArea(option.param)}
              aria-current={option.selected ? "true" : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                option.selected
                  ? "bg-foreground text-surface-1"
                  : "hover:bg-muted",
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
        ))}
      </ul>
    </nav>
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
            aria-label={`Filter by area: ${selected.label}`}
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
            void navigate({ to: "/", search: withArea(option.param) });
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.key}
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
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OptionIcon({ option }: { option: DashboardFilterOption }) {
  if (option.area !== undefined) {
    return <AreaIcon icon={option.area.icon} className="size-3.5 shrink-0" />;
  }
  const Icon = option.param === undefined ? Layers : Tag;
  return <Icon aria-hidden className="size-3.5 shrink-0" />;
}
