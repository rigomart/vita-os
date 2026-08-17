// PROTOTYPE (issue #291) — THROWAWAY CODE, do not ship.
//
// One controller shared by every Inbox entry point (top bar, mobile tab bar,
// command palette, both Plan chip surfaces) and by the surfaces themselves.
//
// "Open" is the `?inbox=true` search param on the authenticated route, so the
// surface rides on top of whatever page is showing and closing returns exactly
// there — same trick the Thread rail plays with `?thread=`.

import { useNavigate, useSearch } from "@tanstack/react-router";
import { createContext, use, useMemo } from "react";

import type { InboxFormKey } from "./inbox-prototype-switcher";

interface InboxPrototypeValue {
  /** Which candidate form is being evaluated. `current` = today's behaviour. */
  variant: InboxFormKey;
  /** True while a prototype form is active — entry points should summon. */
  summons: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const fallback: InboxPrototypeValue = {
  variant: "current",
  summons: false,
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
};

const InboxPrototypeContext = createContext<InboxPrototypeValue>(fallback);

export function useInboxPrototype() {
  return use(InboxPrototypeContext);
}

export function InboxPrototypeProvider({
  variant,
  children,
}: {
  variant: InboxFormKey;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { inbox } = useSearch({ from: "/_authenticated" });
  const summons = variant !== "current";
  const isOpen = summons && inbox === true;

  const value = useMemo<InboxPrototypeValue>(() => {
    // Open and close both `replace`: summoning a panel over the current page
    // should not add a history entry that closing then has to unwind twice.
    const open = () => {
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, inbox: true }),
        replace: true,
      });
    };
    const close = () => {
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, inbox: undefined }),
        replace: true,
      });
    };
    return {
      variant,
      summons,
      isOpen,
      open,
      close,
      toggle: () => (isOpen ? close() : open()),
    };
  }, [isOpen, navigate, summons, variant]);

  return (
    <InboxPrototypeContext value={value}>{children}</InboxPrototypeContext>
  );
}
