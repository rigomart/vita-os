/*
 * The desktop app's releases are GitHub Releases of this repository tagged
 * `desktop-v<version>` (.github/workflows/release-desktop.yml). This is the
 * app's one network call (ADR 0043).
 */

export const RELEASES_URL =
  "https://api.github.com/repos/rigomart/vita-os/releases?per_page=30";

/** Where a person finds them by hand. */
export const RELEASES_PAGE = "https://github.com/rigomart/vita-os/releases";

const TAG = /^desktop-v(\d+)\.(\d+)\.(\d+)$/;

export interface Release {
  version: string;
  /** The release's page, where its .dmg is. */
  url: string;
}

/** Below zero when `a` is older than `b`, as for `Array.sort`. Both are `x.y.z`. */
export function compareVersions(a: string, b: string): number {
  const [left, right] = [a, b].map((version) => version.split(".").map(Number));
  for (let part = 0; part < 3; part += 1) {
    const difference = (left![part] ?? 0) - (right![part] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The newest published desktop release in GitHub's answer. Drafts,
 * prereleases and anything not tagged `desktop-v<x.y.z>` don't count.
 */
export function newestDesktopRelease(answer: unknown): Release | undefined {
  if (!Array.isArray(answer)) {
    throw new Error(
      "GitHub answered with something other than a release list.",
    );
  }
  const releases = answer.flatMap((entry): Release[] => {
    const { tag_name, html_url, draft, prerelease } = (entry ?? {}) as Record<
      string,
      unknown
    >;
    if (draft !== false || prerelease !== false) return [];
    if (typeof tag_name !== "string" || typeof html_url !== "string") return [];
    const match = tag_name.match(TAG);
    return match ? [{ version: match.slice(1).join("."), url: html_url }] : [];
  });
  return releases.sort((a, b) => compareVersions(b.version, a.version))[0];
}

/** A newer release than `current`, or nothing. Rejects when GitHub can't be asked. */
export async function newerRelease(
  current: string,
  url = RELEASES_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Release | undefined> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15_000),
  }).catch((cause: unknown) => {
    throw new Error("GitHub couldn't be reached.", { cause });
  });
  if (!response.ok) {
    throw new Error(
      `GitHub answered ${response.status} ${response.statusText}.`,
    );
  }
  const newest = newestDesktopRelease(await response.json());
  return newest && compareVersions(newest.version, current) > 0
    ? newest
    : undefined;
}
