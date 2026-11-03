"""Cave Cinema - fetch official trailers once (YouTube via yt-dlp), <=720p, efficient VP9/Opus WebM, into cinema/trailers/<id>.webm.
Skips movies that already have a trailer, so re-running only fetches new movies.
  python fetch_trailers_v01.py --only jurassic-park-1993-077f27     one movie (test)
  python fetch_trailers_v01.py --all [--limit N] [--height 480]     everything still missing
Needs: pip install --user yt-dlp imageio-ffmpeg"""
import os, sys, json, glob, re
ROOT = os.path.dirname(os.path.abspath(__file__)); TRL = os.path.join(ROOT, "cinema", "trailers"); os.makedirs(TRL, exist_ok=True)
def manifest():
    fs = sorted(glob.glob(os.path.join(ROOT, "cinema", "manifest_v*.json"))); return json.load(open(fs[-1], encoding="utf-8"))["movies"]
def have(i): return any(os.path.exists(os.path.join(TRL, i + e)) for e in (".webm", ".mp4"))
def main():
    a = sys.argv[1:]; H = int(a[a.index("--height") + 1]) if "--height" in a else 720
    only = a[a.index("--only") + 1] if "--only" in a else None; lim = int(a[a.index("--limit") + 1]) if "--limit" in a else 10**9
    if not only and "--all" not in a: print(__doc__); return
    import yt_dlp, imageio_ffmpeg
    todo = [m for m in manifest() if (m["id"] == only if only else not have(m["id"]))][:lim]
    logf = open(os.path.join(ROOT, "cinema", "trailers_log_v01.txt"), "a", encoding="utf-8")
    for m in todo:
        q = "ytsearch5:%s %s official trailer" % (m["t"], m.get("y", ""))
        opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
                "format": "bv*[height<=%d][vcodec^=vp]+ba[acodec=opus]/bv*[height<=%d]+ba/b[height<=%d]" % (H, H, H),
                "merge_output_format": "webm", "outtmpl": os.path.join(TRL, m["id"] + ".%(ext)s"),
                "match_filter": lambda info, *_: None if (info.get("duration") or 0) <= 300 and re.search("trailer", info.get("title", ""), re.I) else "skip"}
        try:
            with yt_dlp.YoutubeDL(dict(opts, extract_flat=False, skip_download=True)) as y:
                hits = [e for e in (y.extract_info(q, download=False) or {}).get("entries", []) if e]
            if not hits: raise RuntimeError("no trailer-like result")
            v = hits[0]; url = v.get("webpage_url") or v.get("url")
            with yt_dlp.YoutubeDL(opts) as y: y.download([url])
            fs = [f for f in os.listdir(TRL) if f.startswith(m["id"] + ".")]
            sz = sum(os.path.getsize(os.path.join(TRL, f)) for f in fs)
            line = "OK  %s | %s | %s | %.1f MB" % (m["id"], v.get("title"), url, sz / 1e6)
        except Exception as e: line = "ERR %s | %s" % (m["id"], e)
        print(line); logf.write(line + "\n"); logf.flush()
if __name__ == "__main__": main()
