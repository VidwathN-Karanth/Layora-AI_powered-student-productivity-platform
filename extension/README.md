# Layora Quick Access — browser extension

A Manifest V3 popup that puts a student's quick launchers and course list one
click from any tab. Chrome, Edge, Brave and any other Chromium browser, and
Firefox.

## Two workspaces

The popup serves two workspaces — **Layora** and **Club-Crumbs** — from a
single install. They are the same application deployed at their own origins, so
they expose an identical `/api/extension/*` API and an identical `/extension`
connect page; the extension only has to know the two origins and keep the
tokens apart.

A switcher in the header holds one button per workspace. A button is **disabled
until that workspace is connected** — pairing happens on the workspace's own
site (see *How it authenticates*), and that is what enables the button. Pressing
an enabled button switches the lists, the account line and every outbound link
to that workspace instantly, because each workspace keeps its own token and its
own cache. Both can be connected at once.

## What it does

- **Quicklaunch** — the student's saved links, click to open, `+` to add a new
  one. A link added here appears on the active workspace's dashboard too.
- **Courses** — their courses with platform and progress. Clicking one opens
  the active workspace's courses page (neither stores a per-course URL — see
  *Known limits*).

## Running it locally

There is no build step. Load the folder as-is:

**Chromium:**

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Open Layora's `/extension` page while signed in and press **Connect**.

Change a file, press the reload arrow on the extension card, done.

**Firefox** is published, so students install it from the listing:
<https://addons.mozilla.org/en-US/firefox/addon/layora-quick-access/>

To load a *development* build instead, run `python extension/build-zip.py` and
open `public/layora-extension-firefox.zip` through `about:debugging` → **This
Firefox** → **Load Temporary Add-on…**. Firefox drops a temporary add-on when
it closes; the published one is permanent.

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

Instead: the student presses Connect on a workspace's `/extension` page, which
mints a token (`POST /api/extension/token`) and posts it to its own window.
`connect.js` — a content script that runs on both workspaces' `/extension`
pages — relays it to the service worker. The worker files the token under the
workspace the message came *from* (`serviceForOrigin`), so a Club-Crumbs token
can never land in the Layora slot, and stores it in `chrome.storage.local`.
Every API call then carries `Authorization: Bearer …` against that workspace.

The API still accepts a session cookie as well, so the same endpoints work from
a signed-in tab, and so this can move to cookie auth later without a rewrite.

Tokens are stored server-side as SHA-256 hashes, are checked against the roster
on every request, and can be revoked per browser from the same page.

## Files

| File | Job |
|---|---|
| `manifest.json` | MV3 config for Chromium. `storage` + `alarms`, host permission for both workspace origins. The Firefox manifest is generated from it by `build-zip.py` |
| `popup.html/.css/.js` | The 360×480 popup: workspace switcher, two tabs, add form, cache-first rendering |
| `lib.js` | The `SERVICES` map, per-workspace storage helpers and the API wrapper, shared by popup and worker |
| `background.js` | Files an incoming pairing token by origin, refreshes each connected workspace's cache every 15 min |
| `connect.js` | Content script on both workspaces' `/extension` pages; relays the token |
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

## Workspaces and origins

Each workspace's origin appears in two files, and every copy must agree:

- the `SERVICES` map in `lib.js` (id, label, origin)
- `host_permissions`, `externally_connectable.matches` and
  `content_scripts.matches` in `manifest.json`

To add or move a workspace, edit those, then re-run `build-zip.py`. Nothing else
references an origin directly — the popup, worker and content script all work in
terms of a workspace id or the page's own origin.

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
  for anything loaded through `about:debugging`. It only affects development
  builds — the published listing installs permanently.
- **Chrome has no store listing yet**, so Chromium users still install the zip
  by hand. `/extension` shows them that route and shows Firefox users the
  listing instead, picking by user agent.
