// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// Four candidate forms for summoning the Inbox in place over any page:
//
//   current — today's /inbox page (reference point)
//   rail    — right-side push rail, like the Thread detail rail
//   drawer  — right-side sheet overlaying everything, including the Thread rail
//   popover — small non-modal panel hanging under the top bar
//
// The form is kept in the URL (`?inboxForm=`) for shareability and mirrored to
// localStorage so it survives in-app navigation (router links drop unknown
// params). All three prototype forms fall back to a bottom drawer on small
// screens.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const INBOX_FORMS = [
  { key: "current", name: "current /inbox page" },
  { key: "rail", name: "push rail" },
  { key: "drawer", name: "overlay drawer" },
  { key: "popover", name: "top-bar popover" },
] as const;

export type InboxFormKey = (typeof INBOX_FORMS)[number]["key"];

const STORAGE_KEY = "inbox-prototype-form-291";
const URL_PARAM = "inboxForm";

/**
 * Contexts where ArrowLeft/ArrowRight already mean something. `[data-slot$=
 * "-content"]` is the catch-all: every portaled popup in `packages/ui` (dialog,
 * alert-dialog, popover, drawer, sheet, dropdown-menu, select, combobox) tags
 * its popup that way, and `[data-slot="calendar"]` covers the When picker's
 * day grid even when its roles change.
 */
const ARROW_KEY_OPT_OUT_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  '[contenteditable="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="grid"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="combobox"]',
  '[data-slot="calendar"]',
  '[data-slot$="-content"]',
].join(",");

function isFormKey(value: string | null): value is InboxFormKey {
  return INBOX_FORMS.some((form) => form.key === value);
}

export function useInboxFormVariant() {
  const [variant, setVariantState] = useState<InboxFormKey>(() => {
    if (import.meta.env.PROD || typeof window === "undefined") return "current";
    const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
    if (isFormKey(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isFormKey(stored)) return stored;
    return "current";
  });

  const setVariant = useCallback((key: InboxFormKey) => {
    setVariantState(key);
    window.localStorage.setItem(STORAGE_KEY, key);
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM, key);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return [variant, setVariant] as const;
}

export function InboxPrototypeSwitcher({
  variant,
  onVariantChange,
}: {
  variant: InboxFormKey;
  onVariantChange: (key: InboxFormKey) => void;
}) {
  const index = INBOX_FORMS.findIndex((form) => form.key === variant);

  const cycle = useCallback(
    (delta: number) => {
      const next =
        INBOX_FORMS[(index + delta + INBOX_FORMS.length) % INBOX_FORMS.length];
      onVariantChange(next.key);
    },
    [index, onVariantChange],
  );

  useEffect(() => {
    // The listener itself is dev-only: in a shipped build one stray ArrowRight
    // would write localStorage, rewrite the URL and turn the prototype on.
    if (import.meta.env.PROD) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      // Arrows belong to whatever is focused first: text fields, any focusable
      // control (react-day-picker's day cells are <button>s), and anything
      // inside a portaled overlay — dialogs, popovers, menus, listboxes.
      if (target?.closest?.(ARROW_KEY_OPT_OUT_SELECTOR)) return;
      e.preventDefault();
      cycle(e.key === "ArrowLeft" ? -1 : 1);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cycle]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-500/50 bg-zinc-900 py-1 pr-3 pl-1 text-zinc-50 shadow-lg md:bottom-4 dark:bg-zinc-100 dark:text-zinc-900">
      <button
        type="button"
        // Blur so the arrow-key opt-out (which skips <button>) keeps working
        // after a click on the pill itself.
        onClick={(event) => {
          event.currentTarget.blur();
          cycle(-1);
        }}
        aria-label="Previous Inbox form"
        className="flex size-7 items-center justify-center rounded-full hover:bg-zinc-700 dark:hover:bg-zinc-300"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        // Blur so the arrow-key opt-out (which skips <button>) keeps working
        // after a click on the pill itself.
        onClick={(event) => {
          event.currentTarget.blur();
          cycle(1);
        }}
        aria-label="Next Inbox form"
        className="flex size-7 items-center justify-center rounded-full hover:bg-zinc-700 dark:hover:bg-zinc-300"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="text-xs font-medium whitespace-nowrap tabular-nums">
        {variant} — {INBOX_FORMS[index]?.name}
      </span>
    </div>
  );
}
