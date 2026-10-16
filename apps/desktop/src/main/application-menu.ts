import type { MenuItemConstructorOptions } from "electron";

import type { MenuCommand } from "../bridge.ts";

export interface ApplicationMenuOptions {
  /** Developer tools and Reload only where the app runs from source. */
  isPackaged: boolean;
  send(command: MenuCommand): void;
  showLogs(): void;
  backUpNow(): void;
  showBackups(): void;
  downloadData(): void;
}

/**
 * The menu bar: macOS's own menus, with the product's actions and the data
 * file's in File.
 *
 * Search and New Note show the page's own shortcuts without registering them,
 * so a key press still reaches the page as it does on the web, and the page
 * decides when it applies (Q types a q in a text field).
 */
export function applicationMenuTemplate({
  isPackaged,
  send,
  showLogs,
  backUpNow,
  showBackups,
  downloadData,
}: ApplicationMenuOptions): MenuItemConstructorOptions[] {
  return [
    { role: "appMenu" },
    {
      label: "File",
      submenu: [
        {
          label: "New Note",
          accelerator: "Q",
          registerAccelerator: false,
          click: () => send("new-note"),
        },
        { label: "New Thread", click: () => send("new-thread") },
        { type: "separator" },
        {
          label: "Search…",
          accelerator: "CommandOrControl+K",
          registerAccelerator: false,
          click: () => send("search"),
        },
        { type: "separator" },
        { label: "Back Up Now", click: backUpNow },
        { label: "Show Backups in Finder", click: showBackups },
        { label: "Download My Data…", click: downloadData },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        ...(isPackaged
          ? []
          : ([
              { role: "reload" },
              { role: "toggleDevTools" },
              { type: "separator" },
            ] satisfies MenuItemConstructorOptions[])),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    { role: "help", submenu: [{ label: "Show Logs", click: showLogs }] },
  ];
}
