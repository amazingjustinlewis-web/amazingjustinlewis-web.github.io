/* Zero to Phi: the breathing hidden QR (shared by the root TV page and business screens).
   envelope: dome 1.02*sin(pi*t/8)^0.35 windowed by a smootherstep, ~25% of each 8 s cycle rests in black.
   session: while someone is signed in on this screen (localStorage[key] = start time; ?session=1/0 or the L key to test),
   the QR stops breathing and drifts into the void over ~25 s; on sign-out it fades back in and breathes again. */
(function (root) {
  'use strict';
  function envelope(T) { var u = ((T % 8) + 8) % 8, d = Math.min(u, 8 - u), t = Math.max(0, Math.min(1, (d - 0.9) / 0.5)), w = t * t * t * (t * (6 * t - 15) + 10);
    return 1.02 * Math.pow(Math.sin(Math.PI * u / 8), 0.35) * w; }
  root.ZeroQR = function (o) {
    o = o || {}; var KEY = o.key || 'ztp-tv-session', DRIFT = o.drift || 25, q = new URLSearchParams(location.search);
    if (q.has('session')) { if (q.get('session') === '1') localStorage.setItem(KEY, String(Date.now() - 1000 * (+q.get('drift') || 0))); else localStorage.removeItem(KEY); }
    var forced = null, fStart = 0, fDrift = DRIFT;
    function on() { return forced != null ? forced : !!localStorage.getItem(KEY); }
    function start() { return forced != null ? fStart : (+localStorage.getItem(KEY) || Date.now()); }
    // pairing: a phone took over this screen -> sink quickly; null hands control back to the stored session flag
    function setForced(v, drift) { if (v && forced !== true) fStart = Date.now(); forced = v; fDrift = drift || DRIFT; }
    function toggle() { if (on()) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(Date.now())); }
    addEventListener('keydown', function (e) { if (e.key === 'l' || e.key === 'L') toggle(); });
    var v = 1, frozen = null, last = null;
    function frame(T) {
      if (o.still) return { level: 1, scale: 1, session: false };
      var now = performance.now() / 1000, dt = last == null ? 0 : Math.max(0, Math.min(0.1, now - last)); last = now;
      var s = on(), base;
      if (s) { var el = (Date.now() - start()) / 1000, dr = forced != null ? fDrift : DRIFT; if (frozen == null) frozen = envelope(T) || 0.6;
        v = Math.min(v, Math.max(0, 1 - el / dr)); base = frozen; }
      else { frozen = null; v = Math.min(1, v + dt / 2.5); base = envelope(T); }
      var e = v * v * (3 - 2 * v), lv = base * e;
      return { level: lv, scale: (0.9 + 0.1 * Math.min(1, base)) * (0.55 + 0.45 * e), session: s };
    }
    return { frame: frame, envelope: envelope, toggle: toggle, on: on, setForced: setForced };
  };
})(window);
