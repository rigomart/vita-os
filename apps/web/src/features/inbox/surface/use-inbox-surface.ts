import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * The Inbox is summoned over whatever page is showing, so its open state lives
 * in the `?inbox=true` search param on the authenticated route — closing it
 * returns to exactly the page and params underneath. Both directions `replace`:
 * summoning a panel is not a place in history to go back to.
 */
export function useInboxSurface() {
  const navigate = useNavigate();
  const { inbox } = useSearch({ from: "/_authenticated" });
  const isOpen = inbox === true;

  const open = () => {
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, inbox: true }),
      replace: true,
    });
  };

  const close = () => {
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, inbox: undefined }),
      replace: true,
    });
  };

  return {
    isOpen,
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
  };
}
