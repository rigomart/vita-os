/** `navigator.userAgentData` is not in the DOM lib yet. */
type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: { platform?: string };
};

/**
 * Whether the keyboard in front of the user carries ⌘ rather than Ctrl, so
 * shortcut hints can be labelled for the platform they are read on.
 *
 * Read at call time rather than at module load: the value stays stubbable in
 * tests and safe to import during SSR, where there is no `navigator` at all.
 */
export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;

  // `userAgentData.platform` is the supported reading; `platform` is
  // deprecated but still the broadest fallback, and the UA string covers the
  // browsers that report neither. Empty values fall through, so `||` not `??`.
  const platform =
    (navigator as NavigatorWithUserAgentData).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    "";

  return /mac|iphone|ipad|ipod/i.test(platform);
}
