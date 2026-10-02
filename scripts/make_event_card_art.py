#!/usr/bin/env python3
"""Draw illustrated event cards in the style of the hand-made ones.

Some events (a funding round opening, a virtual symposium) have no photograph
to use, so the site uses flat illustrations instead: a lavender-grey ground,
navy outlines, cream fills, one gold accent, and the faint concentric rings and
node-link pairs that run through the rest of the artwork. This script draws the
same thing for events that need it, so a new card does not have to be matched
by eye.

Colours are sampled from assets/images/events/funding-round-2-announcement.jpg
and wg2-virtual-apr2026.jpg, which set the house style.

Run: python3 scripts/make_event_card_art.py
"""

from __future__ import annotations

import math
import pathlib
import random

from PIL import Image, ImageDraw

W, H = 1600, 900
S = 3  # supersampling factor; the canvas is drawn at S× and scaled down

BG = (210, 218, 229)        # #d2dae5
SPECK = (198, 207, 221)     # #c6cfdd
RING = (201, 209, 222)      # #c9d1de
INK = (27, 28, 58)          # #1b1c3a
CREAM = (250, 246, 234)     # #faf6ea
CREAM_MID = (244, 236, 215) # #f4ecd7
CREAM_DEEP = (234, 224, 197)# #eae0c5
SLATE = (178, 189, 207)     # #b2bdcf
GOLD = (236, 183, 53)       # #ecb735
LAVENDER = (131, 131, 181)  # #8383b5
WHITE = (255, 255, 255)

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "images" / "events"


def s(v: float) -> int:
    return int(round(v * S))


def box(x0, y0, x1, y1):
    return [s(x0), s(y0), s(x1), s(y1)]


def ground(draw: ImageDraw.ImageDraw) -> None:
    """Ground, speckle and the two faint ring motifs the other cards carry."""
    draw.rectangle([0, 0, W * S, H * S], fill=BG)

    rng = random.Random(101)  # fixed, so re-running the script is a no-op
    for _ in range(900):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.uniform(0.6, 1.4)
        draw.ellipse(box(x - r, y - r, x + r, y + r), fill=SPECK)

    for cx, cy, rings, step in ((1390, 160, 7, 13), (260, 790, 5, 12)):
        for i in range(1, rings + 1):
            rad = i * step
            draw.ellipse(box(cx - rad, cy - rad, cx + rad, cy + rad),
                         outline=RING, width=s(1.6))
        draw.ellipse(box(cx - 4, cy - 4, cx + 4, cy + 4), fill=RING)


def node(draw: ImageDraw.ImageDraw, x, y, r=9.5) -> None:
    draw.ellipse(box(x - r, y - r, x + r, y + r), fill=WHITE, outline=INK, width=s(2.4))


def links(draw: ImageDraw.ImageDraw) -> None:
    """The little node-and-line pairs that sit either side of the subject."""
    for chain in (((470, 395), (418, 470)),
                  ((1152, 330), (1208, 404), (1142, 478))):
        for a, b in zip(chain, chain[1:]):
            draw.line([s(a[0]), s(a[1]), s(b[0]), s(b[1])], fill=LAVENDER, width=s(4))
        for p in chain:
            node(draw, *p)


def trace(draw: ImageDraw.ImageDraw, x0, x1, y, amp, colour, width, seed=7):
    """A short EEG-like trace — three sines, so it reads as signal, not a wave."""
    pts = []
    x = x0
    while x <= x1:
        t = (x - x0) / 26.0
        off = (math.sin(t) * 1.0 + math.sin(t * 2.3 + 1.1) * 0.55
               + math.sin(t * 4.7 + seed) * 0.3)
        pts += [s(x), s(y + amp * off / 1.85)]
        x += 2
    draw.line(pts, fill=colour, width=s(width), joint="curve")


def head(draw: ImageDraw.ImageDraw, cx, cy, r=31):
    """An electrode-cap head, the same glyph the other cards use for a person."""
    draw.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=CREAM, outline=INK, width=s(3.6))
    for i in range(5):
        ang = math.radians(198 + i * 36)
        ex, ey = cx + (r - 6) * math.cos(ang), cy + (r - 6) * math.sin(ang)
        draw.ellipse(box(ex - 5.8, ey - 5.8, ex + 5.8, ey + 5.8),
                     fill=GOLD if i == 2 else CREAM_DEEP, outline=INK, width=s(2.2))


def sheet(draw: ImageDraw.ImageDraw, x0, y0, x1, y1, fill, radius=16, width=5.5):
    draw.rounded_rectangle(box(x0, y0, x1, y1), radius=s(radius),
                           fill=fill, outline=INK, width=s(width))


def artem_is(path: pathlib.Path) -> None:
    """A reporting template: EEG above, a filled-in checklist below.

    ARTEM-IS is a template for documenting EEG and ERP methods, so the card
    shows the document itself — the recording in its header, the method details
    ticked off in its body.
    """
    canvas = Image.new("RGB", (W * S, H * S), BG)
    draw = ImageDraw.Draw(canvas)
    ground(draw)
    links(draw)

    # The sheet behind, offset and tilted, so the front one reads as one of a
    # template set. It is drawn on its own layer because PIL cannot rotate a
    # shape in place.
    back = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    ImageDraw.Draw(back).rounded_rectangle(
        box(622, 188, 1022, 748), radius=s(16),
        fill=CREAM_DEEP + (255,), outline=INK + (255,), width=s(5.5))
    back = back.rotate(-2.6, resample=Image.BICUBIC, center=(s(822), s(468)))
    canvas.paste(back, (0, 0), back)
    draw = ImageDraw.Draw(canvas)

    # The sheet itself.
    sheet(draw, 600, 170, 1000, 730, CREAM)

    # Header band: the recording the report is about.
    draw.rounded_rectangle(box(600, 170, 1000, 302), radius=s(16), fill=CREAM_MID)
    draw.rectangle(box(600, 270, 1000, 302), fill=CREAM_MID)
    draw.rounded_rectangle(box(600, 170, 1000, 730), radius=s(16), outline=INK, width=s(5.5))
    draw.line([s(600), s(302), s(1000), s(302)], fill=INK, width=s(5.5))
    head(draw, 672, 236)
    trace(draw, 722, 960, 236, 26, INK, 3.4)

    # Body: the method details, three of them ticked.
    bar_widths = (248, 206, 258, 190, 228)
    for i, bw in enumerate(bar_widths):
        cy = 362 + i * 74
        ticked = i < 3
        draw.rounded_rectangle(box(642, cy - 17, 676, cy + 17), radius=s(6),
                               fill=CREAM, outline=GOLD if ticked else INK, width=s(4.5))
        if ticked:
            draw.line([s(649), s(cy + 1), s(657), s(cy + 10), s(670), s(cy - 9)],
                      fill=INK, width=s(5), joint="curve")
        draw.rounded_rectangle(box(700, cy - 8, 700 + bw, cy + 8), radius=s(8), fill=SLATE)

    canvas.resize((W, H), Image.LANCZOS).save(path, optimize=True)
    print(f"wrote {path.relative_to(path.parents[3])} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    artem_is(OUT / "artem-is-demo-2026-11.png")
