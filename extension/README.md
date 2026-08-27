# Layora Quick Access — browser extension

A Manifest V3 popup that puts a student's quick launchers and course list one
click from any tab. Chrome, Edge, Brave and any other Chromium browser, and
Firefox.

## What it does

- **Quicklaunch** — the student's saved links, click to open, `+` to add a new
  one. A link added here appears on the Layora dashboard too.
- **Courses** — their courses with platform and progress. Clicking one opens
  Layora's courses page (Layora stores no per-course URL — see *Known limits*).

## Running it locally

There is no build step. Load the folder as-is:

**Chromium:**

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Open Layora's `/extension` page while signed in and press **Connect**.

Change a file, press the reload arrow on the extension card, done.

**Firefox** needs the generated manifest, so run `python extension/build-zip.py`
first and load `public/layora-extension-firefox.zip` through `about:debugging`
→ **This Firefox** → **Load Temporary Add-on…**. Firefox drops a temporary
add-on when it closes.

## Packaging

```
python extension/build-zip.py
```

Writes both packages from this one folder:

- `public/layora-extension.zip` — Chrome, Edge, Brave, any Chromium
- `public/layora-extension-firefox.zip` — Firefox

Every script is byte-identical between them; only the manifest differs. The
Firefox one swaps the background service worker for an event page
(`background.scripts`), drops the Chromium-only `externally_connectable`, and
adds `browser_specific_settings.gecko`. Re-run after any change here, or the
downloads will be stale.

## How it authenticates

The popup does **not** rely on the Layora session cookie. A fetch from a
`chrome-extension://` page is cross-site and Clerk's session cookie is
`SameSite=Lax`, so the browser will not attach it.

Instead: the student presses Connect on Layora's `/extension` page, which mints
a token (`POST /api/extension/token`) and posts it to its own window.
`connect.js` — a content script that only runs on that page — relays it to the
service worker, which stores it in `chrome.storage.local`. Every API call then
carries `Authorization: Bearer …`.

The API still accepts a session cookie as well, so the same endpoints work from
a signed-in tab, and so this can move to cookie auth later without a rewrite.

Tokens are stored server-side as SHA-256 hashes, are checked against the roster
on every request, and can be revoked per browser from the same page.

## Files

| File | Job |
|---|---|
| `manifest.json` | MV3 config for Chromium. `storage` + `alarms`, host permission for the Layora origin only. The Firefox manifest is generated from it by `build-zip.py` |
| `popup.html/.css/.js` | The 360×480 popup: two tabs, add form, cache-first rendering |
| `lib.js` | Storage helpers and the API wrapper, shared by popup and worker |
| `background.js` | Receives the pairing token, refreshes the cache every 15 min |
| `connect.js` | Content script on Layora's `/extension` page; relays the token |
| `build-zip.py` | Packages the folder for distribution |

## Cross-browser notes

The two engines differ in exactly three places, all handled:

- **Namespace.** `lib.js` exports `ext`, bound to `browser` where it exists and
  `chrome` otherwise, and everything goes through it. Firefox 153 does return
  promises from its `chrome.*` alias, so this is belt-and-braces rather than a
  bug fix — but `browser.*` is the documented promise API and worth binding to
  explicitly.
- **Async message replies.** Firefox takes the reply as a promise returned from
  the listener; Chromium ignores that and needs `sendResponse` plus a
  synchronous `true`. `background.js` branches on `IS_GECKO` for this one line.
  Nothing else in the codebase cares which engine it is on.
- **Background context.** Service worker on Chromium, event page on Firefox —
  a manifest difference only. The listeners were already registered
  synchronously at top level, which is what an event page requires.

One trap worth remembering: every content script listed for the same document
shares one scope, so a top-level `const` in `connect.js` would collide with an
identically named one in any sibling script and silently abort both. That is
why `connect.js` is wrapped in an IIFE.

## Pointing it at another deployment

The origin appears in three places and all three must agree:

- `LAYORA_ORIGIN` in `lib.js`
- `host_permissions` in `manifest.json`
- `externally_connectable.matches` and `content_scripts.matches` in `manifest.json`

## Known limits

- **A course without a link opens Layora instead.** The link lives in a
  course's `platform` field — the course form labels it "Course Link (URL)" —
  so clicking a course goes straight to it. Courses saved with a plain label
  like "Self-Study" have no link, and those fall back to Layora's courses page
  where one can be added.
- **A launcher added here can be overwritten.** Launchers live inside the one
  JSON blob the web app syncs wholesale. The write is a server-side
  read-modify-write and bumps `clientTimestamp` so an open tab picks it up, but
  a tab that had already staged a write can still land it afterwards and drop
  the new launcher. Moving launchers to their own table would close it.
- **A temporary Firefox add-on disappears on restart.** That is Firefox's rule
  for anything loaded through `about:debugging`, not something this can fix.
  An AMO listing removes it.
