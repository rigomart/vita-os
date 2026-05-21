import type { Doc } from "@convex/_generated/dataModel";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@vita-os/ui/components/combobox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@vita-os/ui/components/item";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";

export type ThreadOption = Doc<"threads"> & { areaName: string };

export type ThreadChoice =
  | { kind: "thread"; thread: ThreadOption }
  | { kind: "create"; title: string };

interface ThreadSearchAutocompleteProps {
  areas: Doc<"areas">[];
  threads: Doc<"threads">[];
  isLoading?: boolean;
  value: ThreadChoice | null;
  inputValue: string;
  onValueChange: (value: ThreadChoice | null) => void;
  onInputValueChange: (value: string, details: { reason: string }) => void;
}

export function ThreadSearchAutocomplete({
  areas,
  threads,
  isLoading = false,
  value,
  inputValue,
  onValueChange,
  onInputValueChange,
}: ThreadSearchAutocompleteProps) {
  const areaById = useMemo(
    () => new Map(areas.map((area) => [area._id, area])),
    [areas],
  );

  const threadOptions = useMemo<ThreadOption[]>(
    () =>
      threads.map((thread) => ({
        ...thread,
        areaName: areaById.get(thread.areaId)?.name ?? "No area",
      })),
    [threads, areaById],
  );

  const trimmedQuery = inputValue.trim();
  const hasExactMatch = threadOptions.some(
    (thread) => normalize(thread.title) === normalize(trimmedQuery),
  );
  const canCreate = trimmedQuery.length > 0 && !hasExactMatch;
  const items: ThreadChoice[] = [
    ...(canCreate ? [{ kind: "create" as const, title: trimmedQuery }] : []),
    ...threadOptions.map(
      (thread) => ({ kind: "thread" as const, thread }) satisfies ThreadChoice,
    ),
  ];

  return (
    <Combobox<ThreadChoice>
      items={isLoading ? [] : items}
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onValueChange(next);
      }}
      inputValue={inputValue}
      onInputValueChange={onInputValueChange}
      autoHighlight
      itemToStringLabel={(choice) =>
        choice.kind === "create" ? choice.title : choice.thread.title
      }
      itemToStringValue={(choice) =>
        choice.kind === "create" ? choice.title : choice.thread.title
      }
      isItemEqualToValue={(a, b) => {
        if (a.kind !== b.kind) return false;
        if (a.kind === "create" && b.kind === "create")
          return a.title === b.title;
        if (a.kind === "thread" && b.kind === "thread")
          return a.thread._id === b.thread._id;
        return false;
      }}
      filter={(choice, search) => {
        if (choice.kind === "create") return canCreate;
        const q = search.trim().toLowerCase();
        return (
          choice.thread.title.toLowerCase().includes(q) ||
          choice.thread.areaName.toLowerCase().includes(q)
        );
      }}
    >
      <ComboboxInput
        placeholder="Search or type a new thread..."
        autoFocus
        showClear={!!value || inputValue.length > 0}
      />
      <ComboboxContent>
        <ComboboxEmpty>No threads yet</ComboboxEmpty>
        <ComboboxList>
          {(choice: ThreadChoice) =>
            choice.kind === "create" ? (
              <ComboboxItem
                key="create-thread"
                value={choice}
                className="border border-dashed border-border-subtle data-highlighted:border-transparent"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="truncate font-medium">
                  Create '{choice.title}'
                </span>
              </ComboboxItem>
            ) : (
              <ComboboxItem key={choice.thread._id} value={choice}>
                <Item size="xs" className="p-0">
                  <ItemContent>
                    <ItemTitle className="whitespace-nowrap">
                      {choice.thread.title}
                    </ItemTitle>
                    <ItemDescription>{choice.thread.areaName}</ItemDescription>
                  </ItemContent>
                </Item>
              </ComboboxItem>
            )
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
