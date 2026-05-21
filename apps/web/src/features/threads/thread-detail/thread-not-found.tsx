import { Link } from "@tanstack/react-router";

interface ThreadNotFoundProps {
  areaSlug: string;
}

export function ThreadNotFound({ areaSlug }: ThreadNotFoundProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Thread not found.</p>
      <Link
        to="/$areaSlug"
        params={{ areaSlug }}
        className="mt-2 inline-block text-sm underline"
      >
        Back to area
      </Link>
    </div>
  );
}
