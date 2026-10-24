# Sign in

Signing up with a name, email and password, or signing in with an email and password, lands on the Dashboard. Signed out, every product route goes to `/sign-in`, and Sign out in the account menu ends the session.

## Entry points and variants

- `/sign-up` (Name, Email, Password, `Sign Up`) and `/sign-in` (Email, Password, `Sign In`), each linking to the other
- The account menu (`button "<name>"` in the header) → `Sign out`

## Preconditions

- None for sign-up. Sign-in and Sign out need a user created through `/sign-up`.

## Checks

1. Sign-up lands on `/` with the header's account button named exactly as the Name typed, and the empty board reads `Nothing is asking for you.`
2. Sign out lands on `/sign-in` (`location.pathname`).
3. Signed out, opening `/?thread=<slug>` lands on `/sign-in`.
4. A wrong password stays on `/sign-in` and shows exactly `Invalid email or password` (`[role=alert]` or the toast), with the password box keeping its value.
5. The right password lands on `/` and the Dashboard renders (`[aria-label='New thread']`).
6. After Sign out and signing in again the user has exactly one session:
   `SELECT COUNT(*) AS n FROM session WHERE userId = (SELECT id FROM user WHERE email = '<email>')` → `[{"n":1}]`

## Traps

- `Continue with GitHub` and `Continue with Google` have no local credentials; do not click them.
- The form's boxes are named by `<label>`: use `find label "Email"`, not `[aria-label=Email]`.
- `/` is the address before the Dashboard renders: wait for `[aria-label='New thread']`, not the URL.
