"""Zombie Tiles - Lights Helper (v0.2.1).

Runs on a PC on the same network as the Hue bridge. It serves a small page at http://127.0.0.1:8790/
that joins the game room as a non-player "lights" peer (PeerJS / WebRTC, like the phones), and turns
game events into Philips Hue light effects through the bridge's local API.

  python helper.py                 # normal (uses private/settings.json + private/hue-key.json)
  python helper.py --mock          # test mode: a fake bridge, no real lights touched
  python helper.py --pair          # one-time pairing (press the bridge's link button when asked)
  python helper.py --restore       # put lights back from a snapshot left by a crashed run, then exit
  python helper.py --relay off     # don't start the background browser (use a visible Edge/Chrome tab instead)

How the room connection works (v0.2.1): helper.py starts a hidden ("headless") Edge or Chrome that opens
http://127.0.0.1:8790/?relay=1. That background page holds the WebRTC link to the TV. Firefox is NOT
used for the link: on some home networks Firefox cannot reach a Chromecast over WebRTC, while
Chromium-based browsers can. The visible helper page can be open in any browser; it only shows status.

Only the standard library is needed. The app key is stored in private/hue-key.json (never committed).
"""
import argparse
import ctypes
import json
import shutil
import socket
import mimetypes
import re
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)                       # the zombie-tiles game folder (js/, assets/)
WWW = os.path.join(HERE, "www")
sys.path.insert(0, HERE)
import hue_engine  # noqa: E402
from hue_engine import Bridge, Engine  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DEFAULT_SETTINGS = {
    "bridgeIp": "",                 # empty = auto-discover (discovery.meethue.com)
    "bridgeScheme": "http",
    "port": 8790,
    "castDevice": "Bedroom TV",
    "homeHubDir": r"D:\AI\HomeHub",   # cast_url.py / quit_app.py / .venv live here (optional)
    "gameUrl": "https://amazingjustinlewis-web.github.io/games/zombie-tiles/",
    "quitBeforeCast": True,
    "openBrowser": True,
    "lastSelected": [],
    "lastEnabled": False,
    "prefsRev": 0,                  # bumped when lights are chosen on the helper page (the TV then adopts them)
    "lastRoom": "",                 # the helper keeps trying to join this room (set by Cast / Connect)
    "relay": "auto",                # "auto": background headless Edge/Chrome holds the room link; "off": a visible tab does
    "browser": "",                  # optional full path to msedge.exe / chrome.exe
}

LOG = []


def log(msg):
    line = time.strftime("%H:%M:%S ") + str(msg)
    LOG.append(line)
    del LOG[:-200]
    print(line, flush=True)


