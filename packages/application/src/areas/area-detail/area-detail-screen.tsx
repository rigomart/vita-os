import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { ProductSearch } from "../../navigation/search-params";

import { useDocumentTitle } from "../../hooks/use-document-title";
import { CreateThreadDialog } from "../../threads/thread-form/create-thread-dialog";
import { EditAreaDialog } from "../area-form/edit-area-dialog";
import { AreaDetailSkeleton } from "../components/area-detail-skeleton";
import { AreaHeaderSection } from "../components/area-header-section";
import { AreaStandardCardSection } from "../components/area-standard-card-section";
import { AreaThreadsSection } from "../components/area-threads-section";
import { useAreaDetail, useAreas } from "../hooks";
import { AreaNotFound } from "./area-not-found";

interface AreaDetailScreenProps {
  areaSlug: string;
}

export function AreaDetailScreen({ areaSlug }: AreaDetailScreenProps) {
  const detail = useAreaDetail(areaSlug).data;
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateThread, setShowCreateThread] = useState(false);

  // Picker data for the create-thread dialog only; the page itself renders
  // from its own read.
  const areas = useAreas({ enabled: showCreateThread }).data;

  useDocumentTitle(detail?.area.name ?? "Area");

  if (detail === undefined) return <AreaDetailSkeleton />;
  if (detail === null) return <AreaNotFound />;

  const { area, threads } = detail;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <AreaHeaderSection area={area} onEdit={() => setShowEdit(true)} />
        <div className="min-h-8 max-w-2xl">
          <AreaStandardCardSection area={area} />
        </div>
      </div>

      <AreaThreadsSection
        threads={threads}
        onCreateThread={() => setShowCreateThread(true)}
      />

      <EditAreaDialog open={showEdit} onOpenChange={setShowEdit} area={area} />

      {/* Held until the gated list resolves: the dialog must never open on
          an empty, unselected picker. */}
      {showCreateThread && areas !== undefined && (
        <CreateThreadDialog
          open
          onOpenChange={setShowCreateThread}
          areas={areas}
          defaultAreaId={area._id}
          onCreated={({ slug }) => {
            navigate({
              to: ".",
              search: (prev: ProductSearch): ProductSearch => ({
                ...prev,
                thread: slug,
              }),
            });
          }}
        />
      )}
    </div>
  );
}
