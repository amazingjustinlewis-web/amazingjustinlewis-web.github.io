"""A fake Philips Hue bridge (v1 REST API subset) for testing the Lights Helper without real lights.

  python mock_bridge.py --port 8899            # standalone
  python helper.py --mock                      # the helper starts one of these automatically

Supports: GET /api/config, POST /api (pairing; needs the "link button": POST /mock/link or --auto-link),
GET /api/<key>/groups|lights, PUT /api/<key>/lights/<id>/state, PUT /api/<key>/groups/<id>/action.
Test hooks: GET /mock/log (every command with timestamps), GET /mock/rates, POST /mock/reset."""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MOCK_KEY = "mock-app-key-0123456789abcdef"


def initial_state():
    def light(name, kind, on=True, bri=200, xy=(0.4573, 0.41), ct=366):
        st = {"on": on, "bri": bri, "alert": "none", "reachable": True}
        if kind in ("Extended color light", "Color light"):
            st.update({"xy": list(xy), "ct": ct, "colormode": "ct" if kind == "Extended color light" else "xy", "hue": 8000, "sat": 140})
        elif kind == "Color temperature light":
            st.update({"ct": ct, "colormode": "ct"})
        return {"name": name, "type": kind, "state": st, "modelid": "MOCK", "uniqueid": "00:17:88:01:00:00:00:%02x-0b" % len(name)}
    lights = {
        "1": light("Bed lamp L", "Extended color light"),
        "2": light("Bed lamp R", "Extended color light", on=False),
        "3": light("Bedroom ceiling", "Color temperature light", bri=120),
        "4": light("Projector strip", "Color light", xy=(0.17, 0.05)),
        "5": light("Sofa lamp", "Extended color light", bri=80),
        "6": light("Kitchen spot", "Dimmable light", bri=254),
        "7": light("Hall bulb", "Dimmable light", on=False),
    }
    groups = {
        "1": {"name": "Bedroom", "type": "Room", "class": "Bedroom", "lights": ["1", "2", "3", "4"]},
        "2": {"name": "Living room", "type": "Room", "class": "Living room", "lights": ["5"]},
        "3": {"name": "Kitchen", "type": "Room", "class": "Kitchen", "lights": ["6"]},
        "4": {"name": "Hallway", "type": "Room", "class": "Hallway", "lights": ["7"]},
        "5": {"name": "Movie corner", "type": "Zone", "class": "TV", "lights": ["4", "5"]},
        "200": {"name": "TV area (entertainment)", "type": "Entertainment", "class": "TV", "lights": ["4"]},
    }
    return lights, groups


