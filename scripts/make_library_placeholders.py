#!/usr/bin/env python3
"""Draw the placeholder cover art the Library uses for items with no cover.

Most Framework catalogue entries are web pages, preprints and software with no
cover image of their own. Rather than leave those cards blank or stretch a
generic grey box over them, each resource type gets a small piece of art in the
site's own palette: cream ground, a faint EEG trace, and a glyph for the type.

Accent colours match the family stripe already used on the catalogue cards, so
a card's art and its border agree.

Run: python3 scripts/make_library_placeholders.py
"""

from __future__ import annotations

import pathlib

W, H = 480, 270
CREAM = "#faf8f5"
INK = "#1a1a2e"
BORDER = "#e0dbd4"

# slug -> (accent, label, glyph path drawn in a 48x48 box at 0,0)
GLYPHS: dict[str, tuple[str, str, str]] = {
    "article": ("#2f5fd0", "Journal article",
                "M10 6h22l6 6v30H10z M32 6v6h6 M16 20h16 M16 26h16 M16 32h10"),
    "preprint": ("#2f5fd0", "Preprint",
                 "M12 8h18l6 6v26H12z M30 8v6h6 M17 22h14 M17 28h14 "
                 "M34 30l6 6-8 2 2-8z"),
    "book": ("#2f5fd0", "Book",
             "M10 10a4 4 0 014-4h24v34H14a4 4 0 00-4 4z M14 40h24 M20 14h12"),
    "document": ("#2f5fd0", "Document",
                 "M12 6h18l8 8v28H12z M30 6v8h8 M18 24h14 M18 31h14"),
    "conference": ("#2f5fd0", "Conference paper",
                   "M8 12h32v20H8z M18 38h12 M24 32v6 M14 18h12 M14 24h8"),
    "webpage": ("#d4a800", "Web page",
                "M24 6a18 18 0 100 36 18 18 0 000-36z M6 24h36 "
                "M24 6c-6 6-6 30 0 36 M24 6c6 6 6 30 0 36"),
    "software": ("#d1711f", "Software",
                 "M18 16l-10 8 10 8 M30 16l10 8-10 8 M26 12l-4 24"),
    "video": ("#7c4dcc", "Video",
              "M8 12h26v24H8z M34 20l8-5v18l-8-5z M16 20l8 4-8 4z"),
    "audio": ("#7c4dcc", "Audio",
              "M20 10v28 M14 16v16 M26 14v20 M8 21v6 M32 18v12 M38 21v6"),
}


def trace(accent: str) -> str:
    """A faint EEG trace across the lower third, so the art reads as EEG101's."""
    pts = []
    import math

    for x in range(0, W + 1, 6):
        t = x / 34.0
        y = (
            176
            + 13 * math.sin(t)
            + 7 * math.sin(t * 2.7 + 1.1)
            + 4 * math.sin(t * 5.3 + 0.4)
        )
        pts.append(f"{x},{y:.1f}")
    return (
        f'<polyline points="{" ".join(pts)}" fill="none" stroke="{accent}" '
        f'stroke-width="2" stroke-linejoin="round" opacity="0.28"/>'
    )


def svg(slug: str, accent: str, label: str, glyph: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" \
width="{W}" height="{H}" role="img" aria-label="{label}">
  <title>{label}</title>
  <rect width="{W}" height="{H}" fill="{CREAM}"/>
  <rect width="{W}" height="{H}" fill="{accent}" opacity="0.05"/>
  <rect x="0" y="0" width="{W}" height="5" fill="{accent}"/>
  {trace(accent)}
  <g transform="translate({W/2 - 24:.0f}, 78) scale(1.35)" \
transform-origin="24 24">
    <g transform="translate(-8,-8)">
      <path d="{glyph}" fill="none" stroke="{accent}" stroke-width="2.6" \
stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    </g>
  </g>
  <text x="{W/2}" y="236" text-anchor="middle" font-family="Lato, \
system-ui, sans-serif" font-size="15" font-weight="700" letter-spacing="1.6" \
fill="{INK}" opacity="0.5">{label.upper()}</text>
  <rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" fill="none" \
stroke="{BORDER}"/>
</svg>
"""


def main() -> int:
    out = pathlib.Path(__file__).resolve().parent.parent / "assets" / "images" / "library"
    out.mkdir(parents=True, exist_ok=True)
    for slug, (accent, label, glyph) in GLYPHS.items():
        path = out / f"{slug}.svg"
        path.write_text(svg(slug, accent, label, glyph), encoding="utf-8")
        print(f"  {path.name:<16} {path.stat().st_size:>5} bytes  {label}")
    print(f"\nwrote {len(GLYPHS)} placeholders to assets/images/library/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