class Settings:
    def __init__(self, private_dir):
        self.dir = private_dir
        os.makedirs(private_dir, exist_ok=True)
        self.path = os.path.join(private_dir, "settings.json")
        self.key_path = os.path.join(private_dir, "hue-key.json")
        self.data = dict(DEFAULT_SETTINGS)
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8-sig") as f:
                    self.data.update(json.load(f))
            except Exception as e:
                log("settings.json unreadable (%r), using defaults" % e)
        else:
            self.save()

    def save(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2)

    def key(self):
        try:
            with open(self.key_path, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception:
            return None

    def save_key(self, info):
        with open(self.key_path, "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2)


def mock_bridge_key():
    import mock_bridge
    return mock_bridge.MOCK_KEY


def discover_bridge():
    try:
        with urllib.request.urlopen("https://discovery.meethue.com/", timeout=6) as r:
            found = json.loads(r.read().decode())
        if found:
            return found[0].get("internalipaddress")
    except Exception as e:
        log("bridge discovery failed: %r" % e)
    return None


# ------------------------------------------------------------------ background browser ("relay")
def find_chromium(override=""):
    if override and os.path.exists(override):
        return override
    cands = []
    if os.name == "nt":
        pf, pf86, lad = os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), os.environ.get("LOCALAPPDATA", "")
        cands = [os.path.join(pf86, r"Microsoft\Edge\Application\msedge.exe"), os.path.join(pf, r"Microsoft\Edge\Application\msedge.exe"),
                 os.path.join(pf, r"Google\Chrome\Application\chrome.exe"), os.path.join(pf86, r"Google\Chrome\Application\chrome.exe"),
                 os.path.join(lad, r"Google\Chrome\Application\chrome.exe")]
    else:
        cands = ["/opt/google/chrome/chrome"] + [shutil.which(n) or "" for n in ("google-chrome", "chromium", "chromium-browser", "microsoft-edge")]
    for c in cands:
        if c and os.path.exists(c):
            return c
    return ""


class KillOnCloseJob:
    """Windows job object: every process put in it dies when the helper exits, even after a crash."""
    def __init__(self):
        self.h = None
        if os.name != "nt":
            return
        try:
            k32 = ctypes.windll.kernel32
            k32.CreateJobObjectW.restype = ctypes.c_void_p
            k32.OpenProcess.restype = ctypes.c_void_p
            k32.SetInformationJobObject.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
            k32.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
            k32.CloseHandle.argtypes = [ctypes.c_void_p]
            self.h = k32.CreateJobObjectW(None, None)

            class BASIC(ctypes.Structure):
                _fields_ = [("a", ctypes.c_int64), ("b", ctypes.c_int64), ("LimitFlags", ctypes.c_uint32), ("c", ctypes.c_size_t),
                            ("d", ctypes.c_size_t), ("e", ctypes.c_uint32), ("f", ctypes.c_size_t), ("g", ctypes.c_uint32), ("h", ctypes.c_uint32)]

            class IOC(ctypes.Structure):
                _fields_ = [("x", ctypes.c_uint64 * 6)]

            class EXT(ctypes.Structure):
                _fields_ = [("Basic", BASIC), ("Io", IOC), ("p1", ctypes.c_size_t), ("p2", ctypes.c_size_t), ("p3", ctypes.c_size_t), ("p4", ctypes.c_size_t)]
            info = EXT()
            info.Basic.LimitFlags = 0x2000          # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if not k32.SetInformationJobObject(self.h, 9, ctypes.byref(info), ctypes.sizeof(info)):
                log("note: job object setup failed (error %d)" % k32.GetLastError())
        except Exception as e:
            log("note: job object unavailable (%r)" % e)
            self.h = None

    def add(self, proc):
        if not self.h:
            return
        try:
            k32 = ctypes.windll.kernel32
            hp = k32.OpenProcess(0x1F0FFF, False, proc.pid)
            if not k32.AssignProcessToJobObject(self.h, hp):
                log("note: could not tie the background browser to the helper (error %d)" % k32.GetLastError())
            k32.CloseHandle(hp)
        except Exception as e:
            log("note: could not tie the background browser to the helper (%r)" % e)


class Relay:
    def __init__(self, app, url):
        self.app, self.url = app, url
        self.proc, self.exe, self.error, self.restarts = None, "", "", 0
        self.job = KillOnCloseJob()
        self.stopping = False

    def start(self):
        self.exe = find_chromium(self.app.settings.data.get("browser", ""))
        if not self.exe:
            self.error = "No Edge or Chrome found: open the helper page in Edge/Chrome and keep it open."
            log(self.error)
            return False
        profile = os.path.join(self.app.settings.dir, "relay-browser")
        args = [self.exe, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--user-data-dir=" + profile, self.url]
        try:
            flags = 0x08000000 if os.name == "nt" else 0      # CREATE_NO_WINDOW
            self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
            self.job.add(self.proc)
            self.error = ""
            log("background browser started for the room link: %s (pid %d)" % (os.path.basename(self.exe), self.proc.pid))
            threading.Thread(target=self.watch, daemon=True).start()
            return True
        except Exception as e:
            self.error = "Could not start %s: %r" % (self.exe, e)
            log(self.error)
            return False

    def watch(self):
        p, t0 = self.proc, time.time()
        p.wait()
        if self.stopping or p is not self.proc:
            return
        if time.time() - t0 > 120:
            self.restarts = 0
        self.restarts += 1
        log("background browser exited (code %s)%s" % (p.returncode, "; restarting" if self.restarts <= 5 else "; giving up"))
        if self.restarts <= 5:
            time.sleep(3)
            self.start()

    def running(self):
        return bool(self.proc and self.proc.poll() is None)

    def stop(self):
        self.stopping = True
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(3)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass


def browser_name(ua):
    ua = ua or ""
    if "HeadlessChrome" in ua or "Headless" in ua:
        return "background " + ("Edge" if "Edg/" in ua else "Chrome")
    if "Firefox/" in ua:
        return "Firefox"
    if "Edg/" in ua:
        return "Edge"
    if "Chrome/" in ua:
        return "Chrome"
    return "browser"


# ------------------------------------------------------------------ app state
class App:
    def __init__(self, args):
        self.args = args
        self.settings = Settings(args.private or os.path.join(HERE, "private" if not args.mock else "private-mock"))
        self.mock = None
        if args.mock:
            import mock_bridge
            self.mock = mock_bridge.MockBridge(args.mock_port, auto_link=False).start()
            ip = "127.0.0.1:%d" % args.mock_port
            log("MOCK MODE: fake bridge on http://%s (no real lights are touched)" % ip)
        else:
            ip = args.bridge or self.settings.data.get("bridgeIp") or ""
            if not ip:
                ip = discover_bridge() or ""
                if ip:
                    self.settings.data["bridgeIp"] = ip
                    self.settings.save()
        self.ip = ip
        key = self.settings.key()
        if key and key.get("bridgeIp") and key.get("bridgeIp") != ip and not args.mock:
            log("note: the saved key was made for bridge %s, current bridge is %s" % (key.get("bridgeIp"), ip))
        if self.mock and key and key.get("username") == mock_bridge_key():
            self.mock.keys.add(key["username"])           # the fake bridge "remembers" an earlier mock pairing
        self.bridge = Bridge(ip, key.get("username") if key else None, self.settings.data.get("bridgeScheme", "http")) if ip else None
        self.engine = Engine(self.bridge, os.path.join(self.settings.dir, "snapshot.json"), log) if self.bridge else None
        self.bridge_info = {}
        self.reach_error = ""
        self.groups_at = 0
        self.pairing = {"state": "idle", "message": ""}
        self.cast = {"state": "idle", "message": ""}
        self.last_ping = time.time()
        self.page_seen = False
        self.pages = {}          # pageId -> info about each open helper page (visible tabs and the background relay)
        self.connector = None    # the one page that holds the WebRTC link to the TV
        self.room = {"want": str(self.settings.data.get("lastRoom") or ""), "state": "idle", "code": "", "detail": "", "ice": "",
                     "since": time.time(), "welcomed": False, "by": ""}
        self.relay = None
        self.host_fx = None
        self.port = 8790
        self.lock = threading.Lock()
        threading.Thread(target=self.watchdog, daemon=True).start()
        self.check_bridge()

    # bridge reachability + inventory
    def check_bridge(self, force=False):
        if not self.bridge:
            self.reach_error = "No bridge address. Set bridgeIp in private/settings.json."
            return
        try:
            self.bridge_info = self.bridge.config()
            self.reach_error = ""
        except Exception as e:
            self.bridge_info = {}
            self.reach_error = "Bridge not reachable at %s (%s)" % (self.ip, e.__class__.__name__)
            return
        if self.bridge.key and (force or time.time() - self.groups_at > 30):
            try:
                self.engine.refresh()
                self.groups_at = time.time()
            except Exception as e:
                msg = str(e)
                if "unauthorized" in msg:
                    self.reach_error = "The saved app key was rejected by the bridge. Pair again."
                    self.bridge.key = None
                else:
                    self.reach_error = "Could not read rooms: %s" % msg[:120]

    def status(self):
        e = self.engine
        paired = bool(self.bridge and self.bridge.key)
        reachable = bool(self.bridge_info)
        groups = sorted(e.groups.values(), key=lambda g: (g["type"] != "Room", g["name"].lower())) if e else []
        return {
            "ok": paired and reachable and bool(groups),
            "mock": bool(self.mock),
            "paired": paired,
            "reachable": reachable,
            "bridge": {"ip": self.ip, "name": self.bridge_info.get("name"), "model": self.bridge_info.get("modelid"),
                       "apiversion": self.bridge_info.get("apiversion")},
            "error": self.reach_error,
            "groups": [{"id": g["id"], "name": g["name"], "type": g["type"], "lights": len(g["lights"])} for g in groups],
            "remembered": {"enabled": bool(self.settings.data.get("lastEnabled")), "selected": self.settings.data.get("lastSelected", [])},
            "prefs": {"enabled": bool(self.settings.data.get("lastEnabled")), "selected": self.settings.data.get("lastSelected", []),
                      "rev": int(self.settings.data.get("prefsRev") or 0)},
            "room": dict(self.room, age=int(time.time() - self.room["since"])),
            "pages": [{"kind": p["kind"], "browser": p["browser"], "connector": pid == self.connector, "age": round(time.time() - p["last"], 1)}
                      for pid, p in self.pages.items() if time.time() - p["last"] < 30],
            "relay": {"mode": self.settings.data.get("relay", "auto"), "running": bool(self.relay and self.relay.running()),
                      "browser": os.path.basename(self.relay.exe) if self.relay and self.relay.exe else "", "error": self.relay.error if self.relay else ""},
            "engine": e.status() if e else None,
            "pairing": self.pairing,
            "cast": dict(self.cast, available=self.cast_available(), device=self.settings.data.get("castDevice")),
            "gameUrl": self.settings.data.get("gameUrl"),
            "log": LOG[-14:],
        }

    # pairing (bridge link button)
    def start_pairing(self, seconds=60):
        if not self.bridge:
            self.pairing = {"state": "error", "message": "No bridge address."}
            return
        if self.pairing.get("state") == "waiting":
            return
        def run():
            end = time.time() + seconds
            self.pairing = {"state": "waiting", "message": "Press the round link button on top of the Hue bridge now.", "until": end}
            log("pairing: waiting up to %ds for the bridge link button..." % seconds)
            while time.time() < end:
                try:
                    key, err = self.bridge.pair_once()
                except Exception as ex:
                    key, err = None, "bridge not reachable (%s)" % ex.__class__.__name__
                if key:
                    self.settings.save_key({"bridgeIp": self.ip, "bridgeId": self.bridge_info.get("bridgeid"), "username": key,
                                            "created": time.strftime("%Y-%m-%d %H:%M:%S")})
                    self.bridge.key = key
                    self.pairing = {"state": "done", "message": "Paired! The app key is saved in %s" % self.settings.key_path}
                    log("pairing: success, key saved to %s" % self.settings.key_path)
                    self.check_bridge(force=True)
                    return
                if err and "link button" not in err:
                    self.pairing["message"] = "Waiting... (bridge says: %s)" % err
                time.sleep(2)
            self.pairing = {"state": "timeout", "message": "No button press seen. Try again and press the bridge button within 60 seconds."}
            log("pairing: timed out")
        threading.Thread(target=run, daemon=True).start()

    # casting the TV page via the existing HomeHub scripts
    def hub_python(self):
        hub = self.settings.data.get("homeHubDir") or ""
        for cand in (os.path.join(hub, ".venv", "Scripts", "python.exe"), os.path.join(hub, ".venv", "bin", "python")):
            if os.path.exists(cand):
                return cand
        return sys.executable

    def cast_available(self):
        hub = self.settings.data.get("homeHubDir") or ""
        return bool(hub) and os.path.exists(os.path.join(hub, "cast_url.py"))

    def start_cast(self, url):
        if not self.cast_available():
            self.cast = {"state": "error", "message": "cast_url.py not found in homeHubDir"}
            return
        if self.cast.get("state") in ("quitting", "casting"):
            return
        if not (url.startswith(self.settings.data["gameUrl"]) or self.args.mock):
            self.cast = {"state": "error", "message": "Refusing to cast a non-game URL"}
            return
        m = re.search(r"[?&]room=([A-Z]{4})", url)
        if m:
            self.set_room(m.group(1), "cast")
        hub = self.settings.data["homeHubDir"]
        py = self.hub_python()
        dev = self.settings.data.get("castDevice") or "Bedroom TV"
        def run():
            try:
                if self.settings.data.get("quitBeforeCast", True) and os.path.exists(os.path.join(hub, "quit_app.py")):
                    self.cast = {"state": "quitting", "message": "Closing what's on %s..." % dev}
                    log("cast: quitting the current app on %s" % dev)
                    subprocess.run([py, os.path.join(hub, "quit_app.py")], cwd=hub, timeout=60, capture_output=True)
                self.cast = {"state": "casting", "message": "Opening the game on %s..." % dev}
                log("cast: %s -> %s" % (dev, url))
                r = subprocess.run([py, os.path.join(hub, "cast_url.py"), dev, url, "--wait", "6"], cwd=hub, timeout=120,
                                   capture_output=True, text=True, encoding="utf-8", errors="replace")
                ok = "DashCast launched" in (r.stdout or "")
                self.cast = {"state": "done" if ok else "error",
                             "message": ("Game is on %s." % dev) if ok else ("Cast not confirmed: " + ((r.stdout or r.stderr or "").strip().splitlines() or ["?"])[-1])}
                log("cast: " + self.cast["message"])
            except Exception as e:
                self.cast = {"state": "error", "message": "Cast failed: %r" % e}
                log(self.cast["message"])
        threading.Thread(target=run, daemon=True).start()

    def set_room(self, code, why):
        code = re.sub(r"[^A-Z]", "", str(code or "").upper())[:4]
        if len(code) != 4:
            return False
        if code != self.room["want"]:
            log("room link: now joining room %s (%s)" % (code, why))
        self.room.update(want=code, state="connecting", code=code, detail="", ice="", welcomed=False, since=time.time(), logged=time.time())
        self.settings.data["lastRoom"] = code
        self.settings.save()
        return True

    def page_ping(self, b):
        now = time.time()
        pid = str(b.get("pageId") or "")[:40] or "anon"
        kind = "relay" if b.get("kind") == "relay" else "ui"
        p = self.pages.get(pid)
        if not p:
            p = self.pages[pid] = {"kind": kind, "ua": str(b.get("ua") or "")[:200], "browser": browser_name(b.get("ua")), "first": now, "last": now}
            log("helper page opened: %s%s" % (p["browser"], " (relay)" if kind == "relay" else ""))
        p["last"] = now
        for k in list(self.pages):                       # forget pages that went away
            if now - self.pages[k]["last"] > 60:
                if k == self.connector:
                    log("room link: the %s page went away" % self.pages[k]["browser"])
                    self.connector = None
                del self.pages[k]
        alive = {k: v for k, v in self.pages.items() if now - v["last"] < 8}
        cur = self.connector if self.connector in alive else None
        relays = sorted((v["first"], k) for k, v in alive.items() if v["kind"] == "relay")
        if relays and (cur is None or alive[cur]["kind"] != "relay"):
            cur = relays[-1][1]
        if cur and alive[cur]["kind"] != "relay" and alive[cur]["browser"] == "Firefox":
            better = [k for k, v in alive.items() if v["browser"] != "Firefox"]
            if better:
                cur = better[0]
        if cur is None and alive:
            # no background relay: use a visible tab, preferring Edge/Chrome (Firefox can't reach the Chromecast on some networks)
            cur = sorted(alive.items(), key=lambda kv: ("Firefox" in kv[1]["browser"], -kv[1]["first"]))[0][0]
        if cur != self.connector:
            if cur:
                log("room link: handled by the %s page" % self.pages[cur]["browser"])
                if self.pages[cur]["browser"] == "Firefox":
                    log("WARNING: Firefox often cannot connect to a Chromecast. Open http://127.0.0.1:%s/ in Edge or Chrome instead." % self.port)
            self.connector = cur
            if self.room["welcomed"]:
                self.room["since"] = now
            self.room.update(state="connecting", welcomed=False, ice="", detail="", logged=now)
        if pid == self.connector and self.room["want"]:
            st, code = str(b.get("state") or ""), str(b.get("code") or "")
            ice, detail = str(b.get("ice") or ""), str(b.get("detail") or "")[:80]
            if code == self.room["want"]:
                cls = lambda x: x if x in ("welcomed", "noroom", "offline") else "trying"
                was = self.room["state"]
                if cls(st) != cls(was) or (cls(st) == "trying" and now - self.room.get("logged", 0) > 60):
                    desc = {"noroom": "the TV has not opened this room (yet)", "welcomed": "CONNECTED to the TV", "offline": "offline",
                            "trying": "connecting" if cls(was) != "trying" else "still connecting"}[cls(st)]
                    if st == "online":
                        desc += " (linked, waiting for the TV's hello)"
                    log("room %s: %s%s%s via %s" % (code, desc, (" (ice: %s)" % ice) if ice else "", (" - " + detail) if detail else "", self.pages[pid]["browser"]))
                    self.room["logged"] = now
                if (st == "welcomed") != (was == "welcomed"):
                    self.room["since"] = now
                self.room.update(state=st, code=code, ice=ice, detail=detail, welcomed=(st == "welcomed"), by=self.pages[pid]["browser"])
        return {"ok": True, "connector": pid == self.connector, "wantRoom": self.room["want"], "fx": self.host_fx}

    def watchdog(self):
        """If the helper page stops talking (closed/crashed) during a game, put the lights back."""
        while True:
            time.sleep(5)
            c = self.pages.get(self.connector) if self.connector else None
            if self.room["want"] and self.room["state"] != "nolink" and (not c or time.time() - c["last"] > 15):
                log("room %s: no page is holding the TV link right now%s" % (self.room["want"], " (background browser not running?)" if self.relay else " (open the helper page in Edge or Chrome)"))
                if self.room["welcomed"]:
                    self.room["since"] = time.time()
                self.room.update(state="nolink", welcomed=False, ice="", by="")
            if self.engine and self.engine.session and self.page_seen and time.time() - self.last_ping > 120:
                log("helper page silent for 2 minutes: restoring lights")
                self.engine.restore_now("helper page closed")
                self.page_seen = False
            elif self.engine and self.engine.session and self.room["state"] != "welcomed" and time.time() - self.room["since"] > 120:
                log("lost the TV for 2 minutes: restoring lights")
                self.engine.restore_now("lost the TV")
                self.room["since"] = time.time()


# ------------------------------------------------------------------ HTTP (localhost only)
def make_handler(app):
    class H(BaseHTTPRequestHandler):
        server_version = "ZTLightsHelper/0.2.1"

        def log_message(self, *a):
            pass

        def _host_ok(self):
            host = (self.headers.get("Host") or "").split(":")[0]
            return host in ("127.0.0.1", "localhost")

        def _json(self, code, obj):
            b = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def _file(self, path):
            if not os.path.isfile(path):
                self.send_error(404)
                return
            ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
            if path.endswith(".js"):
                ctype = "text/javascript"
            with open(path, "rb") as f:
                b = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            if not self._host_ok():
                self.send_error(403)
                return
            p = self.path.split("?")[0]
            if p in ("/", "/index.html"):
                return self._file(os.path.join(WWW, "helper.html"))
            if p.startswith("/www/"):
                return self._file(self._safe(WWW, p[5:]))
            if p == "/game/js/vendor/peerjs.min.js" and os.environ.get("ZT_TEST_PEERJS"):    # automated tests only
                return self._file(os.environ["ZT_TEST_PEERJS"])
            if p.startswith("/game/"):
                return self._file(self._safe(GAME, p[6:]))
            if p == "/api/status":
                if app.engine is None or not app.bridge_info or time.time() - app.groups_at > 30:
                    app.check_bridge()
                return self._json(200, app.status())
            self.send_error(404)

        def _safe(self, root, rel):
            full = os.path.normpath(os.path.join(root, rel.replace("/", os.sep)))
            return full if full.startswith(os.path.normpath(root) + os.sep) else os.path.join(root, "__nope__")

        def do_POST(self):
            # Only our own page may call the API: same-host check + a custom header (blocks cross-site requests).
            if not self._host_ok() or self.headers.get("X-ZT-Helper") != "1":
                self.send_error(403)
                return
            n = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(n).decode() or "{}") if n else {}
            except ValueError:
                return self._json(400, {"error": "bad json"})
            p = self.path.split("?")[0]
            e = app.engine
            app.last_ping, app.page_seen = time.time(), True
            if p == "/api/ping":
                return self._json(200, app.page_ping(body))
            if p == "/api/room":
                ok = app.set_room(body.get("code"), "typed on the helper page")
                return self._json(200 if ok else 400, {"ok": ok})
            if p == "/api/pair":
                app.start_pairing(int(body.get("seconds") or 60))
                return self._json(200, {"ok": True})
            if p == "/api/cast":
                app.start_cast(str(body.get("url") or ""))
                return self._json(200, {"ok": True})
            if p == "/api/mock-link" and app.mock:
                return self._json(200, app.mock.mock("POST", ["link"], None))
            if p == "/api/refresh":
                app.check_bridge(force=True)
                return self._json(200, app.status())
            if not e:
                return self._json(409, {"error": app.reach_error or "no bridge"})
            if p == "/api/hostcfg":
                app.host_fx = body.get("fx") or None
                e.set_fx(body.get("fx") or {})
                return self._json(200, {"ok": True})
            if p == "/api/config":
                sel = [str(x) for x in body.get("selected") or []]
                e.set_config(bool(body.get("enabled")), sel)
                if (bool(body.get("enabled")), sel) != (bool(app.settings.data.get("lastEnabled")), app.settings.data.get("lastSelected")):
                    names = [app.engine.groups.get(g, {}).get("name", g) for g in sel]
                    log("lights from the game: %s" % (("ON for " + ", ".join(names)) if body.get("enabled") and sel else "off"))
                app.settings.data["lastEnabled"], app.settings.data["lastSelected"] = bool(body.get("enabled")), sel
                app.settings.save()
                return self._json(200, {"ok": True})
            if p == "/api/prefs":                       # "Use lights" checklist on the helper page itself
                sel = [str(x) for x in body.get("selected") or [] if str(x) in e.groups]
                en = bool(body.get("enabled"))
                app.settings.data["lastEnabled"], app.settings.data["lastSelected"] = en, sel
                app.settings.data["prefsRev"] = int(app.settings.data.get("prefsRev") or 0) + 1
                app.settings.save()
                e.set_config(en, sel)
                names = [e.groups.get(g, {}).get("name", g) for g in sel]
                log("lights chosen on the helper page: %s" % (("ON for " + ", ".join(names)) if en and sel else "off"))
                return self._json(200, app.status())
            if p == "/api/fx":
                k = str(body.get("k") or "")
                e.event(k, body)
                return self._json(200, {"ok": True})
            if p == "/api/test":
                e.test(body.get("groups") or [])
                return self._json(200, {"ok": True})
            if p == "/api/restore":
                if body.get("stale"):
                    e.restore_stale()
                else:
                    e.restore_now("restore button")
                return self._json(200, {"ok": True})
            if p == "/api/bye":
                return self._json(200, {"ok": True})
            self._json(404, {"error": "unknown"})
    return H


class SingleServer(ThreadingHTTPServer):
    daemon_threads = True


def helper_already_running(port):
    """True if a Lights Helper already answers on this port (Windows would otherwise let two run side by side)."""
    try:
        r = urllib.request.urlopen("http://127.0.0.1:%d/api/status" % port, timeout=2)
        return "ZTLightsHelper" in (r.headers.get("Server") or "")
    except Exception:
        return False


def open_ui(app, url):
    """The visible page can be any browser when the background relay runs; otherwise prefer Edge/Chrome."""
    if app.relay and app.relay.running():
        webbrowser.open(url)
        return
    exe = find_chromium(app.settings.data.get("browser", ""))
    if exe:
        try:
            subprocess.Popen([exe, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except Exception:
            pass
    webbrowser.open(url)


def install_exit_handlers(app):
    done = {"v": False}

    def restore_and_exit(*_):
        if done["v"]:
            return
        done["v"] = True
        if app.relay:
            app.relay.stop()
        if app.engine and app.engine.session:
            log("closing: putting the lights back first...")
            app.engine.shutdown_restore(2.0)        # Windows allows ~5 s when the console is closed
    signal.signal(signal.SIGINT, lambda *a: (restore_and_exit(), os._exit(0)))
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, lambda *a: (restore_and_exit(), os._exit(0)))
    if os.name == "nt":       # closing the console window: Windows gives us ~5 s
        try:
            import ctypes
            HANDLER = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_uint)

            def on_ctrl(evt):
                restore_and_exit()
                return 0
            app._ctrl_handler = HANDLER(on_ctrl)   # keep a reference
            ctypes.windll.kernel32.SetConsoleCtrlHandler(app._ctrl_handler, True)
        except Exception as e:
            log("console close handler not installed: %r" % e)


def pair_cli(app):
    if not app.bridge:
        print("No Hue bridge address found. Put it in %s as \"bridgeIp\"." % app.settings.path)
        return 1
    print("Hue bridge: %s (%s)" % (app.ip, app.bridge_info.get("name") or "not reachable!"))
    if not app.bridge_info:
        print(app.reach_error)
        return 1
    if app.bridge.key:
        print("Already paired (key in %s). Pairing again makes a new key." % app.settings.key_path)
    print("\n>>> Walk to the bridge and PRESS THE ROUND LINK BUTTON on top now. <<<")
    print("Waiting up to 60 seconds...\n")
    app.start_pairing(60)
    while True:
        time.sleep(0.5)
        st = app.pairing.get("state")
        if st == "done":
            print("SUCCESS: paired. Key saved to %s" % app.settings.key_path)
            app.check_bridge(force=True)
            print("Rooms and zones found: " + ", ".join(g["name"] for g in app.engine.groups.values()))
            return 0
        if st in ("timeout", "error"):
            print("FAILED: " + app.pairing.get("message", ""))
            return 2


def main():
    ap = argparse.ArgumentParser(description="Zombie Tiles Lights Helper")
    ap.add_argument("--mock", action="store_true", help="use a fake bridge (testing)")
    ap.add_argument("--mock-port", type=int, default=8899)
    ap.add_argument("--bridge", help="bridge IP (overrides settings)")
    ap.add_argument("--port", type=int, help="helper page port (default 8790)")
    ap.add_argument("--private", help="folder for settings/key/snapshot (default ./private)")
    ap.add_argument("--pair", action="store_true", help="pair with the bridge (press its button) and exit")
    ap.add_argument("--restore", action="store_true", help="restore lights from a leftover snapshot and exit")
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--relay", choices=["auto", "off"], help="background Edge/Chrome for the room link (default: settings, auto)")
    args = ap.parse_args()
    app = App(args)
    if args.pair:
        sys.exit(pair_cli(app))
    if args.restore:
        if app.engine and app.engine.stale_snapshot:
            app.check_bridge(force=True)
            app.engine.restore_stale()
            time.sleep(0.5)
            app.engine.sender.flush(10)
            time.sleep(2.5)
            app.engine.sender.flush(5)
            print("Lights restored.")
        else:
            print("No leftover snapshot to restore.")
        return
    port = args.port or int(app.settings.data.get("port") or 8790)
    app.port = port
    url = "http://127.0.0.1:%d/" % port + ("?mock=1" if args.mock else "")
    httpd = None
    if not helper_already_running(port):
        try:
            httpd = SingleServer(("127.0.0.1", port), make_handler(app))
        except OSError as e:
            log("Could not open port %d: %s" % (port, e))
    if httpd is None:
        log("The Lights Helper is ALREADY RUNNING (port %d is in use). Opening its page; this extra window will close." % port)
        if not args.no_browser:
            webbrowser.open(url)
        time.sleep(4)
        if app.mock:
            app.mock.stop() if hasattr(app.mock, "stop") else None
        os._exit(0)
    install_exit_handlers(app)
    log("Lights Helper running at %s  (keep this window open while you play; Ctrl+C to stop)" % url)
    if app.reach_error:
        log(app.reach_error)
    elif not app.bridge.key:
        log("Not paired with the bridge yet: run pair-hue-bridge.bat (or click Pair in the page).")
    else:
        log("Bridge OK: %s, %d rooms/zones" % (app.bridge_info.get("name"), len(app.engine.groups)))
    if app.engine and app.engine.stale_snapshot:
        log("A light snapshot from an earlier run was found. Use 'Restore lights' in the page if your lights are still in game colours.")
    if (args.relay or app.settings.data.get("relay", "auto")) != "off":
        app.relay = Relay(app, url + ("&" if "?" in url else "?") + "relay=1")
        app.relay.start()
    if not args.no_browser and app.settings.data.get("openBrowser", True):
        threading.Timer(0.8, lambda: open_ui(app, url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
