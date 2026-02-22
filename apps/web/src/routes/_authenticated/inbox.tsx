import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { CaptureRow } from "@/components/captures/capture-row";
import { ProcessCaptureDialog } from "@/components/captures/process-capture-dialog";
import { RouteErrorFallback } from "@/components/error-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inbox | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: InboxPage,
});

function InboxPage() {
  const captures = useQuery(api.captures.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const processCapture = useMutation(api.captures.process);

  const [processingCapture, setProcessingCapture] = useState<
    Doc<"captures"> | undefined
  >(undefined);

  const handleProcess = async (
    captureId: Id<"captures">,
    action:
      | {
          type: "create_project";
          name: string;
          areaId: Id<"areas">;
          description?: string;
          definitionOfDone?: string;
        }
      | { type: "add_to_project"; projectId: Id<"projects"> }
      | { type: "discard" },
  ) => {
    await processCapture({ id: captureId, action });
    setProcessingCapture(undefined);
  };

  if (captures === undefined) {
    return <InboxSkeleton />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Inbox" />
      {captures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Inbox zero — nothing to process
          </p>
        </div>
      ) : (
        <div>
          {captures.map((capture) => (
            <CaptureRow
              key={capture._id}
              capture={capture}
              onProcess={setProcessingCapture}
            />
          ))}
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
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={i}
            className="border-b py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
