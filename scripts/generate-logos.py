"""Generate every Layora raster mark from one definition.

The mark is a rounded purple square with a white L. It is drawn here rather
than hand-exported so the PNGs cannot drift from the React component again:
public/layora-logo.png and the extension icons used to be a purple-to-cyan
gradient while the app drew a solid square, which is how the logo ended up
looking like three different products.

Keep MARK_PURPLE in step with src/components/LayoraMark.tsx and
src/app/icon.tsx -- those two cannot import from here, one being a React
component and the other rendering in the edge runtime.

    python scripts/generate-logos.py
"""

import os

from PIL import Image, ImageDraw

MARK_PURPLE = (0xC5, 0x6B, 0xF5, 255)
GLYPH_WHITE = (0xFF, 0xFF, 0xFF, 255)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Rendered large and downsampled, which is how the curves and the stem edges
# stay clean at 16px where a directly-drawn glyph goes to mush.
SUPERSAMPLE = 8

TARGETS = [
    (os.path.join(ROOT, "public", "layora-logo.png"), 512),
    (os.path.join(ROOT, "extension", "icons", "icon128.png"), 128),
    (os.path.join(ROOT, "extension", "icons", "icon48.png"), 48),
    (os.path.join(ROOT, "extension", "icons", "icon16.png"), 16),
]


def draw_mark(size: int) -> Image.Image:
    """One mark, drawn at `size` pixels square."""
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # iOS-ish corner softness: a fifth of the side reads as rounded at 512px
    # and still survives being shrunk to a 16px favicon.
    d.rounded_rectangle([(0, 0), (s - 1, s - 1)], radius=int(s * 0.22), fill=MARK_PURPLE)

    # The L is drawn as two bars rather than set as text: font availability
    # differs between machines, and a logo that depends on whatever monospace
    # face happens to be installed is not a logo.
    stem_w = int(s * 0.13)
    top = int(s * 0.24)
    bottom = int(s * 0.76)
    left = int(s * 0.32)
    right = int(s * 0.70)
    foot_h = stem_w

    d.rectangle([(left, top), (left + stem_w, bottom)], fill=GLYPH_WHITE)
    d.rectangle([(left, bottom - foot_h), (right, bottom)], fill=GLYPH_WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    for path, size in TARGETS:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        draw_mark(size).save(path, "PNG", optimize=True)
        print(f"{os.path.relpath(path, ROOT)} ({size}x{size}, {os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
