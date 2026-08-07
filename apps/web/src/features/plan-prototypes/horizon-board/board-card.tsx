import { useDraggable } from "@dnd-kit/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useRef } from "react";

import type { MockArea, MockThread } from "../mock-data";
import type { Horizon, Placement } from "./horizon-model";

import { CardEditor } from "./card-editor";
import { ThreadCard } from "./thread-card";

/**
 * A card wired for both gestures: drag it to a horizon to reschedule, or click
 * it to open the in-place editor. A 6px activation distance keeps the two from
 * fighting — a click is never swallowed by the drag sensor.
 */

export interface BoardCardProps {
  area: MockArea | undefined;
  editorOpen: boolean;
  horizons: Horizon[];
  landed: boolean;
  now: number;
  onCompleteNextMove: () => void;
  onEditorOpenChange: (open: boolean) => void;
  onResolve: () => void;
  onSetFollowUp: (followUp: number | undefined) => void;
  onSetNextMove: (text: string) => void;
  placement: Placement;
  quiet?: boolean;
  resolving: boolean;
  thread: MockThread;
}

export function BoardCard({
  area,
  editorOpen,
  horizons,
  landed,
  now,
  onCompleteNextMove,
  onEditorOpenChange,
  onResolve,
  onSetFollowUp,
  onSetNextMove,
  placement,
  quiet,
  resolving,
  thread,
}: BoardCardProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: thread.id,
    data: { placement },
    disabled: resolving,
  });

  return (
    <Popover open={editorOpen} onOpenChange={onEditorOpenChange}>
      <PopoverTrigger
        render={
          <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            aria-label={`${thread.title} — open editor, or drag to reschedule`}
            className="cursor-grab touch-none rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <ThreadCard
              area={area}
              isDragging={isDragging}
              landed={landed}
              now={now}
              placement={placement}
              quiet={quiet}
              resolving={resolving}
              selected={editorOpen}
              thread={thread}
            />
          </div>
        }
      />
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        initialFocus={titleRef}
        className="w-auto gap-0 p-0"
      >
        <CardEditor
          area={area}
          horizons={horizons}
          onCompleteNextMove={onCompleteNextMove}
          onResolve={onResolve}
          onSetFollowUp={onSetFollowUp}
          onSetNextMove={onSetNextMove}
          titleRef={titleRef}
          thread={thread}
        />
      </PopoverContent>
    </Popover>
  );
}
