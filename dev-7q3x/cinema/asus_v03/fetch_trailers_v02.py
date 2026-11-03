"""Cave Cinema - fetch trailers once (YouTube via yt-dlp), <=720p VP9/Opus WebM, into cinema/trailers/<id>.webm.
v02: looks at the top 12 results and prefers official studio / classic-trailer channels; skips fan edits, reactions, concepts.
Skips movies that already have a trailer, so re-running only fetches new movies.
  python fetch_trailers_v02.py --only <movie-id>
  python fetch_trailers_v02.py --all [--limit N] [--height 480]
Writes cinema/trailers_log_v02.txt and a running summary in cinema/trailers_status_v02.json.
Needs: pip install --user yt-dlp imageio-ffmpeg"""
import os, sys, json, glob, re, time
ROOT = os.path.dirname(os.path.abspath(__file__)); TRL = os.path.join(ROOT, "cinema", "trailers"); os.makedirs(TRL, exist_ok=True)
OFFICIAL = ["universal pictures", "warner bros", "sony pictures", "paramount", "20th century", "disney", "pixar", "marvel",
            "lionsgate", "dreamworks", "mgm", "a24", "focus features", "searchlight", "netflix", "amazon mgm", "columbia pictures",
            "new line", "miramax", "summit", "legendary", "illumination", "studio ghibli", "gkids", "neon", "orion", "blumhouse",
            "rotten tomatoes classic trailers", "movieclips classic trailers", "movieclips trailers", "rotten tomatoes trailers",
            "kinocheck", "imdb", "hbo", "toho", "crunchyroll", "funimation", "shout! factory", "criterion", "arrow video", "kino lorber"]
BAD = re.compile(r"fan[\s-]?made|fan edit|concept|reaction|review|explained|ending|honest|parody|recut|re-?cut|\bai\b|fanmade|breakdown|ftd-|easter egg|lyric", re.I)
def manifest():
    fs = sorted(glob.glob(os.path.join(ROOT, "cinema", "manifest_v*.json"))); return json.load(open(fs[-1], encoding="utf-8"))["movies"]
def have(i): return any(os.path.exists(os.path.join(TRL, i + e)) for e in (".webm", ".mp4"))
def words(s): return set(re.findall(r"[a-z0-9]+", (s or "").lower()))
def score(e, m):
    t = e.get("title") or ""; ch = (e.get("channel") or e.get("uploader") or "").lower(); d = e.get("duration") or 0
    if not re.search("trailer|teaser", t, re.I) or BAD.search(t) or (d and (d > 330 or d < 40)): return None
    s = 0
    if any(o in ch for o in OFFICIAL): s += 100
    if re.search(r"official", t, re.I): s += 20
    if e.get("channel_is_verified"): s += 15
    tw = words(m["t"]); s += 30 * len(tw & words(t)) / max(1, len(tw))
    if str(m.get("y", "")) in t: s += 10
    return s
def main():
    a = sys.argv[1:]; H = int(a[a.index("--height") + 1]) if "--height" in a else 720
    only = a[a.index("--only") + 1] if "--only" in a else None; lim = int(a[a.index("--limit") + 1]) if "--limit" in a else 10**9
    if not only and "--all" not in a: print(__doc__); return
    import yt_dlp, imageio_ffmpeg
    todo = [m for m in manifest() if (m["id"] == only if only else not have(m["id"]))][:lim]
    logf = open(os.path.join(ROOT, "cinema", "trailers_log_v02.txt"), "a", encoding="utf-8")
    st = {"started": time.strftime("%Y-%m-%d %H:%M:%S"), "todo": len(todo), "ok": 0, "official": 0, "failed": 0, "mb": 0.0, "failures": [], "running": True}
    def save(): json.dump(st, open(os.path.join(ROOT, "cinema", "trailers_status_v02.json"), "w"), indent=1)
    save(); ff = imageio_ffmpeg.get_ffmpeg_exe()
    for m in todo:
        q = "ytsearch12:%s %s official trailer" % (m["t"], m.get("y", ""))
        opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "ffmpeg_location": ff,
                "format": "bv*[height<=%d][vcodec^=vp]+ba[acodec=opus]/bv*[height<=%d]+ba/b[height<=%d]" % (H, H, H),
                "merge_output_format": "webm", "outtmpl": os.path.join(TRL, m["id"] + ".%(ext)s")}
        try:
            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": "in_playlist"}) as y:
                es = [e for e in (y.extract_info(q, download=False) or {}).get("entries", []) if e]
            ranked = sorted([(score(e, m), i, e) for i, e in enumerate(es) if score(e, m) is not None], key=lambda x: (-x[0], x[1]))
            if not ranked: raise RuntimeError("no trailer-like result")
            sc, _, v = ranked[0]; url = v.get("url") or ("https://www.youtube.com/watch?v=" + v["id"])
            if not url.startswith("http"): url = "https://www.youtube.com/watch?v=" + v["id"]
            with yt_dlp.YoutubeDL(opts) as y: y.download([url])
            fs = [f for f in os.listdir(TRL) if f.startswith(m["id"] + ".") and not f.endswith(".part")]
            if not fs: raise RuntimeError("download produced no file")
            sz = sum(os.path.getsize(os.path.join(TRL, f)) for f in fs) / 1e6
            off = sc >= 100; st["ok"] += 1; st["official"] += off; st["mb"] = round(st["mb"] + sz, 1)
            line = "OK  %s | %s | %s | %s | %.1f MB%s" % (m["id"], v.get("title"), v.get("channel") or v.get("uploader"), url, sz, "" if off else " | NON-OFFICIAL")
        except Exception as e:
            st["failed"] += 1; st["failures"].append(m["id"]); line = "ERR %s | %s" % (m["id"], str(e)[:200])
        print(line, flush=True); logf.write(line + "\n"); logf.flush(); save()
    st["running"] = False; st["finished"] = time.strftime("%Y-%m-%d %H:%M:%S"); save()
if __name__ == "__main__": main()
