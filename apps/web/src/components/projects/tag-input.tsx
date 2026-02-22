import { useState } from "react";
import {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from "@/components/ui/tags";

export function TagInput({
  tags,
  suggestions,
  onAdd,
  onRemove,
}: {
  tags: string[];
  suggestions: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [search, setSearch] = useState("");

  const available = suggestions.filter((s) => !tags.includes(s));

  const handleSelect = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || tags.includes(normalized)) return;
    onAdd(normalized);
    setSearch("");
  };

  const trimmed = search.trim().toLowerCase();
  const canCreate =
    trimmed && !tags.includes(trimmed) && !available.some((s) => s === trimmed);

  return (
    <Tags>
      <TagsTrigger
        variant="ghost"
        className="h-auto min-h-7 w-full justify-start gap-1 rounded-md border-none bg-transparent px-1 py-0.5 shadow-none hover:bg-surface-2"
        placeholder="Add a tag..."
      >
        {tags.map((tag) => (
          <TagsValue
            key={tag}
            variant="secondary"
            className="gap-0.5 pr-1 text-xs"
            onRemove={() => onRemove(tag)}
          >
            {tag}
          </TagsValue>
        ))}
      </TagsTrigger>
      <TagsContent align="start" className="w-56">
        <TagsInput
          placeholder="Search tags..."
          value={search}
          onValueChange={setSearch}
        />
        <TagsList>
          <TagsEmpty>
            {trimmed ? "No matching tags." : "No tags yet."}
          </TagsEmpty>
          <TagsGroup>
            {available.map((suggestion) => (
              <TagsItem
                key={suggestion}
                value={suggestion}
                onSelect={() => handleSelect(suggestion)}
              >
                {suggestion}
              </TagsItem>
            ))}
            {canCreate && (
              <TagsItem value={trimmed} onSelect={() => handleSelect(trimmed)}>
                Create &ldquo;{trimmed}&rdquo;
              </TagsItem>
            )}
          </TagsGroup>
        </TagsList>
      </TagsContent>
    </Tags>
  );
}
