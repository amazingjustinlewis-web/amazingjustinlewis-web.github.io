/* ztp-room v01 (dev) - shared "scan the screen with your phone" join + optional room-light cues for Zero to Phi games.
   Factored from Cave Cinema v04 (cinema/index_v04.html + asus helper v02). Cave Cinema v04 itself is untouched.

   PHONE JOIN (needs minikit kit.js + net.js + qrcode.js loaded first)
     ZTPRoom.fixedRoom(code)   call BEFORE Kit.host(): the screen always opens the same room code, so a phone shortcut
                               saved from the QR keeps working. ?room=XXXX overrides. If the old id is still held ("code taken")
                               it retries every 4 s until it frees up.
     ZTPRoom.padUrl(h, o)      the phone link: <base><o.pad>?<o.param>=CODE<o.query>[&local=1]
                               o.pad 'pad.html', o.param 'table' (the phone page maps ?table= to ?room=), o.query e.g. '&g=cinema',
                               o.publicBase: used instead of this page's folder when the page is served from a helper port
                               (o.publicPorts, default ['8093']) so phones always get the public https link.
     ZTPRoom.qr(h, el, o)      waits until the host is online (or ?local=1), draws the QR (svg) into el, the code into o.codeEl,
                               sets window[o.global] = url if given, calls o.onUrl(url). o.margin (default 2), o.cellSize (4).

   ROOM LIGHTS (optional; nothing happens until the player says yes)
     Lights are driven by the small helper that runs on the screen PC (Cave Cinema helper, default http://127.0.0.1:8094,
     talks to Home Assistant). The browser never holds any light credentials.
     ZTPLights.menu(o)         tiny bulb button (bottom-left by default, o.corner 'bl'|'br'|'tl'|'tr', o.x/o.y px nudge) that unfolds into:
                               "Use my smart lights for big moments?" Yes / No -> then pick which lights (zone) the helper reports.
                               A deeper "Advanced" layer holds the helper address and a Test button.
     ZTPLights.cue(name, o)    'moment'  short dip and return for a big game moment (needs helper v03 /lights/cue).
                                         o.dip (default .2 = 20%), o.holdMs (1200), o.k (label, e.g. 'goal').
                               'movie'|'pause'|'resume'|'stop'  the Cave Cinema movie cue (instant ~20% dip, then a slow
                                         ease-out fade to dark over ~3 minutes; soft warm intermission light; fade back down).
                               Only fires when the player turned lights on. Never throws; resolves false if it did nothing.
     ZTPLights.post(act, body, base)  low level: POST <base>/lights/<act>, ignoring player settings (Cave Cinema uses this with
                               its own on/off toggle so its behaviour stays exactly as v04).
     ZTPLights.curve(tSec, o)  brightness factor 0..1 for the movie cue at t seconds (same maths as the helper: 0.8 after the
                               1.5 s dip, then 0.8*(1-k)^1.8 over o.fadeS=180 s). Handy for mirroring the cue on screen.
     ZTPLights.status()        -> Promise of the helper's /lights/status (or null).
     ZTPLights.settings()      -> { on, lights:[...], base }  stored on this device (localStorage 'ztp:lights').
     ?lights=0 disables lights for the page; ?lightsdebug=1 shows a small on-screen note for every cue (for testing). */
