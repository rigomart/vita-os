# Sign in

A user with an email and password account signs in from `/sign-in` and lands on the Dashboard. A signed-out visit to any product route redirects to `/sign-in`, and a signed-in visit to `/sign-in` redirects to `/`.

Status: proven on b2bd91a (#418) by `sign-in.flow`: menu sign-out, the signed-out gate, form sign-in with a session the API recognizes, and the signed-in `/sign-in` redirect. Not driven: wrong-password errors.

## Sub-features

- `signin-form` signs in with email and password and lands on `/`.
- `signin-session` leaves a session the API recognizes at `/api/auth/get-session`.
- `signin-gate` redirects a signed-out product route to `/sign-in`.
- `signin-error` shows a `role="alert"` message for wrong credentials.

## How to get to it (user POV)

- Open `/sign-in` directly.
- Open any product route (`/`, `/threads/<slug>`) while signed out and get redirected there.
- Choose `Sign out` from the user menu, then sign in again.

## Driving it

Spec: `apps/e2e/tests/sign-in.spec.ts`. Its tests start signed out (`test.use({ storageState: { cookies: [], origins: [] } })`) and count the user's sessions in D1 (`SELECT COUNT(*) AS n FROM session WHERE userId = '${account.id}'`); sign-up leaves one of its own.

- **Form.** On `/sign-in`, wait for `page.getByText("Sign in to your account to continue")`. Fill `page.getByLabel("Email")` and `page.getByLabel("Password")` with `account.email` and `account.password`, then click `getByRole("button", { name: "Sign In", exact: true })` inside `sent(page, /\/api\/auth\/sign-in\/email$/, …)`. `getByRole("banner", { name: "Vita OS" })` appears and the URL is `/`.
- **Session.** A GET of `${instance.apiUrl}/api/auth/get-session` through `page.request` answers with `user.email` equal to `account.email`.
- **Gate.** Signed out, `page.goto("/")` ends on `/sign-in` with no `banner "Vita OS"`.
- **Sign out.** Click the user menu `button "E2E Bot"` (the fixture user's name), then `menuitem "Sign out"` inside `sent(page, /\/api\/auth\/sign-out$/, …)`. The URL becomes `/sign-in` and the session count drops by one.
- **Error.** Fill a wrong password and click `Sign In`. `page.getByRole("alert")` appears and the URL stays `/sign-in`.
- **Proof.** `shot("sign-in-after")` shows the Dashboard under the sky header.

## Gotchas

- The button reads `Signing in...` with `aria-busy` while the request runs. Wait for the header (`getByRole("banner", { name: "Vita OS" })`), not for the button text.
- "Checking your session..." shows while the session loads. It is not an error.
- Do not click `Continue with GitHub` or `Continue with Google`. No local OAuth credentials exist.
- Repeated failed sign-ins may hit Better Auth rate limiting. Not yet observed locally.
