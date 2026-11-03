"""Cave Cinema: build cinema/categories_vNN.json (genre tabs) from Wikidata P136 genres.
Reads the newest cinema/manifest_vNN.json next to this script's server root. Writes a NEW versioned file; never overwrites.
Usage: python categories_v01.py [server_root]   (default: folder of this script)"""
import json, os, re, sys, time, glob, requests
UA = {"User-Agent": "CaveCinema/1 (https://amazingjustinlewis-web.github.io/dev-7q3x/cinema/)"}
ORDER = ["Action", "Comedy", "Sci-Fi", "Horror", "Drama", "Animation", "Kids", "TV"]
RULES = [("Animation", r"animat|anime|stop-motion"), ("Kids", r"children|family film"), ("Sci-Fi", r"science fiction|cyberpunk|dystopi|space opera|post-apocalyptic"),
         ("Horror", r"horror|slasher|monster|zombie|splatter"), ("Comedy", r"^(?!black comedy)(.*comedy|parody|satir)"), ("Action", r"action|martial arts|war film|superhero|spy"),
         ("Drama", r"drama|crime|thriller|biographical|romance|musical|documentary|mystery|neo-noir|gangster|western")]
def get(url, **p):
    for k in range(5):
        try:
            r = requests.get(url, params=p, headers=UA, timeout=25)
            if r.status_code == 200 and r.text.strip(): return r.json()
        except Exception: pass
        time.sleep(2 * (k + 1))
    return {}
def genres(src):
    t = src.rsplit("/wiki/", 1)[-1]
    d = get("https://en.wikipedia.org/w/api.php", action="query", prop="pageprops", titles=requests.utils.unquote(t), redirects=1, format="json")
    q = [p.get("pageprops", {}).get("wikibase_item") for p in d.get("query", {}).get("pages", {}).values()]
    q = q[0] if q else None
    if not q: return []
    e = get("https://www.wikidata.org/w/api.php", action="wbgetentities", ids=q, props="claims", format="json").get("entities", {}).get(q, {})
    ids = [c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in e.get("claims", {}).get("P136", []) + e.get("claims", {}).get("P31", [])]
    ids = [i for i in ids if i]
    if not ids: return []
    l = get("https://www.wikidata.org/w/api.php", action="wbgetentities", ids="|".join(ids[:50]), props="labels", languages="en", format="json").get("entities", {})
    return [v.get("labels", {}).get("en", {}).get("value", "") for v in l.values()]
def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    d = os.path.join(root, "cinema")
    man = sorted(glob.glob(os.path.join(d, "manifest_v*.json")))[-1]
    movies = json.load(open(man, encoding="utf-8"))["movies"]
    out = {}
    for m in movies:
        g = genres(m["src"]) if m.get("src") else []
        c = [k for k, rx in RULES if any(re.search(rx, x, re.I) for x in g)]
        if len(c) > 1 and "Drama" in c: c.remove("Drama")   # Drama = everything with no other genre tab
        if re.search(r"southpark|s\d\de\d\d", m["p"], re.I): c = ["TV", "Animation", "Comedy"]
        out[m["id"]] = {"t": m["t"], "cats": [k for k in ORDER if k in c] or ["Drama"], "genres": g}
        print(m["t"], "->", out[m["id"]]["cats"], flush=True); time.sleep(0.3)
    n = 1
    while os.path.exists(os.path.join(d, "categories_v%02d.json" % n)): n += 1
    f = os.path.join(d, "categories_v%02d.json" % n)
    json.dump({"v": n, "order": ORDER, "made": time.strftime("%Y-%m-%d %H:%M"), "source": "Wikidata P136", "movies": out}, open(f, "w", encoding="utf-8"), indent=1)
    print("wrote", f)
if __name__ == "__main__": main()
