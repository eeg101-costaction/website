#!/usr/bin/env python3
"""Tests for optimise_images.py on real generated image files."""

import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image

SCRIPT = Path(__file__).with_name("optimise_images.py")
SPEC = importlib.util.spec_from_file_location("optimise_images", SCRIPT)
OPT = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(OPT)


def photo(path, size=(4032, 3024), orientation=None, gps=False, fmt="JPEG"):
    img = Image.new("RGB", size)
    # Noise-free but non-trivial content, so JPEG sizes are realistic.
    for x in range(0, size[0], 97):
        img.paste((x % 255, (x * 3) % 255, (x * 7) % 255), (x, 0, min(x + 97, size[0]), size[1]))
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    if gps:
        exif[0x8825] = {1: "N", 2: (53.0, 48.0, 0.0)}
    kwargs = {"exif": exif} if (orientation or gps) else {}
    img.save(path, fmt, quality=98, **kwargs)
    return path


class OptimiseImages(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def test_a_phone_photo_is_shrunk_and_stays_a_jpeg(self):
        p = photo(self.dir / "big.jpg")
        before = p.stat().st_size
        self.assertIsNotNone(OPT.optimise(p))
        with Image.open(p) as img:
            self.assertEqual(img.format, "JPEG")
            self.assertLessEqual(max(img.size), OPT.MAX_SIDE)
            self.assertEqual(img.size, (1920, 1440), "aspect ratio kept")
        self.assertLess(p.stat().st_size, before)

    def test_a_sideways_photo_is_turned_upright(self):
        p = photo(self.dir / "sideways.jpg", size=(1200, 800), orientation=6)   # 6 = rotate 90 CW
        OPT.optimise(p)
        with Image.open(p) as img:
            self.assertEqual(img.size, (800, 1200), "now portrait, as the camera meant")
            self.assertEqual(img.getexif().get(0x0112, 1), 1)

    def test_location_is_removed_even_from_a_small_photo(self):
        p = photo(self.dir / "located.jpg", size=(800, 600), gps=True)
        self.assertIn(0x8825, Image.open(p).getexif())
        self.assertIsNotNone(OPT.optimise(p))
        self.assertNotIn(0x8825, Image.open(p).getexif())

    def test_running_twice_changes_nothing(self):
        p = photo(self.dir / "big.jpg", gps=True, orientation=3)
        OPT.optimise(p)
        once = p.read_bytes()
        self.assertIsNone(OPT.optimise(p))
        self.assertEqual(p.read_bytes(), once)

    def test_a_small_clean_picture_is_left_alone(self):
        p = photo(self.dir / "fine.jpg", size=(800, 450))
        before = p.read_bytes()
        self.assertIsNone(OPT.optimise(p))
        self.assertEqual(p.read_bytes(), before)

    def test_png_stays_png_with_transparency(self):
        p = self.dir / "diagram.png"
        img = Image.new("RGBA", (3000, 2000), (0, 0, 0, 0)); img.save(p)
        OPT.optimise(p)
        with Image.open(p) as out:
            self.assertEqual(out.format, "PNG"); self.assertEqual(out.mode, "RGBA")
            self.assertLessEqual(max(out.size), OPT.MAX_SIDE)

    def test_other_files_are_ignored(self):
        p = self.dir / "notes.txt"; p.write_text("hello")
        self.assertIsNone(OPT.optimise(p))
        self.assertIsNone(OPT.optimise(self.dir / "missing.jpg"))


    def test_phone_mpo_jpeg_is_cleaned_and_saved_as_plain_jpeg(self):
        """Many phones save JPEGs with a second picture inside (Pillow calls them MPO)."""
        p = self.dir / "phone.jpg"
        exif = Image.Exif(); exif[0x8825] = {1: "N", 2: (53.0, 48.0, 0.0)}
        Image.new("RGB", (800, 600), "red").save(p, "MPO", save_all=True,
                                                append_images=[Image.new("RGB", (800, 600))], exif=exif)
        self.assertIsNotNone(OPT.optimise(p))
        with Image.open(p) as img:
            self.assertEqual((img.format, len(img.getexif())), ("JPEG", 0))

    def test_location_in_xmp_is_removed_and_colour_profile_kept(self):
        from PIL import ImageCms
        icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        xmp = b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="53,48.5N"/></rdf:RDF></x:xmpmeta>'
        p = self.dir / "xmp.jpg"
        Image.new("RGB", (800, 600), "red").save(p, "JPEG", xmp=xmp, icc_profile=icc)
        self.assertIn("location", OPT.optimise(p))
        self.assertNotIn(b"GPS", p.read_bytes())
        with Image.open(p) as img:
            self.assertEqual(img.info.get("icc_profile"), icc)

    def test_an_unreadable_file_does_not_stop_the_others(self):
        bad = self.dir / "bad.jpg"; bad.write_bytes(b"not a picture")
        good = photo(self.dir / "good.jpg", gps=True, size=(400, 300))
        self.assertEqual(OPT.main([str(bad), str(good)]), 0)
        with Image.open(good) as img:
            self.assertEqual(len(img.getexif()), 0)

if __name__ == "__main__":
    unittest.main()
