import { Navigate } from "@tanstack/react-router";

/**
 * The Inbox has no page of its own — it is summoned over whatever is showing.
 * Its old address survives as a deep link onto the Dashboard with it open,
 * carrying any other search param (an open Thread, say) across.
 */
export function InboxDeepLinkRedirect() {
  return (
    <Navigate
      to="/"
      search={(previous) => ({ ...previous, inbox: true })}
      replace
    />
  );
}
