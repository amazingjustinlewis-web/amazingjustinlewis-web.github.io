"""Zombie Tiles Lights Helper - Philips Hue bridge client, rate limiter and game light effects.

Standard library only. Talks to the bridge's local v1 REST API (http://<bridge>/api/<key>/...).
Rate limits (Philips guidance): about 10 light commands/s and 1 group command/s. All commands go
through a coalescing queue: if a newer command for the same light/group arrives before the old one
was sent, they are merged (newest values win), so effects never build up a backlog.
"""
import json
import os
import queue
import random
import ssl
import threading
import time
import heapq
import urllib.request
import urllib.error

# Defaults mirror games/zombie-tiles/js/config.js -> hue. The TV sends its own values when the helper joins.
DEFAULT_FX = {
    "intensity": 0.85,
    "ambient": {"color": "#1d4a6e", "bri": 0.22, "transitionMs": 2500},
    "turn": {"mix": 0.6, "bri": 0.34, "transitionMs": 1200, "flickers": 2},
    "zombieTurnColor": "#5cff2e",
    "roll": {"flickers": 3, "dip": 0.3, "gapMs": 140, "lights": 3},
    "fight": {"color": "#ff1a1a", "bri": 0.7, "low": 0.22, "pulses": 3, "pulseMs": 850},
    "hit": {"color": "#ff0000", "bri": 1.0, "ms": 380, "flashes": 2, "gapMs": 260},
    "kill": {"color": "#fff3c4", "colors": ["#fff3c4", "#ffd23f", "#9dff6a"], "bri": 1.0, "ms": 650, "sparkle": 3},
    "charge": {"bri": 1.0, "ms": 350},
    "scream": {"color": "#ffffff", "bri": 0.9, "blinks": 2, "ms": 140},
    "pickup": {"bri": 0.8, "ms": 300},
    "helipad": {"color": "#ffc21a", "bri": 0.8, "ms": 1400},
    "gateNo": {"color": "#ff2020", "bri": 0.75, "ms": 500},
    "lunge": {"color": "#5cff2e", "dip": 0.35, "flickers": 2},
    "crunch": {"color": "#ff0000", "bri": 1.0, "holdMs": 1500, "fadeMs": 2500},
    "rise": {"color": "#5cff2e", "bri": 0.55, "ms": 1200},
    "escape": {"colors": ["#ffc21a", "#fff0b8", "#ffa200"], "bri": 1.0, "steps": 6, "stepMs": 500},
    "over": {"holdMs": 4000},
    "restoreTransitionMs": 1500,
    "disconnectRestoreMs": 30000,
    "rate": {"lightsPerSec": 8, "groupsPerSec": 1, "perLightMax": 6},
}


def deep_merge(base, extra):
    out = json.loads(json.dumps(base))
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


# ------------------------------------------------------------------ colour helpers
def hex_rgb(h):
    h = str(h or "#ffffff").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return (1.0, 1.0, 1.0)


def rgb_hex(rgb):
    return "#" + "".join("%02x" % max(0, min(255, round(c * 255))) for c in rgb)


def mix(a, b, t):
    ra, rb = hex_rgb(a), hex_rgb(b)
    return rgb_hex(tuple(ra[i] + (rb[i] - ra[i]) * t for i in range(3)))


def rgb_to_xy(rgb):
    def g(c):
        return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
    r, gg, b = (g(c) for c in rgb)
    X = r * 0.664511 + gg * 0.154324 + b * 0.162028
    Y = r * 0.283881 + gg * 0.668433 + b * 0.047685
    Z = r * 0.000088 + gg * 0.072310 + b * 0.986039
    s = X + Y + Z
    if s <= 0:
        return [0.3227, 0.329]
    return [round(X / s, 4), round(Y / s, 4)]


def hex_ct(h):
    """Rough colour temperature (mireds) for white-only lights: warm for red/gold, cool for blue."""
    r, g, b = hex_rgb(h)
    warm = (r + 0.3 * g) / (r + 0.3 * g + b + 1e-6)
    return int(max(153, min(500, 153 + warm * 347)))


