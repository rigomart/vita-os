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
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

type ProjectSearchProject = Doc<"projects"> & { areaName: string };

type ProjectSearchItem =
  | { kind: "create"; name: string }
  | ({ kind: "project" } & ProjectSearchProject);

interface ProjectSearchAutocompleteProps {
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
  isLoading?: boolean;
  onSelect: (project: Doc<"projects">) => void;
  onCreate: (name: string) => void;
}

export function ProjectSearchAutocomplete({
  areas,
  projects,
  isLoading = false,
  onSelect,
  onCreate,
}: ProjectSearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area._id, area])),
    [areas],
  );

  const projectItems = useMemo<ProjectSearchProject[]>(
    () =>
      projects.map((project) => ({
        ...project,
        areaName: areaById.get(project.areaId)?.name ?? "No area",
      })),
    [projects, areaById],
  );

  const hasExactProjectMatch = projectItems.some(
    (project) => normalize(project.name) === normalize(trimmedQuery),
  );
  const canCreate = trimmedQuery.length > 0 && !hasExactProjectMatch;
  const items: ProjectSearchItem[] = [
    ...(canCreate ? [{ kind: "create" as const, name: trimmedQuery }] : []),
    ...projectItems.map((project) => ({
      ...project,
      kind: "project" as const,
    })),
  ];

  return (
    <Combobox
      items={isLoading ? [] : items}
      itemToStringLabel={(item: ProjectSearchItem) =>
        item.kind === "create" ? `Create '${item.name}'` : item.name
      }
      itemToStringValue={(item: ProjectSearchItem) =>
        item.kind === "create" ? item.name : item.name
      }
      filter={(item: ProjectSearchItem, search: string) => {
        if (item.kind === "create") return canCreate;

        const q = search.trim().toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.areaName.toLowerCase().includes(q)
        );
      }}
      onValueChange={(item: ProjectSearchItem | null) => {
        if (!item) return;
        if (item.kind === "create") {
          onCreate(item.name);
          return;
        }
        const { kind: _kind, areaName: _areaName, ...project } = item;
        onSelect(project);
      }}
    >
      <ComboboxInput
        placeholder="Search Projects or Areas..."
        autoFocus
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching projects</ComboboxEmpty>
        <ComboboxList>
          {(item: ProjectSearchItem) =>
            item.kind === "create" ? (
              <ComboboxItem key="create-project" value={item}>
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>Create '{item.name}'</span>
              </ComboboxItem>
            ) : (
              <ComboboxItem key={item._id} value={item}>
                <Item size="xs" className="p-0">
                  <ItemContent>
                    <ItemTitle className="whitespace-nowrap">
                      {item.name}
                    </ItemTitle>
                    <ItemDescription>{item.areaName}</ItemDescription>
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
