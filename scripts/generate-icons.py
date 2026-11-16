#!/usr/bin/env python3
"""Draws the application icon and writes resources/icon.png (1024x1024) and icon.ico.

Usage: npm run icons   (this script needs Pillow: pip install pillow)
The macOS icon (resources/icon-mac.png and icon.icns with every size) is made from icon.png by scripts/build-mac-icon.ts.
The icon is an original drawing: a handheld console on a rounded-square background, with an SD-card badge.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "resources"
SIZE = 1024
SS = 2  # supersampling for smooth edges
S = SIZE * SS


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        color = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = color
    return img


def rounded_mask(size, box, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    return mask


def draw_icon() -> Image.Image:
    # Background: macOS-style rounded square with a margin, dark blue gradient.
    margin = int(S * 0.055)
    box = (margin, margin, S - margin, S - margin)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    background = vertical_gradient(S, (33, 46, 92), (14, 20, 46)).convert("RGBA")
    canvas.paste(background, (0, 0), rounded_mask(S, box, int(S * 0.22)))

    # Soft shadow under the console.
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((S * 0.19, S * 0.25, S * 0.81, S * 0.79), radius=S * 0.09, fill=(0, 0, 0, 110))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(S * 0.02)))

    d = ImageDraw.Draw(canvas)
    # Console body.
    body = (S * 0.17, S * 0.21, S * 0.83, S * 0.74)
    d.rounded_rectangle(body, radius=S * 0.09, fill=(236, 240, 250, 255))
    d.rounded_rectangle((S * 0.17, S * 0.60, S * 0.83, S * 0.74), radius=S * 0.09, fill=(214, 221, 238, 255))
    d.rectangle((S * 0.17, S * 0.60, S * 0.83, S * 0.66), fill=(236, 240, 250, 255))

    # Screen: dark bezel, teal display with a simple highlight.
    d.rounded_rectangle((S * 0.26, S * 0.285, S * 0.74, S * 0.545), radius=S * 0.03, fill=(26, 32, 58, 255))
    screen = (S * 0.285, S * 0.31, S * 0.715, S * 0.52)
    d.rounded_rectangle(screen, radius=S * 0.02, fill=(46, 204, 170, 255))
    d.polygon([(S * 0.285, S * 0.31), (S * 0.50, S * 0.31), (S * 0.395, S * 0.52), (S * 0.285, S * 0.52)], fill=(94, 226, 196, 255))
    d.rounded_rectangle(screen, radius=S * 0.02, outline=(20, 150, 124, 255), width=int(S * 0.006))

    # D-pad.
    cx, cy, arm, thick = S * 0.295, S * 0.665, S * 0.05, S * 0.03
    d.rounded_rectangle((cx - arm, cy - thick / 2, cx + arm, cy + thick / 2), radius=S * 0.008, fill=(52, 62, 100, 255))
    d.rounded_rectangle((cx - thick / 2, cy - arm, cx + thick / 2, cy + arm), radius=S * 0.008, fill=(52, 62, 100, 255))

    # Buttons.
    for (bx, by, color) in ((S * 0.70, S * 0.645, (240, 98, 98, 255)), (S * 0.77, S * 0.685, (250, 190, 64, 255))):
        r = S * 0.026
        d.ellipse((bx - r, by - r, bx + r, by + r), fill=color)

    # SD-card badge (bottom right): amber card with a cut corner and contact strips.
    cw, ch = S * 0.25, S * 0.31
    x0, y0 = S * 0.60, S * 0.60
    cut = cw * 0.30
    card = [(x0, y0), (x0 + cw - cut, y0), (x0 + cw, y0 + cut), (x0 + cw, y0 + ch), (x0, y0 + ch)]
    ring = [(x0 - S * 0.015, y0 - S * 0.015), (x0 + cw - cut + S * 0.005, y0 - S * 0.015), (x0 + cw + S * 0.015, y0 + cut - S * 0.005),
            (x0 + cw + S * 0.015, y0 + ch + S * 0.015), (x0 - S * 0.015, y0 + ch + S * 0.015)]
    d.polygon(ring, fill=(18, 26, 56, 255))
    d.polygon(card, fill=(250, 190, 64, 255))
    for i in range(4):
        sx = x0 + cw * (0.14 + i * 0.17)
        d.rounded_rectangle((sx, y0 + ch * 0.07, sx + cw * 0.09, y0 + ch * 0.29), radius=S * 0.004, fill=(150, 98, 20, 255))
    d.rounded_rectangle((x0 + cw * 0.14, y0 + ch * 0.50, x0 + cw * 0.78, y0 + ch * 0.58), radius=S * 0.004, fill=(150, 98, 20, 140))
    d.rounded_rectangle((x0 + cw * 0.14, y0 + ch * 0.66, x0 + cw * 0.58, y0 + ch * 0.74), radius=S * 0.004, fill=(150, 98, 20, 140))

    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    icon = draw_icon()
    icon.save(OUT / "icon.png")  # 1024x1024: Linux and the source of everything else
    icon.save(OUT / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])  # Windows
    print("written:", ", ".join(sorted(p.name for p in OUT.iterdir())))


if __name__ == "__main__":
    main()
