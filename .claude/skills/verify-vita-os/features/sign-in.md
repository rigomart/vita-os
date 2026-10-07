# Sign in

A user with an email and password account signs in from `/sign-in` and lands on the Dashboard. A signed-out visit to any product route redirects to `/sign-in`, and a signed-in visit to `/sign-in` redirects to `/`.

Status: proven on 1d2885d by an independent cold run (`bun run verify signin`). Re-driven on b2bd91a with `sign-in.flow`: menu sign-out, signed-out product-route gate, form sign-in with an API-recognized session, and signed-in `/sign-in` redirect. Evidence: `.verify/evidence/signin426/2026-10-07T06-08-48-371Z/`. Wrong-password errors were not re-driven in this flow.

## Sub-features

- `signin-form` signs in with email and password and lands on `/`.
- `signin-session` leaves a session the API recognizes at `/api/auth/get-session`.
- `signin-gate` redirects a signed-out product route to `/sign-in`.
- `signin-error` shows a `role="alert"` message for wrong credentials.

## How to get to it (user POV)

- Open `/sign-in` directly.
- Open any product route (`/`, `/threads/<slug>`) while signed out and get redirected there.
- Choose `Sign out` from the user menu, then sign in again.

## Driving it with agent-browser

Repeatable flow: `bun run verify run .claude/skills/verify-vita-os/flows/sign-in.flow`, after a fresh `up` and one `signin`. It checks session persistence after sign-out and sign-in; the signup session created by `up` stays in D1, so counts are 2 → 1 → 2.

Preconditions:

- The instance is up and its throwaway user exists (`bun run verify up`).
- For `signin-gate` and `signin-error`, start signed out: `bun run verify browser -- cookies clear`.

- **Sign in.** Run `bun run verify signin`. It prints `"signedInAs": "<instance email>"` and `"url": "http://localhost:<webPort>/"`.
- **Manual form.** Open the form with `bun run verify browser -- open http://localhost:<webPort>/sign-in` and wait for `Sign in to your account to continue`. Fill with `find label "Email" fill <email>` and `find label "Password" fill <password>`, then `find role button click --name "Sign In" --exact`. The dock `nav[aria-label="Primary"]` appears.
- **Gate.** After `cookies clear`, run `bun run verify browser -- open http://localhost:<webPort>/`. The URL becomes `/sign-in` and the card title reads `Sign In`.
- **Error.** Fill a wrong password and click `Sign In`. An element with `role="alert"` appears and the URL stays `/sign-in`.
- **Proof.** `bun run verify shot signin-after` shows the Dashboard with the dock.

## Gotchas

- The button reads `Signing in...` with `aria-busy` while the request runs. Wait for the dock, not for the button text.
- "Checking your session..." shows while the session loads. It is not an error.
- Do not click `Continue with GitHub` or `Continue with Google`. No local OAuth credentials exist.
- Repeated failed sign-ins may hit Better Auth rate limiting. Not yet observed locally.