class MockBridge:
    def __init__(self, port=8899, auto_link=False, host="127.0.0.1", lights_ms=None):
        self.port, self.auto_link = port, auto_link
        self.lights, self.groups = initial_state()
        self.keys = {MOCK_KEY} if auto_link == "prepaired" else set()
        self.link_until = 0.0
        self.log = []
        self.lock = threading.Lock()
        bridge = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, code, obj):
                b = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def _body(self):
                n = int(self.headers.get("Content-Length") or 0)
                try:
                    return json.loads(self.rfile.read(n).decode() or "{}") if n else {}
                except ValueError:
                    return None

            def do_GET(self):
                self._send(200, bridge.handle("GET", self.path, None))

            def do_POST(self):
                self._send(200, bridge.handle("POST", self.path, self._body()))

            def do_PUT(self):
                self._send(200, bridge.handle("PUT", self.path, self._body()))

        self.httpd = ThreadingHTTPServer((host, port), H)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def start(self):
        self.thread.start()
        return self

    def handle(self, method, path, body):
        path = path.split("?")[0].rstrip("/")
        p = [x for x in path.split("/") if x]
        with self.lock:
            if p[:1] == ["mock"]:
                return self.mock(method, p[1:], body)
            if p[:1] != ["api"]:
                return [{"error": {"type": 4, "address": path, "description": "method not available"}}]
            if p == ["api", "config"] or (len(p) == 3 and p[2] == "config" and method == "GET" and p[1] not in self.keys):
                return {"name": "Mock Hue Bridge", "datastoreversion": "197", "swversion": "1978293000", "apiversion": "1.78.0",
                        "mac": "00:17:88:00:00:00", "bridgeid": "001788FFFE000000", "factorynew": False, "modelid": "BSB002"}
            if p == ["api"] and method == "POST":
                if not body or "devicetype" not in body:
                    return [{"error": {"type": 2, "address": "/", "description": "body contains invalid json"}}]
                if self.auto_link is True or time.time() < self.link_until:
                    self.keys.add(MOCK_KEY)
                    return [{"success": {"username": MOCK_KEY}}]
                return [{"error": {"type": 101, "address": "", "description": "link button not pressed"}}]
            if len(p) < 3 or p[1] not in self.keys:
                return [{"error": {"type": 1, "address": "/" + "/".join(p[2:]), "description": "unauthorized user"}}]
            rest = p[2:]
            if rest == ["lights"] and method == "GET":
                return self.lights
            if rest == ["groups"] and method == "GET":
                return self.groups
            if len(rest) == 3 and rest[0] == "lights" and rest[2] == "state" and method == "PUT":
                return self.put_light(rest[1], body or {}, "l")
            if len(rest) == 3 and rest[0] == "groups" and rest[2] == "action" and method == "PUT":
                g = self.groups.get(rest[1])
                if not g:
                    return [{"error": {"type": 3, "description": "resource not available"}}]
                self.log.append({"t": time.time(), "kind": "g", "id": rest[1], "body": body})
                for lid in g["lights"]:
                    self.put_light(lid, dict(body or {}), None)
                return [{"success": {"/groups/%s/action/%s" % (rest[1], k): v}} for k, v in (body or {}).items()]
            return [{"error": {"type": 4, "description": "method not available"}}]

    def put_light(self, lid, body, logkind):
        li = self.lights.get(lid)
        if not li:
            return [{"error": {"type": 3, "description": "resource, /lights/%s, not available" % lid}}]
        if logkind:
            self.log.append({"t": time.time(), "kind": logkind, "id": lid, "body": body})
        st = li["state"]
        out = []
        if "on" in body:
            st["on"] = bool(body["on"])
        for k, v in body.items():
            if k in ("on", "transitiontime"):
                continue
            if k == "alert":
                st["alert"] = v
                continue
            if not st["on"]:
                out.append({"error": {"type": 201, "description": "parameter, %s, is not modifiable. Device is set to off." % k}})
                continue
            if k in ("xy", "ct", "hue", "sat") and k not in st and not (k in ("hue", "sat") and "xy" in st):
                continue  # light can't do that: ignored like a real bridge would for group calls
            st[k] = v
            if k in ("xy", "ct"):
                st["colormode"] = k
            elif k in ("hue", "sat"):
                st["colormode"] = "hs"
            out.append({"success": {"/lights/%s/state/%s" % (lid, k): v}})
        return out

    def mock(self, method, p, body):
        if p == ["link"]:
            self.link_until = time.time() + 30
            return {"ok": True, "message": "link button pressed (30 s window)"}
        if p == ["log"]:
            return self.log
        if p == ["state"]:
            return {"lights": self.lights, "groups": self.groups}
        if p == ["reset"]:
            self.lights, self.groups = initial_state()
            self.log = []
            return {"ok": True}
        if p == ["rates"]:
            return rates(self.log)
        return {"error": "unknown mock endpoint"}


def rates(log):
    """Max commands seen in any 1-second window, split into light and group commands."""
    out = {}
    for kind in ("l", "g"):
        ts = sorted(e["t"] for e in log if e["kind"] == kind)
        best, j = 0, 0
        for i in range(len(ts)):
            while ts[i] - ts[j] >= 1.0:
                j += 1
            best = max(best, i - j + 1)
        out[kind] = {"count": len(ts), "maxPerSecond": best}
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8899)
    ap.add_argument("--auto-link", action="store_true", help="accept pairing without a link press")
    ap.add_argument("--prepaired", action="store_true", help="accept the mock key from the start")
    a = ap.parse_args()
    MockBridge(a.port, "prepaired" if a.prepaired else a.auto_link).start()
    print("Mock Hue bridge on http://127.0.0.1:%d  (key when paired: %s)" % (a.port, MOCK_KEY))
    while True:
        time.sleep(3600)
