"""Cave Cinema posters v02: adds the catalog's Collections tab (Batman, Die Hard, ...) to the poster manifest.
v01 only read cat.movies. This keeps every entry of the newest manifest as-is (posters, ratings) and fetches
only titles it does not have yet. Writes a NEW manifest_vNN.json. Lives next to fetch_posters_v01.py in the server root.
Usage: python fetch_posters_v02.py [--tabs movies,collections]"""
import os, sys, json, glob, time, argparse, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_posters_v01 import slug, find_page, mode_for, to_webp, next_manifest, cat_of, UA

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "cinema"))
    ap.add_argument("--height", type=int, default=480); ap.add_argument("--api", default="http://127.0.0.1:8090")
    ap.add_argument("--tabs", default="movies,collections"); a = ap.parse_args()
    orig, webp = os.path.join(a.root, "posters", "originals"), os.path.join(a.root, "posters", "webp")
    prev = sorted(glob.glob(os.path.join(a.root, "manifest_v*.json")))
    out = json.load(open(prev[-1], encoding="utf-8"))["movies"] if prev else []
    have = {e["id"] for e in out}; paths = {e["p"] for e in out}
    ov_path = os.path.join(a.root, "modes_v01.json"); ov = json.load(open(ov_path)) if os.path.exists(ov_path) else {}
    cat = requests.get(a.api + "/api/catalog", timeout=20).json()["cat"]
    for tab in a.tabs.split(","):
        for m in cat.get(tab, []):
            t, y = m.get("t"), m.get("y"); p = (m.get("v") or [{}])[0].get("p"); sid = slug(t, y)
            if sid in have or p in paths: continue
            e = {"id": sid, "t": t, "y": y, "p": p, "cat": m.get("g") or cat_of(p), "poster": "", "mode": "mature", "src": "", "tab": tab}
            try:
                existing = [f for f in os.listdir(orig) if f.startswith(sid + ".")]
                pg = find_page(t, y)
                if pg:
                    url = pg["original"]["source"]; e["src"] = "https://en.wikipedia.org/wiki/" + pg["title"].replace(" ", "_")
                    if not existing:
                        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
                        r = requests.get(url, headers=UA, timeout=60); r.raise_for_status()
                        if not r.headers.get("Content-Type", "").startswith("image/"): raise ValueError("not an image")
                        open(os.path.join(orig, sid + ext), "wb").write(r.content); existing = [sid + ext]
                    e["mode"] = mode_for(pg) or "mature"
                if existing:
                    to_webp(os.path.join(orig, existing[0]), os.path.join(webp, sid + ".webp"), a.height)
                    e["poster"] = f"posters/webp/{sid}.webp"
            except Exception as x:
                print("!", t, y, x, file=sys.stderr)
            e["mode"] = ov.get(f"{t} ({y})", e["mode"])
            print(f"{'OK ' if e['poster'] else '-- '} {e['mode']:7} {t} ({y})", flush=True)
            out.append(e); have.add(sid); paths.add(p); time.sleep(1.0)
    dst = next_manifest(a.root)
    json.dump({"v": int(dst[-7:-5]), "made": time.strftime("%Y-%m-%d %H:%M"), "height": a.height, "movies": out}, open(dst, "w"), indent=1)
    print("wrote", dst, f"({sum(1 for e in out if e['poster'])}/{len(out)} posters)")

if __name__ == "__main__": main()
