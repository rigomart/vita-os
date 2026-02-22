import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ArrowRight, Inbox } from "lucide-react";
import { useState } from "react";
import { CaptureRow } from "@/components/captures/capture-row";
import { ProcessCaptureDialog } from "@/components/captures/process-capture-dialog";

const MAX_VISIBLE = 5;

export function RecentCaptures() {
  const captures = useQuery(api.captures.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const processCapture = useMutation(api.captures.process);

  const [processingCapture, setProcessingCapture] = useState<
    Doc<"captures"> | undefined
  >(undefined);

  if (!captures || captures.length === 0) return null;

  const visible = captures.slice(0, MAX_VISIBLE);
  const hasMore = captures.length > MAX_VISIBLE;

  const handleProcess = async (
    captureId: Id<"captures">,
    action:
      | {
          type: "create_project";
          name: string;
          areaId: Id<"areas">;
          description?: string;
        }
      | { type: "add_to_project"; projectId: Id<"projects"> },
  ) => {
    await processCapture({ id: captureId, action });
    setProcessingCapture(undefined);
  };

  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-medium">Recent Captures</h2>
        <span className="text-xs text-muted-foreground">{captures.length}</span>
      </div>
      <div className="divide-y divide-border/50 rounded-xl bg-surface-2">
        {visible.map((capture) => (
          <CaptureRow
            key={capture._id}
            capture={capture}
            onProcess={setProcessingCapture}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-3 flex justify-end">
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all captures
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {processingCapture && (
        <ProcessCaptureDialog
          open={!!processingCapture}
          onOpenChange={(open) => {
            if (!open) setProcessingCapture(undefined);
          }}
          capture={processingCapture}
          areas={areas ?? []}
          projects={projects ?? []}
          onProcess={handleProcess}
        />
      )}
    </section>
  );
}
