/* 0-Phi generic phone gamepad - TV-side helper (dev, v01).
   Drop into any keyboard game:  <script src="../dev-7q3x/gpad/gpad_v01.js"></script>  then  GPad.host({ ... })
   Phones open gpad/pad_v01.html?room=CODE (stick + A + B). Their input arrives here and is replayed as
   keyboard events on document (bubbles to window), so keyboard games need no other change.
   Default keys: seat 1 = arrows + A:Space B:Enter,  seat 2 = WASD + A:ShiftLeft B:KeyE,  seats 3-4 = onInput only.
   Options: { max:4, map:[{up,down,left,right,a,b},...], dead:.45, onInput(seat, st, p), onJoin(p), onLeave(p), qr:true|false }
   ?local=1 uses BroadcastChannel (same-browser tests); ?room=ABCD fixes the room (the TV door passes one). */
(function (root) {
  'use strict';
  var me = document.currentScript && document.currentScript.src || '';
  var BASE = me.replace(/[^/]*([?#].*)?$/, ''), KIT = BASE + '../minikit/';
  var Q = new URLSearchParams(location.search), LOCAL = Q.get('local') === '1';
  var PREFIX = 'ztp-mini-gpad-v1-';
  var KEYS = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Space: ' ', Enter: 'Enter',
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyQ: 'q', KeyF: 'f', ShiftLeft: 'Shift', NumpadEnter: 'Enter' };
  var KC = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, Enter: 13, NumpadEnter: 13, KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyQ: 81, KeyF: 70, ShiftLeft: 16 };
  var DEFMAP = [{ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Space', b: 'Enter' },
                { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'ShiftLeft', b: 'KeyE' }];
  function load(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
  function key(type, code) {
    if (!code) return;
    var ev = new KeyboardEvent(type, { code: code, key: KEYS[code] || code, keyCode: KC[code] || 0, which: KC[code] || 0, bubbles: true, cancelable: true });
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return KC[code] || 0; } }); Object.defineProperty(ev, 'which', { get: function () { return KC[code] || 0; } }); } catch (e) {}
    ev.gpad = true; (document.activeElement && document.activeElement !== document.body ? document.activeElement : document).dispatchEvent(ev);
  }
  var GPad = { ready: false, players: [], key: key, base: BASE };
  GPad.host = function (o) {
    o = o || {}; var map = o.map || DEFMAP, dead = o.dead || 0.45, h = GPad.h = { players: GPad.players, code: '', status: 'connecting' };
    function padUrl() { return BASE + 'pad_v01.html?room=' + h.code + (LOCAL ? '&local=1' : ''); }
    h.padUrl = padUrl;
    // ---- corner join box (hidden inside the TV door, which shows its own pairing QR)
    var framed = false; try { framed = root.parent && root.parent !== root; } catch (e) { framed = true; }
    var box = null;
    if (o.qr !== false && (!framed || Q.get('gqr') === '1')) {
      box = document.createElement('div'); box.id = 'gpadjoin';
      box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99999;width:118px;background:#000a;color:#fff;border-radius:12px;padding:7px;font:12px system-ui,sans-serif;text-align:center';
      document.body.appendChild(box);
    }
    function paint() {
      if (!box) return;
      var n = h.players.filter(function (p) { return p.on; }).length;
      if (h.status !== 'online') { box.innerHTML = 'phone pad: ' + h.status + '\u2026'; return; }
      var svg = ''; try { var q = root.qrcode(0, 'M'); q.addData(padUrl()); q.make(); svg = q.createSvgTag({ cellSize: 3, margin: 1, scalable: true }); } catch (e) {}
      box.innerHTML = '<div style="background:#fff;border-radius:8px;padding:3px;line-height:0">' + svg + '</div><div style="font-weight:700;letter-spacing:.2em;font-size:16px;margin-top:3px">' + h.code + '</div><div>' + (n ? n + ' pad' + (n > 1 ? 's' : '') : 'scan for a phone pad') + '</div>';
      box.querySelector('svg') && (box.querySelector('svg').style.cssText = 'width:100%;height:auto');
    }
    function release(p) { var m = map[p.seat]; if (!m || !p.st) return; ['up', 'down', 'left', 'right', 'a', 'b'].forEach(function (k) { if (p.held[k]) { p.held[k] = 0; key('keyup', m[k]); } }); }
    function apply(p, st) {
      p.st = st; var m = map[p.seat];
      if (m) {
        var want = { up: st.y < -dead, down: st.y > dead, left: st.x < -dead, right: st.x > dead, a: !!st.a, b: !!st.b };
        for (var k in want) if (!!p.held[k] !== want[k]) { p.held[k] = want[k] ? 1 : 0; key(want[k] ? 'keydown' : 'keyup', m[k]); }
      }
      if (o.onInput) o.onInput(p.seat, st, p);
    }
    function byConn(c) { return h.players.filter(function (p) { return p.conn === c; })[0]; }
    function start() {
      if (!root.LS_CONFIG) root.LS_CONFIG = { peerPrefix: PREFIX, iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
      var mk = LOCAL ? root.LSNet.LocalHost : root.LSNet.Host, room = (Q.get('room') || '').toUpperCase();
      h.net = new mk({ prefix: PREFIX, code: /^[A-Z]{4}$/.test(room) ? room : undefined,
        onStatus: function (s, code) { h.status = s; if (code) h.code = code; paint(); },
        onMessage: function (conn, d) {
          if (!d || d.t === 'ping' || d.t === 'hi2') return;
          if (d.t === 'pq') return;
          if (d.t === 'hi') {
            var p = h.players.filter(function (x) { return x.tok === d.tok; })[0];
            if (!p) { if (h.players.length >= (o.max || 4)) { try { conn.send({ t: 'full' }); } catch (e) {} return; } p = { tok: d.tok, seat: h.players.length, held: {} }; h.players.push(p); }
            p.conn = conn; p.on = true; p.name = (d.name || 'Player').slice(0, 12);
            var m = map[p.seat] || {};
            try { conn.send({ t: 'you', seat: p.seat, name: p.name, color: ['#ff5a6e', '#3aa8ff', '#5fdc7a', '#ffc93f'][p.seat % 4], keys: m, label: o.label || document.title, help: (o.help || [])[p.seat] || o.help0 || '' }); } catch (e) {}
            if (o.onJoin) o.onJoin(p); paint(); return;
          }
          var q = byConn(conn); if (!q) return;
          if (d.t === 'in') apply(q, { x: Math.max(-1, Math.min(1, +d.x || 0)), y: Math.max(-1, Math.min(1, +d.y || 0)), a: d.a ? 1 : 0, b: d.b ? 1 : 0, tilt: !!d.tilt });
        },
        onClose: function (conn) { var p = byConn(conn); if (p) { p.on = false; release(p); if (o.onLeave) o.onLeave(p); paint(); } }
      });
      h.code = h.net.code; GPad.ready = true; paint();
    }
    root.addEventListener('blur', function () {});   // phones keep driving even when the TV tab has no focus
    function chain() {
      if (root.LSNet) return start();
      var need = [];
      if (!root.Peer && !LOCAL) need.push(KIT + 'peerjs.min.js');
      if (!root.qrcode) need.push(KIT + 'qrcode.js');
      need.push(KIT + 'net.js');
      (function next() { var s = need.shift(); if (!s) return start(); load(s, next); })();
    }
    if (!root.LS_CONFIG) root.LS_CONFIG = { peerPrefix: PREFIX, iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
    if (document.body) chain(); else document.addEventListener('DOMContentLoaded', chain);
    return h;
  };
  root.GPad = GPad;
})(window);
