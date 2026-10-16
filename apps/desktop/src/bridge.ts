/** The channel the renderer reaches the local client through. */
export const CALL_CHANNEL = "vita:call";
/** Main sends the menu bar's commands to the renderer on it. */
export const COMMAND_CHANNEL = "vita:command";
/** The renderer tells main the person's theme on it. */
export const THEME_CHANNEL = "vita:theme";
/** The renderer asks main to save the person's data as a file on it. */
export const DOWNLOAD_DATA_CHANNEL = "vita:download-data";

/** The product's `HostCommand`, which the renderer's compile checks this against. */
export type MenuCommand = "new-note" | "new-thread" | "search";

/** The product's `ThemePreference`. */
export type ThemeSource = "system" | "light" | "dark";

export function isThemeSource(value: unknown): value is ThemeSource {
  return value === "system" || value === "light" || value === "dark";
}

/** What the preload exposes to the renderer as `window.vita`. */
export interface VitaBridge {
  /** Calls the local `ApplicationClient` method of that name in main. */
  call(method: string, input: unknown): Promise<unknown>;
  /** Hears the menu bar's commands; returns how to stop. */
  onCommand(listener: (command: MenuCommand) => void): () => void;
  /** So the window's background and native controls follow the product's theme. */
  setTheme(theme: ThemeSource): void;
  /** Saves the person's data where they pick. Resolves when saved or cancelled. */
  downloadData(): Promise<void>;
}
