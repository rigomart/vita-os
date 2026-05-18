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

export type ProjectOption = Doc<"projects"> & { areaName: string };

export type ProjectChoice =
  | { kind: "project"; project: ProjectOption }
  | { kind: "create"; name: string };

interface ProjectSearchAutocompleteProps {
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
  isLoading?: boolean;
  value: ProjectChoice | null;
  inputValue: string;
  onValueChange: (value: ProjectChoice | null) => void;
  onInputValueChange: (value: string, details: { reason: string }) => void;
}

export function ProjectSearchAutocomplete({
  areas,
  projects,
  isLoading = false,
  value,
  inputValue,
  onValueChange,
  onInputValueChange,
}: ProjectSearchAutocompleteProps) {
  const areaById = useMemo(
    () => new Map(areas.map((area) => [area._id, area])),
    [areas],
  );

  const projectOptions = useMemo<ProjectOption[]>(
    () =>
      projects.map((project) => ({
        ...project,
        areaName: areaById.get(project.areaId)?.name ?? "No area",
      })),
    [projects, areaById],
  );

  const trimmedQuery = inputValue.trim();
  const hasExactMatch = projectOptions.some(
    (project) => normalize(project.name) === normalize(trimmedQuery),
  );
  const canCreate = trimmedQuery.length > 0 && !hasExactMatch;
  const items: ProjectChoice[] = [
    ...(canCreate ? [{ kind: "create" as const, name: trimmedQuery }] : []),
    ...projectOptions.map(
      (project) =>
        ({ kind: "project" as const, project }) satisfies ProjectChoice,
    ),
  ];

  return (
    <Combobox<ProjectChoice>
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
        choice.kind === "create" ? choice.name : choice.project.name
      }
      itemToStringValue={(choice) =>
        choice.kind === "create" ? choice.name : choice.project.name
      }
      isItemEqualToValue={(a, b) => {
        if (a.kind !== b.kind) return false;
        if (a.kind === "create" && b.kind === "create")
          return a.name === b.name;
        if (a.kind === "project" && b.kind === "project")
          return a.project._id === b.project._id;
        return false;
      }}
      filter={(choice, search) => {
        if (choice.kind === "create") return canCreate;
        const q = search.trim().toLowerCase();
        return (
          choice.project.name.toLowerCase().includes(q) ||
          choice.project.areaName.toLowerCase().includes(q)
        );
      }}
    >
      <ComboboxInput
        placeholder="Search or type a new Project..."
        autoFocus
        showClear={!!value || inputValue.length > 0}
      />
      <ComboboxContent>
        <ComboboxEmpty>No Projects yet</ComboboxEmpty>
        <ComboboxList>
          {(choice: ProjectChoice) =>
            choice.kind === "create" ? (
              <ComboboxItem
                key="create-project"
                value={choice}
                className="border border-dashed border-border-subtle data-highlighted:border-transparent"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="truncate font-medium">
                  Create '{choice.name}'
                </span>
              </ComboboxItem>
            ) : (
              <ComboboxItem key={choice.project._id} value={choice}>
                <Item size="xs" className="p-0">
                  <ItemContent>
                    <ItemTitle className="whitespace-nowrap">
                      {choice.project.name}
                    </ItemTitle>
                    <ItemDescription>{choice.project.areaName}</ItemDescription>
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
