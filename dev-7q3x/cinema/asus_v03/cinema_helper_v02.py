"""Cave Cinema helper v02 - local server on the Asus (default port 8094, localhost only). Superset of helper v01, plus:
- /cinema/trailers/<id>.webm|.mp4   local trailers (Range requests supported so video can seek)
- GET  /trailers                     -> {"ids": [...], "files": {id: filename}} movie ids that have a local trailer
- GET  /stubs[?year=YYYY]            -> {"stubs":[...], "rewind":{count, top:[[title,n],...]}}  (private file, never served raw)
- POST /stubs  {id,t,y,g}            log a ticket stub (date added here)
- POST /lights/{start,pause,resume,stop}  cinematic Hue fades via Home Assistant;  GET /lights/status
Private data lives in ../private (C:\\CaveCinema\\private): stubs_v01.json, ha_token.txt (HA long-lived token, never logged),
lights_v01.json (optional config: {"ha":"http://10.0.0.205","lights":[...]}).
Run:  pythonw cinema_helper_v02.py [port] [--dry]     (--dry = log light commands instead of sending them)"""
import http.server, os, sys, json, re, time, math, random, threading, urllib.request, datetime
ROOT = os.path.dirname(os.path.abspath(__file__)); UP = "http://127.0.0.1:8090"
PRIV = os.path.join(ROOT, "private"); os.makedirs(PRIV, exist_ok=True)
TRL = os.path.join(ROOT, "cinema", "trailers"); os.makedirs(TRL, exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith("--")]; PORT = int(args[0]) if args else 8094; DRY = "--dry" in sys.argv
STUBS = os.path.join(PRIV, "stubs_v01.json"); LOG = os.path.join(PRIV, "lights_log_v01.txt"); LOCK = threading.Lock()
def cfg():
    c = {"ha": "http://10.0.0.205", "lights": ["light.bedroom_bedroom_1", "light.bedroom_light_dish", "light.bedroom_closet"]}
    try: c.update(json.load(open(os.path.join(PRIV, "lights_v01.json"))))
    except Exception: pass
    return c
def token():
    t = os.environ.get("HA_TOKEN")
    if t: return t.strip()
    try: return open(os.path.join(PRIV, "ha_token.txt")).read().strip()
    except Exception: return ""
def log(s):
    with open(LOG, "a", encoding="utf-8") as f: f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + s + "\n")
def ha(method, path, body=None):
    if DRY and method == "POST": log("DRY " + path + " " + json.dumps(body)); return None
    t = token()
    if not t: raise RuntimeError("no HA token")
    req = urllib.request.Request(cfg()["ha"] + path, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + t, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=6) as r: return json.loads(r.read() or b"null")
def svc(ent, **kw):
    try: ha("POST", "/api/services/light/turn_" + ("off" if kw.get("off") else "on"), dict({"entity_id": ent}, **{k: v for k, v in kw.items() if k != "off"}))
    except Exception as e: log("ERR %s %s" % (ent, e))

class Lights:
    """start: each ON light drops to 80% of its own brightness in ~1.5 s, then a 3-minute cinematic fade to 0
    (slow ease-out curve, +-4% shimmer and a gentle colour drift toward a deep warm amber). pause: soft warm night-light.
    resume: fade back down to dark. stop: cancel (lights are left where they are)."""
    def __init__(s): s.gen = 0; s.state = "idle"; s.start_bri = {}; s.paused_at = None
    def _run(s, fn):
        s.gen += 1; g = s.gen; threading.Thread(target=fn, args=(g,), daemon=True).start()
    def _alive(s, g): return g == s.gen
    def start(s):
        s.state = "fading"; s._run(s._fade)
    def _fade(s, g):
        ents = cfg()["lights"]; base = {}
        for e in ents:
            try:
                st = ha("GET", "/api/states/" + e) if not DRY else {"state": "on", "attributes": {"brightness": 255}}
                if st and st.get("state") == "on": base[e] = int(st["attributes"].get("brightness") or 255)
            except Exception as x: log("ERR read %s %s" % (e, x))
        s.start_bri = base
        if not base: s.state = "dark"; log("start: no lights on"); return
        for e, b in base.items(): svc(e, brightness=max(1, round(b * .8)), transition=1.5)
        time.sleep(1.6); T, STEP, t0 = 180.0, 6.0, time.time(); ph = {e: random.random() * 6.28 for e in base}
        while s._alive(g):
            k = min(1.0, (time.time() - t0) / T)
            if k >= 1: break
            f = (1 - k) ** 1.8                                   # ease-out: most of the drop early, long soft tail
            for e, b in base.items():
                sh = 1 - .04 * (.5 + .5 * math.sin(ph[e] + k * 40))   # slow shimmer (only dips), never jarring
                kel = int(3200 - 1000 * k + 120 * math.sin(ph[e] + k * 9))   # colour drift: neutral warm -> deep amber
                svc(e, brightness=max(1, round(b * .8 * f * sh)), color_temp_kelvin=max(2000, kel), transition=STEP)
            for _ in range(int(STEP * 10)):
                if not s._alive(g): return
                time.sleep(.1)
        if s._alive(g):
            for e in base: svc(e, off=True, transition=4)
            s.state = "dark"
    def pause(s):
        s.state = "intermission"; ents = list(s.start_bri) or cfg()["lights"][:1]
        def go(g):
            for e in ents: svc(e, brightness=46, color_temp_kelvin=2200, transition=3)
        s._run(go)
    def resume(s):
        s.state = "fading"; ents = list(s.start_bri) or cfg()["lights"][:1]
        def go(g):
            for e in ents: svc(e, brightness=8, color_temp_kelvin=2000, transition=6)
            time.sleep(6.5)
            if s._alive(g):
                for e in ents: svc(e, off=True, transition=3)
                s.state = "dark"
        s._run(go)
    def stop(s): s.gen += 1; s.state = "idle"
