import { app, dialog, shell } from "electron";

import type { PreferencesStore } from "./preferences.ts";

import { newerRelease, RELEASES_PAGE, type Release } from "./releases.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UpdateNoticeOptions {
  preferences: PreferencesStore;
  releasesUrl: string;
  /** Whether the daily check runs at all: a packaged app, or a test pointing at its own feed. */
  checksAutomatically: boolean;
}

/**
 * Says when a newer release exists and opens its page; installing stays by
 * hand. The daily check announces each version once and keeps its failures
 * to the log; Check for Updates… always answers.
 */
export function updateNotice({
  preferences,
  releasesUrl,
  checksAutomatically,
}: UpdateNoticeOptions) {
  const current = app.getVersion();

  async function announce(release: Release) {
    preferences.update({ announcedVersion: release.version });
    const { response } = await dialog.showMessageBox({
      message: `Vita OS ${release.version} is available`,
      detail: `You have ${current}. Download it from its release page, then install it as before: open the .dmg and drag Vita OS into Applications. Your data stays where it is.`,
      buttons: ["Download", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) await shell.openExternal(release.url);
  }

  async function checkDaily() {
    if (!preferences.get().checkForUpdates) return;
    try {
      const release = await newerRelease(current, releasesUrl);
      if (release && release.version !== preferences.get().announcedVersion) {
        await announce(release);
      }
    } catch (error) {
      console.warn("Vita OS couldn't check for updates", error);
    }
  }

  return {
    start() {
      if (!checksAutomatically) return;
      void checkDaily();
      setInterval(() => void checkDaily(), DAY_MS);
    },

    async checkNow() {
      let release: Release | undefined;
      try {
        release = await newerRelease(current, releasesUrl);
      } catch (error) {
        console.warn("Vita OS couldn't check for updates", error);
        await dialog.showMessageBox({
          type: "warning",
          message: "Vita OS couldn't check for updates",
          detail: `${error instanceof Error ? error.message : String(error)} Releases are also at ${RELEASES_PAGE}.`,
        });
        return;
      }
      if (release) {
        await announce(release);
        return;
      }
      await dialog.showMessageBox({
        message: "Vita OS is up to date",
        detail: `You have ${current}, the newest version.`,
      });
    },

    setChecksAutomatically(on: boolean) {
      preferences.update({ checkForUpdates: on });
    },
  };
}
