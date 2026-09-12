/** PROTOTYPE — throwaway. The contract every header variant is handed. */
export interface PrototypeTopBarProps {
  noteCount: number | undefined;
  inboxOpen: boolean;
  onToggleInbox: () => void;
  onNewNote: () => void;
  onOpenPalette: () => void;
  /** F's dock exposes all three creates directly rather than only via ⌘K. */
  onNewThread: () => void;
  onNewArea: () => void;
  /** True while the thread rail is open, so fixed chrome can clear it. */
  railOpen: boolean;
}
