"""Zombie Tiles - Lights Helper (v0.2).

Runs on a PC on the same network as the Hue bridge. It serves a small page at http://127.0.0.1:8790/
that joins the game room as a non-player "lights" peer (PeerJS / WebRTC, like the phones), and turns
game events into Philips Hue light effects through the bridge's local API.

  python helper.py                 # normal (uses private/settings.json + private/hue-key.json)
  python helper.py --mock          # test mode: a fake bridge, no real lights touched
  python helper.py --pair          # one-time pairing (press the bridge's link button when asked)
  python helper.py --restore       # put lights back from a snapshot left by a crashed run, then exit

Only the standard library is needed. The app key is stored in private/hue-key.json (never committed).
"""
import argparse
import json
import mimetypes
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

    def watchdog(self):
        """If the helper page stops talking (closed/crashed) during a game, put the lights back."""
        while True:
            time.sleep(5)
            if self.engine and self.engine.session and self.page_seen and time.time() - self.last_ping > 120:
                log("helper page silent for 2 minutes: restoring lights")
                self.engine.restore_now("helper page closed")
                self.page_seen = False


# ------------------------------------------------------------------ HTTP (localhost only)
def make_handler(app):
    class H(BaseHTTPRequestHandler):
        server_version = "ZTLightsHelper/0.2"

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
                return self._json(200, {"ok": True})
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
                e.set_fx(body.get("fx") or {})
                return self._json(200, {"ok": True})
            if p == "/api/config":
                sel = [str(x) for x in body.get("selected") or []]
                e.set_config(bool(body.get("enabled")), sel)
                app.settings.data["lastEnabled"], app.settings.data["lastSelected"] = bool(body.get("enabled")), sel
                app.settings.save()
                return self._json(200, {"ok": True})
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


def install_exit_handlers(app):
    done = {"v": False}

    def restore_and_exit(*_):
        if done["v"]:
            return
        done["v"] = True
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
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(app))
    install_exit_handlers(app)
    url = "http://127.0.0.1:%d/" % port + ("?mock=1" if args.mock else "")
    log("Lights Helper running at %s  (keep this window open while you play; Ctrl+C to stop)" % url)
    if app.reach_error:
        log(app.reach_error)
    elif not app.bridge.key:
        log("Not paired with the bridge yet: run pair-hue-bridge.bat (or click Pair in the page).")
    else:
        log("Bridge OK: %s, %d rooms/zones" % (app.bridge_info.get("name"), len(app.engine.groups)))
    if app.engine and app.engine.stale_snapshot:
        log("A light snapshot from an earlier run was found. Use 'Restore lights' in the page if your lights are still in game colours.")
    if not args.no_browser and app.settings.data.get("openBrowser", True):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
