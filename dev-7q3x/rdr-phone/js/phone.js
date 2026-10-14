/* RED DEER RICH - dev phone mode. This phone hosts the whole game: the TV page runs board-only in the top frame
   (?phonehost=1, pinch / pan, soft camera), this phone's own controller is the bottom sheet (?embed=1), and friends join
   with the small QR. "Move to a TV": the TV dials this room, the phones vote, the game moves, every phone follows. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local'), KEY = 'rdr_phonehost';
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  var base = location.href.replace(/[^/]*([?#].*)?$/, ''), room = '', ctlLoaded = false, sheet = 'tabs', curTab = 'turn', name = '', moved = false;
  function code4() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', s = ''; for (var i = 0; i < 4; i++) s += A.charAt(Math.floor(Math.random() * A.length)); return s; }
  function friendUrl(c) { return base + 'controller.html?room=' + c + (LOCAL ? '&local=1' : ''); }
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  $('nm').value = store.get('rdr_name') || '';
  $('goBtn').onclick = function () {
    name = $('nm').value.trim(); if (!name) { $('nm').focus(); return; }
    store.set('rdr_name', name); $('start').hidden = true;
    room = (Q.get('room') || code4()).toUpperCase();
    $('boardF').src = 'index.html?phonehost=1&room=' + room + (LOCAL ? '&local=1' : '') + (Q.get('speed') ? '&speed=' + Q.get('speed') : '');
    setSheet('full');
    try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().catch(function () {}); } catch (e) {}
  };
  $('joinBtn').onclick = function () { location.href = 'controller.html' + (LOCAL ? '?local=1' : ''); };
  if (Q.has('autostart') && $('nm').value) $('goBtn').onclick();

  // ---- sheet: tabs (just the tab bar) / peek (the one thing you need now) / full (everything)
  function H() { return window.innerHeight; }
  function hFor(s) { var tabh = 64; return s === 'tabs' ? null : s === 'peek' ? Math.round(Math.max(260, H() * 0.46)) : Math.round(H() * 0.92); void tabh; }
  function setSheet(s) {
    sheet = s; var el = $('sheet'), h = hFor(s); el.className = s; el.style.height = h ? h + 'px' : '';
    $('scrim').classList.toggle('on', s !== 'tabs');
    post({ rdr: 'sheet', v: s });
  }
  function post(m) { try { $('ctlF').contentWindow.postMessage(m, '*'); } catch (e) {} }
  $('scrim').addEventListener('click', function () { if (curScreen === 'game') setSheet('tabs'); });
  // swipe the grip: up = full, down = smaller (or closed)
  (function () {
    var g = $('grip'), el = $('sheet'), y0 = 0, h0 = 0, t0 = 0, on = false;
    g.addEventListener('pointerdown', function (e) { on = true; y0 = e.clientY; h0 = el.getBoundingClientRect().height; t0 = Date.now(); el.classList.add('drag'); try { g.setPointerCapture(e.pointerId); } catch (x) {} });
    g.addEventListener('pointermove', function (e) { if (!on) return; el.style.height = Math.max(64, Math.min(H() * 0.95, h0 + (y0 - e.clientY))) + 'px'; });
    function end(e) { if (!on) return; on = false; el.classList.remove('drag'); var dy = y0 - e.clientY, v = dy / Math.max(1, Date.now() - t0), h = h0 + dy;
      if (v > 0.5) setSheet('full'); else if (v < -0.5) setSheet(sheet === 'full' && curScreen === 'game' ? 'peek' : 'tabs');
      else setSheet(h > H() * 0.7 ? 'full' : h > H() * 0.25 ? 'peek' : 'tabs');
      if (curScreen !== 'game' && sheet !== 'full') setSheet('full'); }
    g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  })();
  window.addEventListener('resize', function () { setSheet(sheet); });

  // ---- messages from the two frames
  var curScreen = 'join', canRoll = false;
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (e.source === $('boardF').contentWindow) {
      if (d.ztp === 'room' && d.status === 'online' && d.code) {
        if (d.code !== room || !ctlLoaded) { room = d.code; drawQr(friendUrl(room)); }
        if (!ctlLoaded) { ctlLoaded = true; $('ctlF').src = 'controller.html?room=' + room + '&auto=1&embed=1&name=' + encodeURIComponent(name) + (LOCAL ? '&local=1' : ''); $('qrBox').hidden = false; $('menuBtn').hidden = false; $('fitBtn').hidden = false; }
      }
      if (d.rdrPh === 'moved') goMoved(d.room);
    }
    if (e.source === $('ctlF').contentWindow) {
      if (d.rdrPh === 'tab') { if (sheet === 'tabs') setSheet('peek'); else if (d.tab === curTab && sheet === 'peek') setSheet('tabs'); curTab = d.tab; }
      if (d.rdrPh === 'attn') { curScreen = d.screen; if (d.tab) curTab = d.tab;
        if (d.k === 'full') setSheet('full');
        else if (d.k && d.k.indexOf('peek') === 0) { if (d.k.indexOf('peek:turn') === 0 && curTab !== 'turn') { post({ rdr: 'tab', tab: 'turn' }); curTab = 'turn'; } if (sheet === 'tabs') setSheet('peek'); }
        else if (curScreen === 'game' && sheet === 'full' && !d.k) setSheet('peek'); }
      if (d.rdrPh === 'tick') { curScreen = d.screen; if (canRoll !== !!d.canRoll) { canRoll = !!d.canRoll; $('dice').hidden = !canRoll; } }
      if (d.rdrPh === 'moved') goMoved(d.room);
    }
  });
  $('dice').onclick = function () { post({ rdr: 'roll' }); vib(30); };
  $('fitBtn').onclick = function () { try { $('boardF').contentWindow.postMessage({ rdrCam: 'fit' }, '*'); } catch (e) {} };
  $('qrBox').onclick = function () { this.classList.toggle('big'); };

  function drawQr(text) {
    var cv = $('qr'), c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
    try { var q = window.qrcode(0, 'L'); q.addData(text); q.make(); var n = q.getModuleCount(), cell = Math.floor(cv.width / (n + 2)), off = Math.floor((cv.width - cell * n) / 2); c.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(off + k * cell, off + r * cell, cell, cell); } catch (e) {}
  }

  // ---- heartbeat so a TV join link opened on this phone can offer "Move your game here?"
  setInterval(function () { if (room && ctlLoaded && !moved) store.set(KEY, JSON.stringify({ room: room, at: Date.now(), base: base })); }, 2000);
  window.addEventListener('pagehide', function () { if (!moved) store.del(KEY); });

  // ---- moved: this phone becomes a normal TV controller (same seat: same client id in localStorage)
  function goMoved(to) {
    if (moved) return; moved = true; store.del(KEY); store.set('rdr_moved', JSON.stringify({ room: to, at: Date.now() })); store.set('rdr_room', to);
    vib([40, 40, 120]);
    setTimeout(function () { location.replace('controller.html?room=' + to + '&auto=1&name=' + encodeURIComponent(name || store.get('rdr_name') || 'Player') + (LOCAL ? '&local=1' : '')); }, 700);
  }

  // ---- Move to a TV by code (the TV shows its room code in the lobby)
  $('menuBtn').onclick = function () { $('menu').hidden = false; $('mvSt').textContent = ''; };
  $('menuClose').onclick = function () { $('menu').hidden = true; };
  $('tvCode').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  var mv = null;
  $('mvBtn').onclick = function () {
    var tv = $('tvCode').value; if (tv.length !== 4 || tv === room) { $('mvSt').textContent = 'Type the 4-letter code shown on the TV.'; return; }
    $('mvSt').textContent = 'Calling the TV\u2026'; if (mv) try { mv.destroy(); } catch (e) {}
    var o = { code: tv, onOpen: function () { mv.send({ t: 'hello', role: 'adopt', from: room, by: store.get('rdr_client') || '' }); },
      onStatus: function (s) { if (s === 'noroom') $('mvSt').textContent = 'No TV with code ' + tv + ' yet. Is Red Deer Rich open on it?'; },
      onMessage: function (m) { if (!m) return; if (m.t === 'adoptOk') { $('mvSt').textContent = 'The TV is asking. Vote on the phones (yours is already a yes).'; setTimeout(function () { $('menu').hidden = true; }, 1600); try { mv.destroy(); } catch (e) {} }
        if (m.t === 'reject') $('mvSt').textContent = m.reason; } };
    mv = LOCAL ? new window.RDRNet.LocalClient(o) : new window.RDRNet.Client(o);
  };
  window.RDRPhone = { state: function () { return { room: room, sheet: sheet, screen: curScreen, canRoll: canRoll, moved: moved }; }, setSheet: setSheet };
})();
