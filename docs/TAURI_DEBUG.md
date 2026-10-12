# Debugging the Windows Tauri app with Playwright

Playwright CLI attaches to the actual WebView2 inside PathBranching using CDP.
It does not open a browser-only copy of the Vite frontend. This allows the page
to use the real Tauri commands while inspecting DOM, console and network state.

## Start

Run from the PathBranching repository, with Node, PowerShell 7, Rust/MSVC and
WebView2 installed:

```powershell
npm install
npm run tauri:debug
```

The launcher starts `tauri dev`, enables a loopback CDP endpoint on port **9222**
and sets `RUST_BACKTRACE=1`. Vite continues to use the existing **5374** port.
Terminal output is saved under `output/playwright/tauri-<timestamp>.log`.

The WebView2 profile is isolated at `output/playwright/webview2-9222/`, so the
debug session has its own preferences and recent-universe list. This does not
isolate files: opening a real universe still edits that universe. Use a disposable
copy or synthetic vault for destructive reproduction cases.

## Attach and inspect

In a second terminal, from the same repository:

```powershell
npm run pw:attach
npm run pw -- snapshot
npm run pw -- console
npm run pw -- screenshot
```

The named CLI session is `pathbranching-tauri`. Generated snapshots, logs,
screenshots and traces go to `output/playwright/`, excluded from Git. The CLI
dependency is pinned in `package-lock.json`; no separate Chromium installation
is required because the app supplies its WebView2 runtime.

Interact using references from the latest snapshot, for example:

```powershell
npm run pw -- click eX
npm run pw -- snapshot
npm run pw -- tracing-start
# Reproduce the issue with snapshot/click/fill/press commands.
npm run pw -- tracing-stop
npm run pw -- detach
```

Replace `eX` with a real reference from your snapshot. Detaching releases the
connection; close PathBranching or press Ctrl+C in its launcher terminal to stop
the app. Use Playwright for UI automation, without Computer Use. Native Windows
file/folder dialogs are completed manually by the user when needed; they are not
HTML elements addressable by Playwright locators.

## Alternate port and troubleshooting

```powershell
npm run tauri:debug -- -CdpPort 9224
npm run pw -- attach --cdp=http://127.0.0.1:9224
```

- Wait for the application window before attaching. `http://127.0.0.1:9222/json/version`
  should return the WebView2 debugging metadata.
- Port 9223 is reserved for the Suite debug session when both apps run together.
- If port 5374 is occupied, close the previous development server/app before
  starting another Tauri instance. The launcher does not terminate other processes.
- If the CLI session is already attached, detach before reconnecting after an app restart.
- An inherited `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` debugging port is rejected
  to avoid conflicting endpoints; clear that variable in the launching terminal.
- CDP and the isolated profile are enabled only by `tauri:debug`. Ordinary
  `tauri:dev` and release configuration are unchanged.

References: [Playwright WebView2](https://playwright.dev/docs/webview2) and
[Playwright CLI](https://github.com/microsoft/playwright-cli).

## Verified setup

On 2026-10-07 the launcher compiled and opened the Windows app; CLI attachment,
DOM snapshots, screenshots and trace recording succeeded. A read-only
`plugin:app|version` invocation returned `0.3.0`, confirming that this was the
native Tauri context. The initial home screen reported no console errors or
warnings. This smoke check does not establish save/reopen or export acceptance.
