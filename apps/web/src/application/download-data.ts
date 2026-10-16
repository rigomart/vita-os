import { format } from "date-fns";

import type { versionAwareFetch } from "../lib/version-aware-fetch";

/**
 * Save all of the signed-in person's data, as the API exports it, to a file
 * named for today's local date. Rejects when the API refuses or is unreachable,
 * so the menu can say the download failed.
 *
 * The export is a GET, so a version reload would not wait for it on its own;
 * holding the monitor keeps a reload from cutting the download short.
 */
export function downloadData({
  apiBaseUrl,
  monitor,
  now = new Date(),
}: {
  apiBaseUrl: string;
  monitor: Pick<typeof versionAwareFetch, "fetch" | "hold">;
  now?: Date;
}): Promise<void> {
  return monitor.hold(() => save(apiBaseUrl, monitor.fetch, now));
}

async function save(
  apiBaseUrl: string,
  fetchImpl: typeof fetch,
  now: Date,
): Promise<void> {
  const response = await fetchImpl(
    `${apiBaseUrl.replace(/\/+$/, "")}/v1/export`,
    {
      method: "GET",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(`The export failed with status ${response.status}.`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `vita-os-export-${format(now, "yyyy-MM-dd")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
