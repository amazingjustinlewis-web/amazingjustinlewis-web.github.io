"""Cave Cinema poster fetch v01 (runs on the Asus, next to the Cave Cinema server root).
Reads the catalog from http://127.0.0.1:8090/api/catalog, finds each film's English Wikipedia page
(the infobox image there is normally the original theatrical one-sheet), saves the full-size original to
cinema/posters/originals/, writes a 480px-tall WebP to cinema/posters/webp/, and writes cinema/manifest_v01.json
(or the next free manifest_vNN.json - never overwrites). Content mode per film comes from Wikidata's MPAA
rating (G=kid, PG/PG-13=family, R/NC-17=mature, unknown=mature) unless cinema/modes_v01.json overrides it
({"Title (Year)": "kid|family|mature"}). Usage:  python fetch_posters_v01.py [--root DIR] [--height 480]
Needs: pip install pillow requests"""
import argparse, json, os, re, sys, time, hashlib
import requests
from PIL import Image

UA = {"User-Agent": "CaveCinema/0.1 (https://amazingjustinlewis-web.github.io; home projector poster cache)"}
WP = "https://en.wikipedia.org/w/api.php"
RATING = {"G": "kid", "PG": "family", "PG-13": "family", "R": "mature", "NC-17": "mature"}

def slug(t, y):
    s = re.sub(r"[^a-z0-9]+", "-", f"{t} {y or ''}".lower()).strip("-")
    return s[:60] + "-" + hashlib.md5(f"{t}|{y}".encode()).hexdigest()[:6]

def wp(**p):
    p.update(format="json", formatversion=2)
    for k in range(6):   # Wikipedia rate-limits bursts: back off and retry
        try:
            r = requests.get(WP, params=p, headers=UA, timeout=20)
            if r.status_code == 200 and r.text.strip(): return r.json()
        except (requests.RequestException, ValueError): pass
        time.sleep(2 * (k + 1))
    raise RuntimeError("wikipedia not answering")

def infobox_img(title):
    try:
        h = wp(action="parse", page=title, prop="text", section=0, redirects=1)["parse"]["text"]
    except Exception: return None
    m = re.search(r'class="infobox[^"]*".*?href="/wiki/(File:[^"]+)"', h, re.S)
    if not m: return None
    from urllib.parse import unquote
    q = wp(action="query", titles=unquote(m.group(1)), prop="imageinfo", iiprop="url|mime")["query"]["pages"][0]
    ii = (q.get("imageinfo") or [{}])[0]
    return ii.get("url") if ii.get("mime", "").startswith(("image/jpeg", "image/png", "image/webp")) else None

def find_page(t, y):
    tries = [f"{t} ({y} film)", f"{t} (film)", t] if y else [f"{t} (film)", t]
    s = wp(action="query", list="search", srsearch=f"{t} {y or ''} film", srlimit=3)
    tries += [h["title"] for h in s["query"]["search"]]
    for title in tries:
        q = wp(action="query", titles=title, redirects=1, prop="pageprops|categories", cllimit=100)
        pg = q["query"]["pages"][0]
        if pg.get("missing") or "disambiguation" in pg.get("pageprops", {}): continue
        cats = " ".join(c["title"] for c in pg.get("categories", [])).lower()
        if " films" not in cats or (y and str(y) not in cats): continue
        u = infobox_img(pg["title"])
        if u: pg["original"] = {"source": u}; return pg
    return None

def mode_for(pg):
    qid = pg.get("pageprops", {}).get("wikibase_item")
    if not qid: return None
    try:
        e = requests.get(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json", headers=UA, timeout=20).json()["entities"][qid]
        best = None
        for cl in e["claims"].get("P1657", []):
            rid = cl["mainsnak"]["datavalue"]["value"]["id"]
            lab = requests.get(f"https://www.wikidata.org/wiki/Special:EntityData/{rid}.json", headers=UA, timeout=20).json()["entities"][rid]["labels"]["en"]["value"]
            m = RATING.get(lab.replace("rated ", "").strip())
            if m and (best is None or ["kid", "family", "mature"].index(m) > ["kid", "family", "mature"].index(best)): best = m
        return best
    except Exception:
        return None

def to_webp(src, dst, h):
    im = Image.open(src).convert("RGB")
    w = round(im.width * h / im.height)
    im.resize((w, h), Image.LANCZOS).save(dst, "WEBP", quality=82, method=6)

def next_manifest(root):
    n = 1
    while os.path.exists(os.path.join(root, f"manifest_v{n:02d}.json")): n += 1
    return os.path.join(root, f"manifest_v{n:02d}.json")

def cat_of(p):
    a = re.split(r"[\\/]", p or "")
    return a[-2] if len(a) > 2 else (a[0] if len(a) > 1 else "Other")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "cinema"))
    ap.add_argument("--height", type=int, default=480); ap.add_argument("--api", default="http://127.0.0.1:8090"); a = ap.parse_args()
    orig, webp = os.path.join(a.root, "posters", "originals"), os.path.join(a.root, "posters", "webp")
    os.makedirs(orig, exist_ok=True); os.makedirs(webp, exist_ok=True)
    ov_path = os.path.join(a.root, "modes_v01.json"); ov = json.load(open(ov_path)) if os.path.exists(ov_path) else {}
    movies = requests.get(a.api + "/api/catalog", timeout=20).json()["cat"]["movies"]
    out = []
    for m in movies:
        t, y = m.get("t"), m.get("y"); p = (m.get("v") or [{}])[0].get("p"); sid = slug(t, y)
        e = {"id": sid, "t": t, "y": y, "p": p, "cat": cat_of(p), "poster": "", "mode": "mature", "src": ""}
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
        print(f"{'OK ' if e['poster'] else '-- '} {e['mode']:7} {t} ({y})"); out.append(e); time.sleep(1.0)
    dst = next_manifest(a.root)
    json.dump({"v": 1, "made": time.strftime("%Y-%m-%d %H:%M"), "height": a.height, "movies": out}, open(dst, "w"), indent=1)
    print("wrote", dst, f"({sum(1 for e in out if e['poster'])}/{len(out)} posters)")

if __name__ == "__main__": main()
