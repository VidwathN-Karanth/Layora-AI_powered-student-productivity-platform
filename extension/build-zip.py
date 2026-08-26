"""Package the extension for distribution.

Writes public/layora-extension.zip, which the /extension page offers for
download and which is also what gets uploaded to the Chrome Web Store.

Run from the repository root:

    python extension/build-zip.py

Re-run it after any change in this folder — the zip is a build artifact that
happens to be committed, because Vercel only serves what is in public/.
"""

import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "public", "layora-extension.zip")

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


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in INCLUDE:
            path = os.path.join(HERE, name)
            if not os.path.exists(path):
                raise SystemExit(f"missing: {name}")
            zf.write(path, name)

    size = os.path.getsize(OUT)
    print(f"{OUT} ({size / 1024:.1f} KB, {len(INCLUDE)} files)")


if __name__ == "__main__":
    main()
