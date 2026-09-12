/** PROTOTYPE — throwaway. Same contract as `AppTopBar`, shared by the variants. */
export interface PrototypeTopBarProps {
  noteCount: number | undefined;
  inboxOpen: boolean;
  onToggleInbox: () => void;
  onNewNote: () => void;
  onOpenPalette: () => void;
}