def bri254(v):
    return int(max(1, min(254, round(254 * float(v)))))


# ------------------------------------------------------------------ bridge client
class Bridge:
    def __init__(self, ip, key=None, scheme="http", timeout=3.0):
        self.ip, self.key, self.scheme, self.timeout = ip, key, scheme, timeout
        self.ctx = ssl._create_unverified_context() if scheme == "https" else None  # bridge uses a self-signed cert

    def url(self, path):
        return "%s://%s/api%s" % (self.scheme, self.ip, path)

    def req(self, method, path, body=None, timeout=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.url(path), data=data, method=method, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(r, timeout=timeout or self.timeout, context=self.ctx) as resp:
            return json.loads(resp.read().decode("utf-8") or "null")

    def config(self):                       # unauthenticated, read-only
        return self.req("GET", "/config")

    def authed(self, method, path, body=None):
        if not self.key:
            raise RuntimeError("not paired")
        return self.req(method, "/%s%s" % (self.key, path), body)

    def groups(self):
        return self.authed("GET", "/groups")

    def lights(self):
        return self.authed("GET", "/lights")

    def put_light(self, lid, body):
        return self.authed("PUT", "/lights/%s/state" % lid, body)

    def put_group(self, gid, body):
        return self.authed("PUT", "/groups/%s/action" % gid, body)

    def pair_once(self, devicetype="zero_to_phi#lights_helper"):
        """One link attempt. Returns (key, None) on success or (None, error_description)."""
        res = self.req("POST", "", {"devicetype": devicetype})
        item = res[0] if isinstance(res, list) and res else {}
        if "success" in item:
            return item["success"].get("username"), None
        err = item.get("error", {})
        return None, err.get("description") or str(res)


# ------------------------------------------------------------------ rate-limited, coalescing sender
class Sender(threading.Thread):
    def __init__(self, bridge, lights_per_sec=8, groups_per_sec=1, log=None):
        super().__init__(daemon=True)
        self.bridge, self.log = bridge, log or (lambda *a: None)
        self.rates = {"l": float(lights_per_sec), "g": float(groups_per_sec)}
        self.next_ok = {"l": 0.0, "g": 0.0}
        self.pending, self.order = {}, []
        self.cv = threading.Condition()
        self.sent = 0
        self.errors = 0
        self.busy = False
        self.start()

    def set_rates(self, lights_per_sec, groups_per_sec):
        with self.cv:
            self.rates = {"l": max(0.5, float(lights_per_sec)), "g": max(0.2, float(groups_per_sec))}

    def submit(self, kind, target, body):
        key = (kind, str(target))
        with self.cv:
            if key in self.pending:
                self.pending[key].update(body)        # coalesce: newest values win
            else:
                self.pending[key] = dict(body)
                self.order.append(key)
            self.cv.notify()

    def clear(self):
        with self.cv:
            self.pending.clear()
            self.order.clear()

    def idle(self):
        with self.cv:
            return not self.order and not self.busy

    def flush(self, timeout=10.0):
        end = time.time() + timeout
        while time.time() < end:
            if self.idle():
                return True
            time.sleep(0.05)
        return False

    def run(self):
        while True:
            with self.cv:
                while not self.order:
                    self.cv.wait()
                now = time.monotonic()
                pick = None
                wait = 1.0
                for key in self.order:
                    t = self.next_ok[key[0]]
                    if t <= now:
                        pick = key
                        break
                    wait = min(wait, t - now)
                if pick is None:
                    self.cv.wait(max(0.005, wait))
                    continue
                self.order.remove(pick)
                body = self.pending.pop(pick)
                self.next_ok[pick[0]] = max(now, self.next_ok[pick[0]]) + 1.03 / self.rates[pick[0]]   # 3% safety margin
                self.busy = True
            try:
                if pick[0] == "l":
                    res = self.bridge.put_light(pick[1], body)
                else:
                    res = self.bridge.put_group(pick[1], body)
                self.sent += 1
                if isinstance(res, list) and any("error" in r for r in res):
                    errs = [r["error"].get("description") for r in res if "error" in r]
                    # "device is off" style errors are normal mid-effect; only log others
                    if not all("off" in (e or "") for e in errs):
                        self.log("bridge said: %s" % "; ".join(str(e) for e in errs))
            except Exception as e:  # network blip: drop this command, keep going
                self.errors += 1
                self.log("command failed (%s %s): %s" % (pick[0], pick[1], e))
            finally:
                with self.cv:
                    self.busy = False


# ------------------------------------------------------------------ game light engine
class Engine:
    """Turns game events ("turn", "roll", "fight", ...) into short, tasteful light changes.

    One worker thread runs everything (events + timed effect steps), so there are no races.
    The lights' pre-game state is snapshotted when a game starts and restored at the end."""

    def __init__(self, bridge, snapshot_path, log=None):
        self.bridge = bridge
        self.snapshot_path = snapshot_path
        self.log = log or (lambda *a: None)
        self.fx = deep_merge(DEFAULT_FX, {})
        self.sender = Sender(bridge, self.fx["rate"]["lightsPerSec"], self.fx["rate"]["groupsPerSec"], self.log) if bridge else None
        self.groups, self.lights = {}, {}
        self.enabled, self.selected = False, []
        self.snapshot, self.session = None, False
        self.base = (self.fx["ambient"]["color"], self.fx["ambient"]["bri"])
        self.fighting = False
        self.gen = 0
        self.busy_until = 0.0
        self.timers, self.seq = [], 0
        self.q = queue.Queue()
        self.last_event = ""
        self.restoring = False
        self.last_snapshot, self.restored_at = None, 0.0
        threading.Thread(target=self._loop, daemon=True).start()
        if os.path.exists(snapshot_path):
            try:
                with open(snapshot_path, "r", encoding="utf-8-sig") as f:
                    self.stale_snapshot = json.load(f)
            except Exception:
                self.stale_snapshot = None
        else:
            self.stale_snapshot = None

    # ---------------- worker
    def _loop(self):
        while True:
            timeout = None
            if self.timers:
                timeout = max(0.0, self.timers[0][0] - time.monotonic())
            try:
                fn = self.q.get(timeout=timeout)
                self._safe(fn)
            except queue.Empty:
                pass
            now = time.monotonic()
            while self.timers and self.timers[0][0] <= now:
                _, _, gen, fn = heapq.heappop(self.timers)
                if gen is None or gen == self.gen:
                    self._safe(fn)

    def _safe(self, fn):
        try:
            fn()
        except Exception as e:
            self.log("effect error: %r" % e)

    def call(self, fn):
        self.q.put(fn)

    def after(self, ms, fn, gen=True):
        self.seq += 1
        heapq.heappush(self.timers, (time.monotonic() + ms / 1000.0, self.seq, self.gen if gen else None, fn))
        self.q.put(lambda: None)  # wake the loop

    # ---------------- inventory
    def refresh(self):
        """Read rooms/zones and lights from the bridge (needs a key)."""
        g = self.bridge.groups()
        l = self.bridge.lights()
        if isinstance(g, list) or isinstance(l, list):   # error responses come back as lists
            raise RuntimeError(str(g if isinstance(g, list) else l)[:200])
        groups = {}
        for gid, gr in g.items():
            if gr.get("type") in ("Room", "Zone") and gr.get("lights"):
                groups[str(gid)] = {"id": str(gid), "name": gr.get("name", "Group " + gid), "type": gr.get("type"),
                                    "lights": [str(x) for x in gr.get("lights", [])], "cls": gr.get("class", "")}
        lights = {}
        for lid, li in l.items():
            st = li.get("state", {})
            caps = "color" if "xy" in st else ("ct" if "ct" in st else "dim")
            lights[str(lid)] = {"id": str(lid), "name": li.get("name"), "caps": caps, "reachable": st.get("reachable", True)}
        self.groups, self.lights = groups, lights
        return groups

    def sel_lights(self):
        ids = []
        for gid in self.selected:
            for lid in self.groups.get(gid, {}).get("lights", []):
                if lid not in ids and self.lights.get(lid, {}).get("reachable", True) and lid in self.lights:
                    ids.append(lid)
        return ids

    def per_light(self):
        return len(self.sel_lights()) <= int(self.fx["rate"]["perLightMax"])

    # ---------------- public API (thread-safe: everything is queued to the worker)
    def set_fx(self, fx):
        def f():
            self.fx = deep_merge(DEFAULT_FX, fx or {})
            if self.sender:
                self.sender.set_rates(self.fx["rate"]["lightsPerSec"], self.fx["rate"]["groupsPerSec"])
            if not self.session:
                self.base = (self.fx["ambient"]["color"], self.fx["ambient"]["bri"])
        self.call(f)

    def set_config(self, enabled, selected):
        selected = [str(s) for s in (selected or []) if str(s) in self.groups] if self.groups else [str(s) for s in (selected or [])]
        def f():
            changed = bool(enabled) != self.enabled or selected != self.selected
            if changed and self.session:
                self._restore("lights settings changed")
            self.enabled, self.selected = bool(enabled), selected
        self.call(f)

    def event(self, k, d=None):
        d = d or {}
        self.call(lambda: self._event(k, d))

    def test(self, gids):
        def f():
            for gid in [str(x) for x in gids or []][:4]:
                if gid in self.groups:
                    self.sender.submit("g", gid, {"alert": "select"})
            self.log("test flash: " + ", ".join(self.groups.get(str(g), {}).get("name", str(g)) for g in gids or []))
        self.call(f)

    def restore_now(self, reason="requested"):
        self.call(lambda: self._restore(reason))

    def restore_stale(self):
        def f():
            if self.stale_snapshot and not self.session:
                self.snapshot = self.stale_snapshot
                self.session = True
                self._restore("snapshot from an earlier run")
            self.stale_snapshot = None
        self.call(f)

    def shutdown_restore(self, timeout=4.0):
        """Called from the main thread at exit: restore synchronously (best effort)."""
        done = threading.Event()
        offs = []
        def f():
            offs.extend(self._restore("helper closing", immediate=True))
            done.set()
        self.call(f)
        done.wait(timeout)
        if self.sender:
            self.sender.flush(timeout)
            for lid in offs:                     # lights that were off before the game: switch off now
                self.sender.submit("l", lid, {"on": False})
            self.sender.flush(1.5)

    def status(self):
        return {"enabled": self.enabled, "selected": self.selected, "session": self.session,
                "lights": len(self.sel_lights()), "mode": "per-light" if self.selected and self.per_light() else "group",
                "lastEvent": self.last_event, "staleSnapshot": bool(self.stale_snapshot),
                "sent": self.sender.sent if self.sender else 0, "errors": self.sender.errors if self.sender else 0}

    # ---------------- internals (worker thread only)
    def active(self):
        return self.enabled and self.selected and self.sender is not None

    def _states(self, color, bri):
        xy, ct, b = rgb_to_xy(hex_rgb(color)), hex_ct(color), bri254(bri)
        return xy, ct, b

    def apply(self, color, bri, tt_ms=0, only=None):
        """Set every selected light to one look. Per-light when few lights, room/zone commands otherwise."""
        xy, ct, b = self._states(color, bri)
        tt = int(max(0, round(tt_ms / 100.0)))
        if only is not None or self.per_light():
            for lid in (only if only is not None else self.sel_lights()):
                caps = self.lights.get(lid, {}).get("caps", "dim")
                body = {"on": True, "bri": b, "transitiontime": tt}
                if caps == "color":
                    body["xy"] = xy
                elif caps == "ct":
                    body["ct"] = ct
                self.sender.submit("l", lid, body)
        else:
            for gid in self.selected:
                self.sender.submit("g", gid, {"on": True, "bri": b, "xy": xy, "ct": ct, "transitiontime": tt})

    def to_base(self, tt_ms=600):
        c, b = self.base
        if self.fighting:
            c, b = self.fx["fight"]["color"], self.fx["fight"]["low"] * self.fx["intensity"]
        self.apply(c, b, tt_ms)

    def flicker(self, n, dip, gap_ms, count, start_ms=0):
        """Quick brightness dips on a few random lights (group mode: a single 'select' blink)."""
        c, b = self.base
        if self.fighting:
            c, b = self.fx["fight"]["color"], self.fx["fight"]["low"] * self.fx["intensity"]
        if not self.per_light():
            if self.selected:
                self.after(start_ms, lambda: self.sender.submit("g", self.selected[0], {"alert": "select"}))
            return
        lights = self.sel_lights()
        for i in range(int(n)):
            pick = random.sample(lights, min(len(lights), int(count))) if lights else []
            t = start_ms + i * gap_ms * 2
            self.after(t, lambda p=pick: self.apply(c, max(0.02, b * dip), 0, only=p))
            self.after(t + gap_ms, lambda p=pick: self.apply(c, b, 1, only=p))

    def transient(self, ms):
        self.gen += 1
        self.busy_until = max(self.busy_until, time.monotonic() + ms / 1000.0)

    def _event(self, k, d):
        self.last_event = k
        if k == "end":
            if self.session:
                self._restore(d.get("reason") or "game ended")
            return
        if not self.active():
            return
        fx, I = self.fx, float(self.fx["intensity"])
        if k == "start":
            self.gen += 1
            self.fighting = False
            if not self.session:
                if self.last_snapshot and time.monotonic() - self.restored_at < self.fx["restoreTransitionMs"] / 1000.0 + 4:
                    self.snapshot = self.last_snapshot      # lights are still gliding back: reuse the true pre-game state
                else:
                    self._snapshot()
            self.session = True
            self.restoring = False
            self.base = (fx["ambient"]["color"], fx["ambient"]["bri"])
            self.apply(fx["ambient"]["color"], fx["ambient"]["bri"], fx["ambient"]["transitionMs"])
            return
        if not self.session:
            return
        if k == "turn":
            col = fx["zombieTurnColor"] if d.get("zombie") else d.get("color", "#ffffff")
            self.base = (mix(fx["ambient"]["color"], col, fx["turn"]["mix"]), fx["turn"]["bri"])
            self.fighting = False
            self.gen += 1
            self.to_base(fx["turn"]["transitionMs"])
            if fx["turn"].get("flickers"):
                self.flicker(fx["turn"]["flickers"], 0.45, 120, 2, start_ms=fx["turn"]["transitionMs"] + 150)
        elif k == "roll":
            r = fx["roll"]
            self.flicker(r["flickers"], r["dip"], r["gapMs"], r["lights"])
        elif k in ("fight", "fightRoll"):
            f = fx["fight"]
            pulses = f["pulses"] if k == "fight" else 1
            style = d.get("style") if k == "fight" else None
            ch, sc = fx.get("charge") or {}, fx.get("scream") or {}
            n, ms = int(sc.get("blinks", 2)), int(sc.get("ms", 140))
            lead = int(ch.get("ms", 350)) if style == "charge" else (n * ms * 2 if self.per_light() else ms * 2) if style == "scream" else 0
            self.transient(lead + pulses * f["pulseMs"])      # bumps gen: schedule timers after this
            if style == "charge":                   # war cry: a flash of the fighter's own colour first
                self.apply(d.get("color") or "#ffffff", ch.get("bri", 1.0) * I, 0)
            elif style == "scream":                 # cornered: quick white blinks
                if self.per_light():
                    for i in range(n):
                        self.after(i * ms * 2, lambda: self.apply(sc.get("color", "#ffffff"), sc.get("bri", 0.9) * I, 0))
                        self.after(i * ms * 2 + ms, lambda: self.apply(f["color"], f["low"] * I, 0))
                else:
                    self.apply(sc.get("color", "#ffffff"), sc.get("bri", 0.9) * I, 0)
            self.fighting = True
            if self.per_light():
                for i in range(int(pulses)):
                    t = lead + i * f["pulseMs"]
                    self.after(t, lambda: self.apply(f["color"], f["bri"] * I, f["pulseMs"] * 0.3))
                    self.after(t + f["pulseMs"] * 0.5, lambda: self.apply(f["color"], f["low"] * I, f["pulseMs"] * 0.45))
            elif k == "fight":
                def red():
                    self.apply(f["color"], f["low"] * I, 300)
                    for gid in self.selected:
                        self.sender.submit("g", gid, {"alert": "lselect"})
                if lead:
                    self.after(lead, red)
                else:
                    red()
        elif k == "fightResult":
            was = self.fighting
            self.fighting = False
            if not self.per_light() and was:
                for gid in self.selected:
                    self.sender.submit("g", gid, {"alert": "none"})
            if d.get("lost"):                       # hard red flash (double flash when there are few lights)
                h = fx["hit"]
                n = int(h.get("flashes", 1)) if self.per_light() else 1
                gap = int(h.get("gapMs", 260))
                self.transient(h["ms"] + (n - 1) * (h["ms"] + gap) + 300)
                for i in range(n):
                    t = i * (h["ms"] + gap)
                    self.after(t, lambda: self.apply(h["color"], h["bri"] * I, 0))
                    if i < n - 1:
                        self.after(t + h["ms"], lambda: self.apply(h["color"], 0.08, 0))
                self.after((n - 1) * (h["ms"] + gap) + h["ms"], lambda: self.to_base(800))
            elif d.get("zdead"):                    # bright burst, then a few lights sparkle in party colours
                kk = fx["kill"]
                cols = kk.get("colors") or [kk["color"]]
                sp = int(kk.get("sparkle", 0)) if self.per_light() else 0
                self.transient(kk["ms"] + sp * 220 + 300)
                self.apply(kk["color"], kk["bri"] * I, 0)
                lights = self.sel_lights()
                for i in range(sp):
                    pick = random.sample(lights, min(len(lights), 2)) if lights else []
                    self.after(kk["ms"] * 0.5 + i * 220, lambda p=pick, c=cols[(i + 1) % len(cols)]: self.apply(c, kk["bri"] * I, 0, only=p))
                self.after(kk["ms"] + sp * 220, lambda: self.to_base(700))
            else:
                self.gen += 1
                self.to_base(700)
        elif k == "crunch":
            c = fx["crunch"]
            self.fighting = False
            self.transient(c["holdMs"] + c["fadeMs"])
            self.apply(c["color"], c["bri"] * I, 0)
            self.after(c["holdMs"], lambda: self.to_base(c["fadeMs"]))
        elif k == "rise":
            r = fx["rise"]
            self.transient(r["ms"] + 600)
            self.apply(r["color"], r["bri"] * I, 300)
            self.after(r["ms"], lambda: self.to_base(900))
        elif k == "escape":
            e = fx["escape"]
            cols = e["colors"] or ["#ffc21a"]
            self.fighting = False
            self.transient(e["steps"] * e["stepMs"] + 1500)
            for i in range(int(e["steps"])):
                bri = e["bri"] * I * (1.0 if i % 2 == 0 else 0.55)
                self.after(i * e["stepMs"], lambda c=cols[i % len(cols)], b=bri: self.apply(c, b, e["stepMs"] * 0.6))
            self.after(e["steps"] * e["stepMs"], lambda: self.to_base(1500))
        elif k == "pickup":                         # one light sparkles in the item's colour (per-light mode only)
            pk = fx.get("pickup") or {}
            lights = self.sel_lights()
            if self.per_light() and lights and time.monotonic() >= self.busy_until:
                one = [random.choice(lights)]
                c, b = self.base
                self.apply(d.get("color") or "#ffd65a", pk.get("bri", 0.8) * I, 0, only=one)
                self.after(pk.get("ms", 300), lambda: self.apply(c, b, 3, only=one))
        elif k == "helipad":
            hp = fx.get("helipad") or {}
            self.transient(hp.get("ms", 1400) + 600)
            self.apply(hp.get("color", "#ffc21a"), hp.get("bri", 0.8) * I, 400)
            self.after(hp.get("ms", 1400), lambda: self.to_base(900))
        elif k == "gateNo":
            gn = fx.get("gateNo") or {}
            self.transient(gn.get("ms", 500) + 400)
            self.apply(gn.get("color", "#ff2020"), gn.get("bri", 0.75) * I, 0)
            self.after(gn.get("ms", 500), lambda: self.to_base(600))
        elif k == "lunge":                          # zombies lurch: green-tinted dips on a few lights (skipped in room mode)
            lu = fx.get("lunge") or {}
            if self.per_light() and time.monotonic() >= self.busy_until:
                self.flicker(lu.get("flickers", 2), lu.get("dip", 0.35), 150, 2)
        elif k == "over":
            o = fx["over"]
            wait = max(0.0, (self.busy_until - time.monotonic()) * 1000.0)
            g0 = self.gen
            esc = d.get("escaped")
            def final():
                if self.gen != g0 or not self.session:
                    return
                if esc:
                    self.apply(fx["escape"]["colors"][0], 0.6 * I, 1200)
                else:
                    self.apply(fx["crunch"]["color"], 0.3 * I, 1200)
            def done():
                if self.gen == g0 and self.session:
                    self._restore("game over")
            self.after(wait, final, gen=False)
            self.after(wait + o["holdMs"], done, gen=False)

    def _snapshot(self):
        lights = self.bridge.lights()
        snap = {}
        for lid in self.sel_lights():
            st = lights.get(lid, {}).get("state", {})
            s = {"on": bool(st.get("on"))}
            if "bri" in st:
                s["bri"] = st["bri"]
            mode = st.get("colormode")
            if mode == "xy" and "xy" in st:
                s["xy"] = st["xy"]
            elif mode == "ct" and "ct" in st:
                s["ct"] = st["ct"]
            elif mode == "hs" and "hue" in st:
                s["hue"], s["sat"] = st["hue"], st.get("sat", 0)
            snap[lid] = s
        self.snapshot = snap
        try:
            with open(self.snapshot_path, "w", encoding="utf-8") as f:
                json.dump(snap, f)
        except Exception as e:
            self.log("could not save snapshot: %r" % e)
        self.log("saved the current state of %d light(s) so it can be restored after the game" % len(snap))

    def _restore(self, reason, immediate=False):
        """Put every snapshotted light back. Lights that were off get their colour back first, then
        switch off (after the transition, or right away when the helper is closing: immediate=True)."""
        self.gen += 1
        self.fighting = False
        if not self.session or not self.snapshot:
            self.session = False
            return []
        self.sender.clear()                      # drop any queued effect steps
        tt = 0 if immediate else int(round(self.fx["restoreTransitionMs"] / 100.0))
        if not self.per_light():
            for gid in self.selected:
                self.sender.submit("g", gid, {"alert": "none"})
        offs = []
        for lid, s in self.snapshot.items():
            body = {k: v for k, v in s.items() if k != "on"}
            body["transitiontime"] = tt
            if s.get("on"):
                body["on"] = True
            else:
                offs.append(lid)
            self.sender.submit("l", lid, body)
        snap_ids = list(self.snapshot.keys())
        def switch_off():
            if self.session:                     # a new game already started: leave the lights alone
                return
            for lid in offs:
                self.sender.submit("l", lid, {"on": False, "transitiontime": 4})
        if offs and not immediate:
            self.after(self.fx["restoreTransitionMs"] + 300, switch_off, gen=False)
        self.session = False
        self.last_snapshot, self.restored_at = self.snapshot, time.monotonic()
        self.snapshot = None
        self.restoring = True
        try:
            os.remove(self.snapshot_path)
        except OSError:
            pass
        self.log("restoring %d light(s) to how they were (%s)" % (len(snap_ids), reason))
        return offs