L = Lights()

def read_stubs():
    try: return json.load(open(STUBS, encoding="utf-8"))
    except Exception: return []
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s):
        s.send_header("Access-Control-Allow-Origin", "*"); s.send_header("Access-Control-Allow-Headers", "Content-Type")
        s.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); s.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()
    def do_OPTIONS(s): s.send_response(204); s.end_headers()
    def js(s, o, c=200):
        d = json.dumps(o).encode(); s.send_response(c); s.send_header("Content-Type", "application/json"); s.send_header("Content-Length", str(len(d))); s.end_headers(); s.wfile.write(d)
    def proxy(s, body=None):
        req = urllib.request.Request(UP + s.path, data=body, method=s.command, headers={"Content-Type": s.headers.get("Content-Type", "application/json")})
        try:
            with urllib.request.urlopen(req, timeout=15) as r: d, c = r.read(), r.status
        except Exception as e: d, c = str(e).encode(), 502
        s.send_response(c); s.send_header("Content-Type", "application/json"); s.send_header("Content-Length", str(len(d))); s.end_headers(); s.wfile.write(d)
    def video(s, p):
        fn = os.path.join(TRL, os.path.basename(p))
        if not os.path.isfile(fn): return s.send_error(404)
        n = os.path.getsize(fn); a, b = 0, n - 1; m = re.match(r"bytes=(\d*)-(\d*)", s.headers.get("Range", ""))
        if m: a = int(m.group(1) or 0); b = int(m.group(2)) if m.group(2) else n - 1
        b = min(b, n - 1); s.send_response(206 if m else 200); s.send_header("Content-Type", "video/webm" if fn.endswith(".webm") else "video/mp4")
        s.send_header("Accept-Ranges", "bytes"); s.send_header("Content-Length", str(b - a + 1))
        if m: s.send_header("Content-Range", "bytes %d-%d/%d" % (a, b, n))
        s.end_headers()
        with open(fn, "rb") as f:
            f.seek(a); left = b - a + 1
            while left > 0:
                c = f.read(min(262144, left))
                if not c: break
                try: s.wfile.write(c)
                except Exception: return
                left -= len(c)
    def do_GET(s):
        path = s.path.split("?")[0]
        if path.startswith("/api/"): return s.proxy()
        if path == "/trailers": fs = {os.path.splitext(f)[0]: f for f in os.listdir(TRL) if f.endswith((".webm", ".mp4"))}; return s.js({"ids": sorted(fs), "files": fs})
        if path == "/stubs":
            y = re.search(r"year=(\d{4})", s.path); st = [x for x in read_stubs() if not y or x.get("d", "").startswith(y.group(1))]
            cnt = {}
            for x in st: cnt[x.get("t", "?")] = cnt.get(x.get("t", "?"), 0) + 1
            return s.js({"stubs": st, "rewind": {"count": len(st), "top": sorted(cnt.items(), key=lambda kv: -kv[1])[:10]}})
        if path == "/lights/status": return s.js({"state": L.state, "dry": DRY, "token": bool(token()), "lights": cfg()["lights"]})
        if path.startswith("/cinema/trailers/"): return s.video(path)
        if not (path.startswith("/cinema/") or path.startswith("/web/")): return s.send_error(404)
        if path.startswith("/cinema/") and not path.endswith((".webp", ".json")): return s.send_error(404)  # originals stay off the wire
        super().do_GET()
    def do_POST(s):
        path = s.path.split("?")[0]; body = s.rfile.read(int(s.headers.get("Content-Length") or 0))
        if path.startswith("/api/"): return s.proxy(body)
        if path == "/stubs":
            try: m = json.loads(body or b"{}")
            except Exception: m = {}
            st = {"id": str(m.get("id", ""))[:120], "t": str(m.get("t", ""))[:200], "y": str(m.get("y", ""))[:8], "g": m.get("g") or [], "d": datetime.datetime.now().isoformat(timespec="minutes")}
            with LOCK:
                a = read_stubs(); a.append(st); tmp = STUBS + ".tmp"
                json.dump(a, open(tmp, "w", encoding="utf-8"), indent=1); os.replace(tmp, STUBS)
            return s.js({"ok": True, "stub": st, "n": len(a)})
        if path.startswith("/lights/"):
            act = path[8:]
            if act in ("start", "pause", "resume", "stop"): getattr(L, act)(); return s.js({"ok": True, "state": L.state, "dry": DRY})
        s.send_error(404)
    def log_message(s, *a): pass
print(f"Cave Cinema helper v02 on http://127.0.0.1:{PORT}" + (" (DRY lights)" if DRY else ""))
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
