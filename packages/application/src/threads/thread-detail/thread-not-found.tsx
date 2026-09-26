interface ThreadNotFoundProps {
  onClose?: () => void;
}

export function ThreadNotFound({ onClose }: ThreadNotFoundProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted-foreground">Thread not found.</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 inline-block text-sm underline"
      >
        Close
      </button>
    </div>
  );
}
