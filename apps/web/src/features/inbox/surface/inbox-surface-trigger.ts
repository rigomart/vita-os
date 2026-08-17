export const INBOX_SURFACE_PANEL_ID = "inbox-surface-panel";

const TRIGGER_ATTRIBUTE = "data-inbox-surface-trigger";

/** Marks the chrome that summons the surface; its clicks are never "outside". */
export const INBOX_SURFACE_TRIGGER_SELECTOR = `[${TRIGGER_ATTRIBUTE}]`;

/** Spread onto any control that summons the Inbox. */
export const inboxSurfaceTriggerProps = {
  [TRIGGER_ATTRIBUTE]: "",
  "aria-haspopup": "dialog",
  "aria-controls": INBOX_SURFACE_PANEL_ID,
} as const;
