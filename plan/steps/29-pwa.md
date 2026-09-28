# Step 29 — PWA, settings menu, backup reminder

Phase: H. Release · Depends on: 28 · Estimate: 1 day

## Goal
An installable, fully offline-capable app with an update prompt and `.smthng` file handling, plus a settings menu (theme, install, storage info, backup/restore, about) and a backup reminder.

## Read first
- `00-architecture.md` §6 (localStorage keys)
- `src/lib/storage/{persist.ts, fileFormat.ts}`

## Tasks
1. **Logo and icons:** create `static/logo.svg` (a simple geometric mark: an indigo rounded square with a white diamond and a connector line). Generate `favicon.svg`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png` and `apple-touch-icon.png` with `@vite-pwa/assets-generator` (dev dependency, script `pnpm icons`), or commit pre-generated files if the generator can't run.
2. **PWA plugin:** `pnpm add -D @vite-pwa/sveltekit`. In `vite.config.ts` use `SvelteKitPWA({...})`:
   - `registerType: 'prompt'`
   - `manifest`: name "SMTHNG", short_name "SMTHNG", description, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, theme_color `#4f46e5`, background_color `#f7f7f8`, the icons, and
     `file_handlers: [{ action: '/', accept: { 'application/x-smthng': ['.smthng'] } }]`
   - `workbox`: precache all client assets (`globPatterns` for js/css/html/svg/png/webp/woff2/webmanifest) and `navigateFallback: '/'` (SPA fallback → the index page), following the `@vite-pwa/sveltekit` docs for `adapter-static` with a fallback page. **Requirement:** reloading `/board/<id>` offline must work.
3. **Update prompt** `src/lib/shared/pwa.svelte.ts` using the plugin's virtual register module (`virtual:pwa-register`): when `needRefresh` → a persistent toast "A new version is available" with the action "Reload" (calls `updateServiceWorker(true)`). Never auto-reload while a board is open.
4. **File handling:** in `HomePage` (and the board page), if `'launchQueue' in window`, `launchQueue.setConsumer(async (params) => { for (const h of params.files) importFile(await h.getFile()) ... })` → navigate to the imported board if exactly one.
5. **Install:** capture `beforeinstallprompt` (preventDefault, store it) in `pwa.svelte.ts`; expose `canInstall` and `install()`.
6. **Settings menu** `src/lib/home/SettingsMenu.svelte` (the header ⚙ button, bits-ui DropdownMenu), also reachable from the board TopBar overflow:
   - Theme: Light / Dark / System (radio items)
   - Install app (only when `canInstall`)
   - Backup all boards · Restore from backup… (= import)
   - Storage: "Using 12.3 MB · Persistent: yes/no" (from `storageEstimate()`), with a "Request persistent storage" item if not persisted
   - About SMTHNG: a dialog with the version (`__APP_VERSION__` defined in `vite.config.ts` from `package.json`), the storage note "Boards are stored only in this browser. Back up regularly.", and a link to the repository (placeholder).
7. **Backup reminder** `src/lib/home/BackupReminder.svelte`: a banner at the top of the home content when the number of non-trashed boards is 3 or more AND (`lastBackupAt` missing or older than 14 days) AND (`backupReminderDismissedAt` missing or older than 7 days). Text: "Your boards live only in this browser. Back up to keep a copy." Actions: "Back up now" (runs the backup) · "Later" (sets the dismissal).

## Files
- create: `static/logo.svg` + icons, `src/lib/shared/pwa.svelte.ts`, `src/lib/home/{SettingsMenu.svelte, AboutDialog.svelte, BackupReminder.svelte}`
- modify: `vite.config.ts`, `src/app.html` (manifest and icon links if the plugin doesn't inject them), `src/app.d.ts` (`__APP_VERSION__`, `launchQueue` types), `HomeHeader.svelte`, `HomePage.svelte`, `TopBar.svelte`, `package.json`

## Tests
- `backupReminder.test.ts`: a pure function `shouldShowBackupReminder({ boardCount, lastBackupAt, dismissedAt, now })` covering all branches.
- `tests/e2e/offline.spec.ts` (Chromium): open `/`, create a board, wait for the service worker to be `activated` (`navigator.serviceWorker.ready`), `context.setOffline(true)`, reload `/board/<id>` → the board renders; reload `/` → the start page renders with the board card.
- `tests/e2e/settings.spec.ts`: the settings menu shows the storage usage and the About dialog shows the version.

## Acceptance criteria
- [ ] `pnpm verify` and `pnpm test:e2e` pass
- [ ] Chrome DevTools → Application → Manifest shows it's installable with no errors (manual)
- [ ] Lighthouse "Installable" passes (manual; record the score in PROGRESS)

## Out of scope
Push notifications, background sync.

## Commit
`feat(pwa): make SMTHNG installable and offline, add settings menu and backup reminder`
