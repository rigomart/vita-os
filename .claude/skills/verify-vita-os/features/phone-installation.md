# Phone installation and shared Note capture

Vita OS supplies a standalone web app manifest, Android icons including a maskable icon, an Apple touch icon, and phone metadata. An incoming text share automatically saves a standalone Note after sign-in. Failed saves retain their text and offer Retry; additional shares wait behind earlier unsaved ones.

Status: proven on c03470d with working-tree changes (browser manifest diagnostics, share landing URL, sign-in, retry, queued shares, phone and desktop persistence). Re-driven on 446055e at 1440×900 while signed in: `/share-target` saves (`Note added`), lands on `/`, and the Note is on the Dashboard after a reload and in D1. The recipe's phone steps below were updated for the removed Notes button and are not re-driven. Native home-screen installation and the Android system share picker are not yet driven on physical devices.

## Sub-features

- Manifest and icon delivery, standalone display, and browser installation diagnostics.
- Text, title, and URL capture through `/share-target`.
- Shared text survives sign-in; saving uses the normal Note command.
- Retry retains text; another share cannot overwrite an unsaved share.
- Reload and read-only D1 checks prove persistence.

## How to get to it (user POV)

Install Vita OS using the phone browser's home-screen installation command. In an Android app that shares text, choose Vita OS from the share picker. Sign in if needed; the saved Note lands on the Dashboard. If saving fails, use Retry.

## Driving it with agent-browser

Start an isolated instance and use its printed ports and credentials. The proof run used `--instance phone --web-port 5291 --api-port 8891`.

```bash
bun run verify up --instance phone --web-port 5291 --api-port 8891
bun run verify browser --instance phone -- open http://localhost:5291/sign-in
bun run verify browser --instance phone -- set viewport 390 844
bun run verify shot --instance phone phone-share-before
bun run verify browser --instance phone -- open 'http://localhost:5291/share-target?title=Phone+capture&text=Shared+from+another+app+phone-proof-1001&url=https%3A%2F%2Fexample.com%2Fphone'
bun run verify browser --instance phone -- wait --url '**/sign-in'
bun run verify shot --instance phone phone-share-needs-signin
# Fill Email and Password with this instance's credentials, then:
bun run verify browser --instance phone -- find role button click --name 'Sign In' --exact
bun run verify browser --instance phone -- wait --text 'Note added'
bun run verify browser --instance phone -- reload
bun run verify browser --instance phone -- wait 'nav[aria-label="Primary"]'
bun run verify browser --instance phone -- find role button click --name 'No date'
bun run verify browser --instance phone -- wait --text phone-proof-1001
bun run verify shot --instance phone phone-share-persisted
bun run verify d1 --instance phone "SELECT body, state FROM notes"
```

To exercise retry and retention of additional shares:

```bash
bun run verify browser --instance phone -- network route 'http://localhost:8891/v1/notes' --abort
bun run verify browser --instance phone -- open 'http://localhost:5291/share-target?text=First+queued+phone-proof-1004'
bun run verify browser --instance phone -- wait --text 'could not be saved'
bun run verify browser --instance phone -- open 'http://localhost:5291/share-target?text=Second+queued+phone-proof-1005'
bun run verify browser --instance phone -- wait --text 'First queued phone-proof-1004'
bun run verify shot --instance phone phone-queued-before
bun run verify browser --instance phone -- network unroute 'http://localhost:8891/v1/notes'
bun run verify browser --instance phone -- find role button click --name Retry --exact
bun run verify browser --instance phone -- wait --text 'Note added'
bun run verify browser --instance phone -- wait --fn 'sessionStorage.getItem("vita-pending-shared-note") === null'
bun run verify browser --instance phone -- reload
bun run verify browser --instance phone -- wait 'nav[aria-label="Primary"]'
bun run verify browser --instance phone -- find role button click --name 'No date'
bun run verify browser --instance phone -- wait --text phone-proof-1004
bun run verify browser --instance phone -- wait --text phone-proof-1005
bun run verify shot --instance phone phone-queued-persisted
bun run verify d1 --instance phone "SELECT body, state FROM notes"
```

The browser proof also fetched `/manifest.webmanifest`, decoded every referenced icon (192, 512, maskable 512, Apple 180), and checked `Page.getAppManifest` and `Page.getInstallabilityErrors` through the isolated browser's CDP endpoint. Both error lists were empty. Repeat sharing with `set viewport 1440 900` to exercise desktop persistence.

## Gotchas

- At phone width, undated Dashboard content starts collapsed. Unfold `No date` after reload before waiting for saved text.
- Wait for the Primary navigation after a reload before unfolding `No date`.
- A URL-driven share proves app handling; it does not prove a physical Android device's share picker.
- Pending text is held in the current tab's session storage until saving succeeds; closing the tab can discard it.
- Network request interception is only a verification tool. This feature does not provide offline support.
