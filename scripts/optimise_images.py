#!/usr/bin/env python3
"""Make pictures uploaded through the website editor fit for the web.

Pages CMS commits uploads exactly as given, and a phone photo is typically 3-10 MB,
sideways, and carries the GPS position where it was taken. For each picture passed
on the command line this:

  * turns it the right way up (phones record rotation as a tag, which browsers
    that ignore it display sideways);
  * shrinks it so its longest side is at most MAX_SIDE pixels;
  * removes embedded metadata, including location;
  * keeps the format, so every page that already refers to the file still works.

It only rewrites a file when that is needed (too large, rotated, or carrying
metadata), and only keeps the result when it is no bigger than the original, so
running it twice changes nothing. The content-check workflow passes it only the
pictures changed in that save, never the existing ones.

Usage: python3 scripts/optimise_images.py FILE [FILE...]
Prints one line per file it changed; exit status 0 either way.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageOps

MAX_SIDE = 1920
MAX_BYTES = 600_000          # above this, re-encode even if the dimensions are fine
JPEG_QUALITY = 82
SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def needs_work(img: Image.Image, size: int) -> list[str]:
    reasons = []
    if max(img.size) > MAX_SIDE:
        reasons.append(f"{img.size[0]}x{img.size[1]}")
    if size > MAX_BYTES:
        reasons.append(f"{size // 1024} KB")
    exif = img.getexif()
    if exif and exif.get(0x0112, 1) != 1:
        reasons.append("rotated")
    if exif and (0x8825 in exif or len(exif) > 0):
        reasons.append("metadata" + (" incl. location" if 0x8825 in exif else ""))
    return reasons


def optimise(path: Path) -> str | None:
    if path.suffix.lower() not in SUFFIXES or not path.is_file():
        return None
    original = path.read_bytes()
    with Image.open(io.BytesIO(original)) as img:
        reasons = needs_work(img, len(original))
        if not reasons:
            return None
        fmt = img.format
        out = ImageOps.exif_transpose(img)            # right way up, rotation tag dropped
        if max(out.size) > MAX_SIDE:
            out.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        buffer = io.BytesIO()
        if fmt == "JPEG":
            out.convert("RGB").save(buffer, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        elif fmt == "PNG":
            out.save(buffer, "PNG", optimize=True)
        elif fmt == "WEBP":
            out.save(buffer, "WEBP", quality=JPEG_QUALITY, method=6)
        else:
            return None
    data = buffer.getvalue()
    # Never make a file bigger, unless the point was to fix rotation or strip location.
    must = any(r == "rotated" or "location" in r for r in reasons)
    if len(data) >= len(original) and not must:
        return None
    path.write_bytes(data)
    return f"{path}: {', '.join(reasons)} -> {len(original) // 1024} KB to {len(data) // 1024} KB"


def main(argv: list[str]) -> int:
    for name in argv:
        message = optimise(Path(name))
        if message:
            print(message)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
