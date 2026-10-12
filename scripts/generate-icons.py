#!/usr/bin/env python3
"""Regenerates every PNG icon in /icons from pure geometry (no fonts needed).

Usage:  pip install pillow && python3 scripts/generate-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

DEEP = (22, 48, 44, 255)      # #16302C
DEEP_2 = (31, 63, 57, 255)    # #1F3F39
AMBER = (217, 162, 44, 255)   # #D9A22C
CREAM = (250, 247, 240, 255)  # #FAF7F0

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)
SS = 4  # supersampling factor for smooth edges


def draw_mark(size: int, safe: float, rounded: bool) -> Image.Image:
    """Draw the icon. `safe` is the fraction of the canvas the mark may occupy."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=DEEP)
    else:
        d.rectangle([0, 0, s, s], fill=DEEP)

    c = s / 2
    r_bg = s * safe * 0.5
    d.ellipse([c - r_bg, c - r_bg, c + r_bg, c + r_bg], fill=DEEP_2)

    r = s * safe * 0.40
    w = max(int(s * 0.045), 2)
    d.ellipse([c - r, c - r, c + r, c + r], outline=AMBER, width=w)

    lw = max(int(s * 0.03), 2)
    d.line([c, c - r * 0.62, c, c + r * 0.62], fill=CREAM, width=lw)
    d.line([c, c, c + r * 0.42, c + r * 0.22], fill=AMBER, width=lw)

    h = s * 0.035
    d.ellipse([c - h, c - h, c + h, c + h], fill=CREAM)

    return img.resize((size, size), Image.LANCZOS)


def save(name: str, size: int, safe: float, rounded: bool) -> None:
    draw_mark(size, safe, rounded).save(OUT / name, optimize=True)
    print("wrote", OUT / name)


if __name__ == "__main__":
    save("icon-192.png", 192, 0.86, rounded=True)
    save("icon-512.png", 512, 0.86, rounded=True)
    save("icon-512-maskable.png", 512, 0.62, rounded=False)  # inside the 80% safe zone
    save("apple-touch-icon.png", 180, 0.86, rounded=False)   # iOS rounds corners itself
    save("favicon-32.png", 32, 0.9, rounded=True)
