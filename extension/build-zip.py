"""Package the extension for distribution.

Writes two zips from the one source folder, because the two engines disagree
about exactly one manifest key:

    public/layora-extension.zip          Chrome, Edge, Brave, any Chromium
    public/layora-extension-firefox.zip  Firefox

Only the manifest differs; every script is byte-identical between them. The
differences are forced, not stylistic:

  * Firefox's MV3 has no background service worker. It runs a non-persistent
    event page instead, declared as `background.scripts`. background.js already
    registers all its listeners synchronously at top level and keeps its state
    in storage, so it needs no change to run as one.
  * `externally_connectable` is Chromium-only. Dropping it from the Firefox
    build costs nothing — connect.js, the content script, is the pairing path
    that actually runs, and the manifest key is only the Web Store fallback.
  * Firefox needs an add-on id of its own and an explicit data-collection
    declaration, which AMO now requires of every new extension. The version
    floor is 142 because that declaration is itself only understood from 142
    onwards; ES modules in background scripts, the other hard requirement here,
    landed well before that at 128.

Run from the repository root:

    python extension/build-zip.py

Re-run it after any change in this folder — the zip is a build artifact that
happens to be committed, because Vercel only serves what is in public/.
"""

import json
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "public", "layora-extension.zip")
OUT_FIREFOX = os.path.join(ROOT, "public", "layora-extension-firefox.zip")

GECKO_ID = "layora-quick-access@layora239.vercel.app"

# Everything the browser loads, and nothing else. The zip's root must be the
# manifest itself: Chrome rejects a zip whose manifest sits in a subfolder.
INCLUDE = [
    "manifest.json",
    "popup.html",
    "popup.css",
    "popup.js",
    "lib.js",
    "background.js",
    "connect.js",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
]


def firefox_manifest() -> str:
    """The Chromium manifest, with the three Gecko differences applied."""
    with open(os.path.join(HERE, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)

    manifest["background"] = {"scripts": ["background.js"], "type": "module"}
    manifest.pop("externally_connectable", None)
    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": GECKO_ID,
            "strict_min_version": "142.0",
            # Required on AMO for new extensions. "none" is the honest answer:
            # the extension talks to one origin, the student's own Layora
            # account, and sends nothing anywhere else. Revisit this the day it
            # gains analytics or a second endpoint.
            "data_collection_permissions": {"required": ["none"]},
        }
    }

    return json.dumps(manifest, indent=2) + "\n"


def build(out: str, manifest_override: str | None = None) -> None:
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in INCLUDE:
            if name == "manifest.json" and manifest_override is not None:
                zf.writestr(name, manifest_override)
                continue

            path = os.path.join(HERE, name)
            if not os.path.exists(path):
                raise SystemExit(f"missing: {name}")
            zf.write(path, name)

    size = os.path.getsize(out)
    print(f"{out} ({size / 1024:.1f} KB, {len(INCLUDE)} files)")


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    build(OUT)
    build(OUT_FIREFOX, firefox_manifest())


if __name__ == "__main__":
    main()
