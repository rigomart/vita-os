import { Link } from "@tanstack/react-router";

interface ThreadNotFoundProps {
  areaSlug?: string;
  onClose?: () => void;
}

export function ThreadNotFound({ areaSlug, onClose }: ThreadNotFoundProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Thread not found.</p>
      {areaSlug !== undefined ? (
        <Link
          to="/$areaSlug"
          params={{ areaSlug }}
          className="mt-2 inline-block text-sm underline"
        >
          Back to area
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="mt-2 inline-block text-sm underline"
        >
          Close
        </button>
      )}
    </div>
  );
}
