import type { RefObject } from "react";

import { useEffect } from "react";

import { cursorMove, nextFocusKey, stepIndex } from "./dashboard-cursor-model";

const ITEM = "[data-cursor-item]";
const FOCUSABLE = "a[href], button, input, select, textarea";
const POPOVER = "[data-slot=popover-content]";

/**
 * One keyboard cursor over the elements marked `data-cursor-item={key}` under
 * `rootRef`; an item's first focusable element opens it. The list is one Tab
 * stop: only the last-focused item keeps its controls tabbable. On an opener,
 * ↓/j, ↑/k, Home and End move between items. When a keyboard action on an
 * item's own control takes the focused element away, focus goes to the item
 * `nextFocusKey` picks; focus the person moved elsewhere is left alone.
 */
export function useDashboardCursor(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let activeKey: string | undefined;
    let pending: { key: string; order: string[] } | undefined;
    let lastFocused: { element: Element; inItemOrPopover: boolean } | undefined;
    let recoverTimer: ReturnType<typeof setTimeout> | undefined;

    const shownItems = () =>
      [...root.querySelectorAll<HTMLElement>(ITEM)].filter(isShown);

    function roveTabStop() {
      const shown = shownItems();
      const stop = shown.find((item) => keyOf(item) === activeKey) ?? shown[0];
      const stopKey = stop === undefined ? undefined : keyOf(stop);
      for (const item of root!.querySelectorAll<HTMLElement>(ITEM)) {
        const tabIndex = keyOf(item) === stopKey ? 0 : -1;
        for (const element of item.querySelectorAll<HTMLElement>(FOCUSABLE)) {
          if (element.tabIndex !== tabIndex) element.tabIndex = tabIndex;
        }
      }
    }

    function recover() {
      if (pending === undefined) return;
      const focused = document.activeElement;
      if (focused && focused !== document.body && focused.isConnected) return;
      const displaced =
        lastFocused?.inItemOrPopover === true &&
        (!lastFocused.element.isConnected ||
          lastFocused.element.matches(":disabled"));
      const { key, order } = pending;
      if (!displaced) {
        pending = undefined;
        return;
      }
      const shown = shownItems();
      const target = nextFocusKey(order, key, shown.map(keyOf));
      if (target !== key) pending = undefined;
      const item = shown.find((candidate) => keyOf(candidate) === target);
      if (item) {
        opener(item)?.focus();
        return;
      }
      root!.tabIndex = -1;
      root!.addEventListener("blur", () => root!.removeAttribute("tabindex"), {
        once: true,
      });
      root!.focus();
    }

    function onFocusIn(event: FocusEvent) {
      const target = event.target as Element;
      const item = root!.contains(target)
        ? target.closest<HTMLElement>(ITEM)
        : null;
      lastFocused = {
        element: target,
        inItemOrPopover: item !== null || target.closest(POPOVER) !== null,
      };
      if (item === null) {
        if (root!.contains(target)) pending = undefined;
        return;
      }
      const key = keyOf(item);
      if (pending !== undefined && pending.key !== key) pending = undefined;
      if (key !== activeKey) {
        activeKey = key;
        roveTabStop();
      }
    }

    function onFocusOut(event: FocusEvent) {
      // A control disabled while its write is in flight drops focus with no
      // change to the list; look once the drop has settled.
      if (event.relatedTarget !== null) return;
      clearTimeout(recoverTimer);
      recoverTimer = setTimeout(recover, 0);
    }

    function onClick(event: MouseEvent) {
      const control = (event.target as Element).closest<HTMLElement>(FOCUSABLE);
      const item = control?.closest<HTMLElement>(ITEM);
      if (!control || !item || control === opener(item)) return;
      // Pointer clicks start no recovery.
      if (event.detail !== 0 && !control.matches(":focus-visible")) return;
      pending = { key: keyOf(item), order: shownItems().map(keyOf) };
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const move = cursorMove(event);
      if (move === undefined) return;
      const target = event.target as HTMLElement;
      const item = target.closest<HTMLElement>(ITEM);
      if (!item || opener(item) !== target) return;
      event.preventDefault();
      const shown = shownItems();
      const index = stepIndex(shown.length, shown.indexOf(item), move);
      const next = index === undefined ? undefined : shown[index];
      if (next) opener(next)?.focus();
    }

    const observer = new MutationObserver(() => {
      roveTabStop();
      recover();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    roveTabStop();
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("click", onClick, { capture: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", roveTabStop);
    return () => {
      observer.disconnect();
      clearTimeout(recoverTimer);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", roveTabStop);
    };
  }, [rootRef]);
}

function keyOf(item: HTMLElement) {
  return item.dataset.cursorItem ?? "";
}

function opener(item: HTMLElement) {
  return item.querySelector<HTMLElement>(FOCUSABLE);
}

function isShown(item: HTMLElement) {
  return typeof item.checkVisibility === "function"
    ? item.checkVisibility()
    : true;
}
