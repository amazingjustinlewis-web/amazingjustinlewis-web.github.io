"""One command to rebuild the poster WebPs from the high-res originals at a new size, e.g. for a 1080p or 4K projector:
     python regen_posters_v01.py 720      (1080p)      python regen_posters_v01.py 1440   (4K)
Writes cinema/posters/webp_<H>/ (keeps the 480 set) and prints the folder to point the manifest at."""
import os, sys
from PIL import Image
h = int(sys.argv[1]) if len(sys.argv) > 1 else 720
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cinema", "posters")
src, dst = os.path.join(root, "originals"), os.path.join(root, f"webp_{h}")
os.makedirs(dst, exist_ok=True); n = 0
for f in os.listdir(src):
    if f.lower().endswith(".svg"): continue
    im = Image.open(os.path.join(src, f)).convert("RGB")
    im.resize((round(im.width * h / im.height), h), Image.LANCZOS).save(os.path.join(dst, os.path.splitext(f)[0] + ".webp"), "WEBP", quality=82, method=6); n += 1
print(f"{n} posters -> {dst}  (re-run fetch_posters_v01.py --height {h} to write a new manifest that points at webp/, or edit paths)")
