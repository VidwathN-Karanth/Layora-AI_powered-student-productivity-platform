# Layora Quick Access — browser extension

A Manifest V3 popup that puts a student's quick launchers and course list one
click from any tab. Chrome, Edge, Brave and any other Chromium browser.

## What it does

- **Quicklaunch** — the student's saved links, click to open, `+` to add a new
  one. A link added here appears on the Layora dashboard too.
- **Courses** — their courses with platform and progress. Clicking one opens
  Layora's courses page (Layora stores no per-course URL — see *Known limits*).

## Running it locally

There is no build step. Load the folder as-is:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Open Layora's `/extension` page while signed in and press **Connect**.

Change a file, press the reload arrow on the extension card, done.

## Packaging

```
python extension/build-zip.py
```

Writes `public/layora-extension.zip` — what the `/extension` page offers for
download, and what gets uploaded to the Chrome Web Store. Re-run it after any
change here, or the download will be stale.

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
| `manifest.json` | MV3 config. `storage` + `alarms`, host permission for the Layora origin only |
| `popup.html/.css/.js` | The 360×480 popup: two tabs, add form, cache-first rendering |
| `lib.js` | Storage helpers and the API wrapper, shared by popup and worker |
| `background.js` | Receives the pairing token, refreshes the cache every 15 min |
| `connect.js` | Content script on Layora's `/extension` page; relays the token |
| `build-zip.py` | Packages the folder for distribution |

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
- **Firefox** needs its own listing and a `browser_specific_settings` block;
  the code is otherwise portable.
