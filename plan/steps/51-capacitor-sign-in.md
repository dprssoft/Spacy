# Step 51 — Capacitor app and native Google sign-in

Phase: L. Sync · Depends on: 50 · Estimate: 2 days

> **Blocked until the human has decided** the app name and bundle id (for example `com.example.<name>`), and has created Android and iOS OAuth clients in the same Google Cloud project.

## Goal
The same app as an Android and iOS app (Capacitor) that syncs with the web app through the same Google Drive app folder.

## Design
- **Capacitor wraps the static build** (`build/`); the SPA fallback and the prerendered start page work as they do on the web. The service worker is disabled inside the app (the files are local).
- **Sign-in:** Google's web token flow doesn't work in a WebView, so a native Google sign-in plugin provides the access token through the step 50 auth interface. The `GoogleDriveStore` is unchanged.
- **Storage:** IndexedDB in the WebView, as on the web. Ask the OS for persistent storage where available.
- **CSP:** the app's origin (`capacitor://localhost`, `https://localhost`) is covered by the same policy (a `<meta>` CSP, since there are no response headers in the app).

## Tasks
1. Add Capacitor (`@capacitor/core`, `cli`, `android`, `ios`) and its config; a `pnpm build:mobile` that builds and syncs the native projects.
2. A native auth implementation behind the step 50 interface (chosen at runtime when running inside Capacitor).
3. App icons and splash from `static/logo.svg`.
4. README: building and running the mobile apps.

## Tests
- Unit: the runtime picks the native auth inside Capacitor and GIS on the web.
- **Manual:** the Android emulator and an iOS simulator sign in and sync with the web app (record in PROGRESS).

## Acceptance criteria
- [ ] `pnpm verify` passes
- [ ] The manual Android and iOS sync check passes

## Out of scope
Store listings and publishing, push notifications, background sync while the app is closed.

## Commit
`feat(mobile): Capacitor app with native Google sign-in`
