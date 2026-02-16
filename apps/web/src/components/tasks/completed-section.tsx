import type { Doc, Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { TaskRow } from "./task-row";

export function CompletedSection({
  tasks,
  projectId,
}: {
  tasks: Doc<"tasks">[];
  projectId?: Id<"projects">;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          className="inline-block transition-transform"
          style={{
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          &#9656;
        </span>
        Completed ({tasks.length})
      </button>
      {isOpen && (
        <div className="mt-2">
          {tasks.map((task) => (
            <TaskRow key={task._id} task={task} projectId={projectId} />
          ))}
        </div>
      )}
    </div>
  );
}
