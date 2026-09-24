import { Link } from "@tanstack/react-router";

export function AreaNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Area not found.</p>
      <Link to="/" className="mt-2 inline-block text-sm underline">
        Back to home
      </Link>
    </div>
  );
}
