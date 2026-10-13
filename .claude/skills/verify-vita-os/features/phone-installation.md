# Phone installation and shared Note capture

Vita OS supplies a standalone web app manifest, Android icons including a maskable icon, an Apple touch icon, and phone metadata. An incoming text share automatically saves a standalone Note after sign-in. Failed saves retain their text and offer Retry; additional shares wait behind earlier unsaved ones.

Status: proven on c03470d (#389); `/share-target` re-driven in #394 (bb54a79) at 1440×900 while signed in. Not driven: the phone steps below since the Notes button was removed, native home-screen installation, and the Android share picker on a physical device.

## Sub-features

- Manifest and icon delivery, standalone display, and browser installation diagnostics.
- Text, title, and URL capture through `/share-target`.
- Shared text survives sign-in; saving uses the normal Note command.
- Retry retains text; another share cannot overwrite an unsaved share.
- A reload proves persistence.

## How to get to it (user POV)

Install Vita OS using the phone browser's home-screen installation command. In an Android app that shares text, choose Vita OS from the share picker. Sign in if needed; the saved Note lands on the Dashboard. If saving fails, use Retry.

## Driving it

No spec yet. Drive it in a scratch spec that starts signed out (`test.use({ storageState: { cookies: [], origins: [] } })`), so the share goes through sign-in:

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`/share-target?title=Phone+capture&text=Shared+from+another+app+${stamp}&url=https%3A%2F%2Fexample.com%2Fphone`);
await expect(page).toHaveURL(/\/sign-in$/);
await shot("phone-share-needs-signin");
await page.getByLabel("Email").fill(account.email);
await page.getByLabel("Password").fill(account.password);
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await expect(page.getByText("Note added")).toBeVisible();
await page.reload();
await expect(page.getByRole("banner", { name: "Vita OS" })).toBeVisible();
await page.getByRole("region", { name: "No date" }).getByRole("button", { expanded: false }).click();
await expect(page.getByText(stamp)).toBeVisible();
await shot("phone-share-persisted");
```

Retry and retention of further shares, in another scratch file whose test starts signed in:

```ts
await page.route("**/v1/notes", (route) => route.abort());
await page.goto(`/share-target?text=First+queued+${stamp}-1`);
await expect(page.getByText("could not be saved")).toBeVisible();
await page.goto(`/share-target?text=Second+queued+${stamp}-2`);
await expect(page.getByText(`First queued ${stamp}-1`)).toBeVisible();
await shot("phone-queued-before");
await page.unroute("**/v1/notes");
await page.getByRole("button", { name: "Retry", exact: true }).click();
await expect(page.getByText("Note added")).toBeVisible();
await expect.poll(() => page.evaluate(() => sessionStorage.getItem("vita-pending-shared-note"))).toBeNull();
await page.reload();
await expect(page.getByRole("banner", { name: "Vita OS" })).toBeVisible();
// unfold No date as above, then expect both `${stamp}-1` and `${stamp}-2`, and shot("phone-queued-persisted")
```

The earlier proof also fetched `/manifest.webmanifest`, decoded every referenced icon (192, 512, maskable 512, Apple 180), and checked `Page.getAppManifest` and `Page.getInstallabilityErrors` through CDP (`page.context().newCDPSession(page)`). Both error lists were empty. Repeat the share at 1440×900 to exercise desktop persistence.

## Gotchas

- At phone width, `No date` leads the list folded to one line (`<first>, <second> and <n> more`, or just the names with one or two items). Unfold it after reload before waiting for saved text.
- Wait for the header (`getByRole("banner", { name: "Vita OS" })`) after a reload before unfolding `No date`.
- A URL-driven share proves app handling; it does not prove a physical Android device's share picker.
- Pending text is held in the current tab's session storage until saving succeeds; closing the tab can discard it.
- Network request interception is only a verification tool. This feature does not provide offline support.