(function (root) {
  'use strict';
  var Q = new URLSearchParams(location.search), D = document;

  // ---------------------------------------------------------------- phone join
  var ZTPRoom = {
    fixedRoom: function (code) {
      var N = root.LSNet; if (!N || !N.Host || N.Host.__fixed) return false;
      var Base = N.Host, FIX = ((Q.get('room')) || code).toUpperCase();
      function H(o) { var self = this, os = o.onStatus; o.code = FIX; o.fixedCode = true;
        o.onStatus = function (s, c, d) { if (os) os(s, c, d); if (s === 'offline' && d === 'code taken') { clearTimeout(self.__rt); self.__rt = setTimeout(function () { self.tries = 0; self.setStatus('reconnecting', 'waiting for old id'); self.open(); }, 4000); } };
        Base.call(this, o); }
      H.prototype = Base.prototype; H.__fixed = true; N.Host = H; return true;
    },
    padUrl: function (h, o) { o = o || {};
      var ports = o.publicPorts || ['8093'], base = (o.publicBase && ports.indexOf(location.port) >= 0) ? o.publicBase : location.href.replace(/[^/]*([?#].*)?$/, '');
      return base + (o.pad || 'pad.html') + '?' + (o.param || 'table') + '=' + h.code + (o.query || '') + (/local=1/.test(location.search) ? '&local=1' : '');
    },
    qr: function (h, el, o) { o = o || {};
      (function wait() {
        if (!h.code || (h.status && h.status !== 'online' && !/local=1/.test(location.search))) return setTimeout(wait, 400);
        var u = ZTPRoom.padUrl(h, o), q = root.qrcode(0, o.ecc || 'M'); q.addData(u); q.make();
        if (el) el.innerHTML = q.createSvgTag({ cellSize: o.cellSize || 4, margin: o.margin == null ? 2 : o.margin, scalable: true });
        if (o.codeEl) o.codeEl.textContent = h.code;
        if (o.global) root[o.global] = u;
        if (o.onUrl) o.onUrl(u);
      })();
    }
  };

  // ---------------------------------------------------------------- room lights
  var KEY = 'ztp:lights', DEF_BASE = 'http://127.0.0.1:8094', OFF = Q.get('lights') === '0', DBG = Q.get('lightsdebug') === '1';
  function load() { var s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} s = s || {}; return { on: !!s.on, lights: s.lights || [], base: s.base || '' }; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function baseOf(s) { return (Q.get('lightsapi') || (s && s.base) || DEF_BASE).replace(/\/$/, ''); }
  function note(t) { if (!DBG) return; var n = D.getElementById('ztpLtDbg'); if (!n) { n = D.createElement('div'); n.id = 'ztpLtDbg'; n.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483001;background:#000c;color:#ffe7a0;font:600 13px system-ui;padding:6px 12px;border-radius:999px;pointer-events:none;transition:opacity .4s'; D.body.appendChild(n); }
    n.textContent = '\uD83D\uDCA1 ' + t; n.style.opacity = 1; clearTimeout(n._t); n._t = setTimeout(function () { n.style.opacity = 0; }, 2200); }
  function post(act, body, base) {
    return fetch((base || baseOf(load())) + '/lights/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  var MOVIE = { movie: 'start', start: 'start', pause: 'pause', resume: 'resume', stop: 'stop' }, lastMoment = 0;
  var ZTPLights = {
    settings: load,
    post: post,
    curve: function (t, o) { o = o || {}; var dip = o.dip == null ? .2 : o.dip, dipS = o.dipS || 1.5, T = o.fadeS || 180, top = 1 - dip;
      if (t <= 0) return 1; if (t < dipS) return 1 - dip * (t / dipS); var k = Math.min(1, (t - dipS) / T); return top * Math.pow(1 - k, o.ease || 1.8); },
    status: function (base) { var c = typeof AbortController === 'function' ? new AbortController() : null, tm = c && setTimeout(function () { c.abort(); }, 2500);
      return fetch((base || baseOf(load())) + '/lights/status', { cache: 'no-store', signal: c ? c.signal : undefined }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (x) { clearTimeout(tm); return x; }); },
    cue: function (name, o) { o = o || {}; var s = load();
      if (OFF || !s.on) return Promise.resolve(false);
      var act = MOVIE[name], body = { lights: s.lights.length ? s.lights : undefined };
      if (!act) { var now = Date.now(); if (now - lastMoment < (o.gapMs || 2500)) return Promise.resolve(false); lastMoment = now;   // never strobe
        act = 'cue'; body.k = o.k || name; body.dip = Math.max(0, Math.min(.6, o.dip == null ? .2 : o.dip)); body.hold = Math.max(.2, Math.min(5, (o.holdMs || 1200) / 1000)); }
      note(name + (body.k && body.k !== name ? ' (' + body.k + ')' : ''));
      return post(act, body, baseOf(s)).then(function (r) { return !!(r && r.ok); }).catch(function () { return false; });
    },
    menu: function (o) { o = o || {}; if (OFF || D.getElementById('ztpLt')) return; var mk = function () { build(o); }; if (D.body) mk(); else addEventListener('DOMContentLoaded', mk); }
  };
  function nice(id) { return String(id).replace(/^light\./, '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function build(o) {
    var c = o.corner || 'bl', v = c[0] === 't' ? 'top' : 'bottom', hz = c[1] === 'r' ? 'right' : 'left';
    var oy = (o.y || 0) + 10, ox = (o.x || 0) + 10;   // o.x / o.y nudge the bulb away from a game's own corner buttons
    var css = '#ztpLt{position:fixed;' + v + ':max(' + oy + 'px,env(safe-area-inset-' + v + '));' + hz + ':max(' + ox + 'px,env(safe-area-inset-' + hz + '));z-index:2147482999;font:500 14px/1.35 system-ui,sans-serif;color:#eee}' +
      '#ztpLt>button{width:34px;height:34px;border-radius:50%;border:1px solid #ffd23f66;background:#000a;color:#ffe7a0;font-size:16px;cursor:pointer;opacity:.4;transition:opacity .2s}#ztpLt>button:hover,#ztpLt.open>button{opacity:1}' +
      '#ztpLt .p{display:none;position:absolute;' + (v === 'top' ? 'top' : 'bottom') + ':42px;' + hz + ':0;width:250px;background:#0d0d14f2;border:1px solid #ffd23f44;border-radius:14px;padding:12px 14px;box-shadow:0 8px 30px #000a}#ztpLt.open .p{display:block}' +
      '#ztpLt h4{margin:0 0 8px;font-size:14px;color:#ffe7a0;font-weight:600}#ztpLt .row{display:flex;gap:8px;margin:6px 0}#ztpLt .row button,#ztpLt .adv button{flex:1;border:1px solid #ffffff2a;background:#ffffff12;color:#fff;border-radius:9px;padding:7px;cursor:pointer;font:inherit}' +
      '#ztpLt .row button.on{background:#ffd23f;color:#111;border-color:#ffd23f}#ztpLt label{display:flex;gap:8px;align-items:center;margin:4px 0;cursor:pointer}#ztpLt small{color:#9a9aa8;display:block;margin-top:6px}' +
      '#ztpLt details{margin-top:8px}#ztpLt summary{cursor:pointer;color:#9a9aa8;font-size:12px}#ztpLt input[type=text]{width:100%;box-sizing:border-box;background:#000;color:#fff;border:1px solid #ffffff2a;border-radius:7px;padding:5px 7px;font:12px ui-monospace,monospace;margin:6px 0}';
    var st = D.createElement('style'); st.textContent = css; D.head.appendChild(st);
    var w = D.createElement('div'); w.id = 'ztpLt'; w.innerHTML = '<button title="Room lights" aria-label="Room lights">\uD83D\uDCA1</button><div class="p"></div>'; D.body.appendChild(w);
    var P = w.querySelector('.p'), S = load(), info;   // undefined = still looking, null = no helper answered
    w.firstChild.onclick = function (e) { e.stopPropagation(); if (w.classList.toggle('open')) { info = undefined; paint(); ZTPLights.status(baseOf(S)).then(function (x) { info = x; paint(); }); } };
    D.addEventListener('pointerdown', function (e) { if (!w.contains(e.target)) w.classList.remove('open'); }, true);
    w.addEventListener('keydown', function (e) { e.stopPropagation(); });   // typing in the panel never drives the game
    function el(tag, txt) { var n = D.createElement(tag); if (txt != null) n.textContent = txt; return n; }
    function paint() {
      P.innerHTML = ''; P.appendChild(el('h4', 'Room lights' + (o.game ? ' \u00B7 ' + o.game : '')));
      P.appendChild(el('div', 'Use my smart lights for big moments?'));
      var r = el('div'); r.className = 'row'; var y = el('button', 'Yes'), n = el('button', 'No'); y.className = S.on ? 'on' : ''; n.className = S.on ? '' : 'on';
      y.onclick = function () { S.on = true; save(S); paint(); }; n.onclick = function () { S.on = false; save(S); paint(); }; r.appendChild(y); r.appendChild(n); P.appendChild(r);
      if (S.on) {
        if (info === undefined) P.appendChild(el('small', 'Looking for the lights helper on this PC\u2026'));
        else if (!info) P.appendChild(el('small', 'Lights helper not found on this PC, so nothing will change in the room. (Advanced has its address.)'));
        else if (info.lights && info.lights.length) {
          P.appendChild(el('div', 'Which lights?'));
          info.lights.forEach(function (id) { var lb = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !S.lights.length || S.lights.indexOf(id) >= 0;
            cb.onchange = function () { var all = [].map.call(P.querySelectorAll('label input'), function (x, i) { return x.checked ? info.lights[i] : null; }).filter(Boolean); S.lights = all.length === info.lights.length ? [] : all; save(S); };
            lb.appendChild(cb); lb.appendChild(el('span', nice(id))); P.appendChild(lb); });
          if (!info.cue) P.appendChild(el('small', 'This helper does movie cues only. Game-moment dips need helper v03.'));
        }
      }
      var d = el('details'), sm = el('summary', 'Advanced'); d.appendChild(sm);
      var inp = el('input'); inp.type = 'text'; inp.value = baseOf(S); inp.onchange = function () { S.base = inp.value.trim() === DEF_BASE ? '' : inp.value.trim(); save(S); info = undefined; paint(); ZTPLights.status(baseOf(S)).then(function (x) { info = x; paint(); }); };
      var a = el('div'); a.className = 'adv'; var t = el('button', 'Test a dip'); t.onclick = function () { var was = S.on; S.on = true; save(S); ZTPLights.cue('moment', { k: 'test', gapMs: 0 }).then(function (ok) { S.on = was; save(S); t.textContent = ok ? 'Dipped \u2713' : 'No answer'; setTimeout(function () { t.textContent = 'Test a dip'; }, 2000); }); };
      a.appendChild(t); d.appendChild(el('small', 'Lights helper address')); d.appendChild(inp); d.appendChild(a); P.appendChild(d);
    }
  }
  root.ZTPRoom = ZTPRoom; root.ZTPLights = ZTPLights;
})(window);
