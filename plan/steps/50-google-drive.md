# Step 50 — Google Drive and sync settings

Phase: L. Sync · Depends on: 49 · Estimate: 2 days

> **Blocked until the human has decided** the production domain (part of the Google OAuth registration; the app name is decided: **Spacy**), and has created the OAuth client (see "Human setup"). Steps 47–49 don't need them.

## Goal
"Connect Google Drive" in Settings turns sync on in one click and a Google sign-in. Boards then sync through a hidden app folder in the user's own Drive, and the app shows the sync state.

## Human setup (once, before this step)
1. Google Cloud Console → a new project → enable the **Google Drive API**.
2. OAuth consent screen: app name, support email, the **privacy policy URL** and the home page URL on the production domain. Scope: `https://www.googleapis.com/auth/drive.appdata` only (the hidden app folder; the app can't see the user's other files).
3. Credentials → OAuth client ID → type **Web application**. Authorized JavaScript origins: the production origin and `http://localhost:4173` (e2e/preview) and `http://localhost:5173` (dev).
4. Put the client id in the build environment as `PUBLIC_GOOGLE_CLIENT_ID`. Without it the sync UI is hidden.
5. Submit the app for verification before publishing it beyond test users.

## Design
- **`GoogleDriveStore`** implements `RemoteStore` with the Drive v3 REST API (`fetch`, no SDK):
  - files live in `appDataFolder` and carry `appProperties`
  - `changes.list` with `spaces=appDataFolder` provides the cursor
  - uploads are multipart, or resumable above 5 MB
- **Sign-in:** Google Identity Services' token model (`google.accounts.oauth2.initTokenClient`), which gives an access token valid for about an hour, renewed without a prompt while the user is signed in to Google (`prompt: ''`).
  - The token is kept in memory only.
  - If renewal needs the user ("Sign in again"), sync pauses and the status says so.
  - The GIS script loads only once sync is turned on.
- **Auth interface** (`storage/sync/auth.ts`: `getToken()`, `signOut()`) so the Capacitor app can plug in a native Google sign-in later without touching the store.
- **CSP:**
  - `script-src` adds `https://accounts.google.com/gsi/client`
  - `frame-src` adds `https://accounts.google.com`
  - `connect-src` adds `https://www.googleapis.com` and `https://oauth2.googleapis.com`
  - Update `csp.spec.ts`.
- **Settings → Sync:** "Connect Google Drive" → the account email and the last sync time → "Sync now", "Disconnect". Disconnecting keeps local boards and asks whether to also delete the copy in Drive.
- **Status:** a cloud icon next to "Saved locally" (top bar) and on the start page: Synced · Syncing… · Offline · Sign in again · Error. A board that needs a newer app version says so.
- **Privacy texts:** README "Data & privacy", the backup reminder and the first-run tips say boards stay in the browser **unless** Drive sync is on, and then also in the user's own Drive.

## Tasks
1. `GoogleDriveStore`, the auth interface and the GIS implementation, config through `PUBLIC_GOOGLE_CLIENT_ID`.
2. Settings → Sync section, status indicators, the "Sign in again" flow.
3. CSP changes and the `csp.spec.ts` update.
4. A privacy policy page (`/privacy`, static, prerendered) and the privacy text updates.

## Tests
- `googleDrive.test.ts` against recorded Drive API responses (fetch mocked): listing changes, create/read/remove, resumable upload, a 401 → token renewal → retry, 403 rate limit → backoff.
- e2e `sync.spec.ts` with the Drive API and GIS mocked by Playwright routes (a fake in-memory Drive server):
  - connect → a board made in context A appears in context B
  - disconnect
  - offline → online catches up
  - axe on the Settings section
- **Manual check with a real Google test account** on two browsers (record in PROGRESS): create, edit, image, trash, purge, offline edit.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] The manual two-browser check with a real account passes
- [ ] `00-architecture.md` §14: Drive layout, auth, CSP

## Out of scope
Other providers (Dropbox, OneDrive, WebDAV: the `RemoteStore` interface allows them later), end-to-end encryption, sharing, the Capacitor sign-in (step 51).

## Commit
`feat(sync): sync through Google Drive`
