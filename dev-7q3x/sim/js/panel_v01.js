/* Zero to Phi dev kit - AI playtest panel v0.1 (core).
   Opens the game's real TV page and N real phone pages in iframes (same origin), gives each phone a persona and an
   autopilot from the game adapter (js/games/<game>_v01.js), and runs them all on one clock with pause / speed.
   URL: ?n=4 &auto=1 (start on load) &speed=2 &len=quick &net=local &hold=1 &seed=7 &game=rdr */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var PS = window.ZTPPersonas, GAMES = window.ZTPSimGames || {}, HOOKS = window.ZTPSimHooks || {};
  var Q = new URLSearchParams(location.search);
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var cfg = { game: GAMES[Q.get('game')] ? Q.get('game') : Object.keys(GAMES)[0], n: Math.max(1, Math.min(8, +(Q.get('n') || 4))), length: Q.get('len') || 'regular',
    local: Q.get('net') === 'local', hold: Q.has('hold'), speed: [1, 2, 4].indexOf(+Q.get('speed')) >= 0 ? +Q.get('speed') : 1, sound: false, autoReplay: true };
  var people = PS.makeSet(8, Q.get('seed'));
  var run = null, logFilter = 'all';
  var G = function () { return GAMES[cfg.game]; };

  // ------------------------------------------------------------------ localStorage guard
  // The phone pages share this browser's storage (name, room, picked character, last setup). Keep a copy of the
  // real values, clear the ones that would leak between bots, and put everything back when the panel closes.
  var KEEP = ['rdr_name', 'rdr_room', 'rdr_char', 'rdr_setup', 'rdr_phonehost', 'rdr_client', 'rdr_stuffView', 'rdr_moved'], saved = {};
  KEEP.forEach(function (k) { try { saved[k] = localStorage.getItem(k); } catch (e) {} });
  function clearShared() { ['rdr_char', 'rdr_setup', 'rdr_phonehost', 'rdr_moved'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); }
  function restoreShared() { KEEP.forEach(function (k) { try { if (saved[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]); } catch (e) {} }); }
  window.addEventListener('pagehide', function () { stop(); restoreShared(); });

  // ------------------------------------------------------------------ setup bar
  Object.keys(GAMES).forEach(function (id) { var o = document.createElement('option'); o.value = id; o.textContent = GAMES[id].name; $('cGame').appendChild(o); });
  $('cGame').value = cfg.game;
  for (var i = 1; i <= 8; i++) { var o = document.createElement('option'); o.value = i; o.textContent = i + (i === 1 ? ' AI (+1 TV AI)' : ' AI'); $('cN').appendChild(o); }
  $('cN').value = cfg.n;
  function fillLen() { $('cLen').innerHTML = G().lengths.map(function (l) { return '<option value="' + l[0] + '">' + l[1] + '</option>'; }).join(''); if (!G().lengths.some(function (l) { return l[0] === cfg.length; })) cfg.length = G().lengths[0][0]; $('cLen').value = cfg.length; }
  fillLen();
  $('cNet').value = cfg.local ? 'local' : 'online'; $('cHold').checked = cfg.hold;
  $('cGame').onchange = function () { cfg.game = this.value; fillLen(); };
  $('cN').onchange = function () { cfg.n = +this.value; renderCards(); };
  $('cLen').onchange = function () { cfg.length = this.value; };
  $('cNet').onchange = function () { cfg.local = this.value === 'local'; };
  $('cHold').onchange = function () { cfg.hold = this.checked; updStartBtn(); };
  $('bStart').onclick = function () { if (run) stop(); else start(); };
  $('bRestart').onclick = function () { stop(); start(); };
  $('bPause').onclick = function () { setPaused(!(run && run.paused)); };
  $('bStartGame').onclick = function () { if (run) { run.startReq = true; addLog(null, 'You pressed START GAME NOW', 'sys'); } };
  $('bSound').onclick = function () { cfg.sound = !cfg.sound; this.innerHTML = cfg.sound ? '&#128266;' : '&#128263;'; if (run && run.tv) G().muteTv(run.tv.contentWindow, !cfg.sound); };
  $('cSpeed').onclick = function (e) { var b = e.target.closest('button[data-x]'); if (b) setSpeed(+b.getAttribute('data-x')); };
  $('bRand').onclick = function () { people = PS.makeSet(8); renderCards(); addLog(null, 'New random people' + (run ? ' (names and looks apply on Restart; stats apply now)' : ''), 'sys'); if (run) run.bots.forEach(function (b, i) { ['skill', 'smarts', 'reaction', 'temper', 'quirk', 'motive'].forEach(function (k) { b.p[k] = people[i][k]; }); paintCap(b); }); };
  $('bPlayers').onclick = function () { $('people').hidden = !$('people').hidden; if (!$('people').hidden) renderCards(); };
  $('bPeopleClose').onclick = function () { $('people').hidden = true; };
  $('lFilter').onclick = function (e) { var b = e.target.closest('button[data-f]'); if (!b) return; logFilter = b.getAttribute('data-f'); Array.prototype.forEach.call(this.children, function (c) { c.className = c === b ? 'on' : ''; }); $('log').className = 'f-' + logFilter; };
  $('lClear').onclick = function () { $('log').innerHTML = ''; };
  function setSpeed(x) {
    cfg.speed = x; Array.prototype.forEach.call($('cSpeed').children, function (c) { c.className = +c.getAttribute('data-x') === x ? 'on' : ''; });
    if (run && run.tv) G().setSpeed(run.tv.contentWindow, x); addLog(null, 'Speed ' + x + '\u00d7', 'sys');
  }

  // persona editor cards
  function renderCards() {
    $('cards').innerHTML = people.map(function (p, i) {
      var sl = function (k, lab) { return '<div class="row"><span>' + lab + '</span><input type="range" min="0" max="10" step="1" data-i="' + i + '" data-k="' + k + '" value="' + p[k] + '"><b>' + p[k] + '</b></div>'; };
      var opt = function (list, v) { return list.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };
      return '<div class="pcard' + (i >= cfg.n ? ' off' : '') + '" style="--c:' + p.color + '"><div class="top"><span class="look" data-i="' + i + '" title="Tap for another look">' + p.look + '</span><input type="text" maxlength="12" data-i="' + i + '" data-k="name" value="' + esc(p.name) + '"><button class="ghost" data-rnd="' + i + '" title="Randomise this person">&#127922;</button></div>' +
        '<div class="sel"><span>Gender</span><select data-i="' + i + '" data-k="gender">' + opt(PS.GENDERS, p.gender) + '</select></div>' +
        sl('skill', 'Skill') + sl('smarts', 'Smarts') + sl('reaction', 'Reaction') + sl('temper', 'Calm\u2192Intense') +
        '<div class="sel"><span>Phone</span><select data-i="' + i + '" data-k="orient">' + opt(PS.ORIENT, p.orient) + '</select></div>' +
        '<div class="sel"><span>Quirk</span><select data-i="' + i + '" data-k="quirk">' + opt(Object.keys(PS.QUIRKS).map(function (k) { return [k, PS.QUIRKS[k].label]; }), p.quirk) + '</select></div>' +
        '<div class="mot">' + (i >= cfg.n ? 'not playing (raise Players)' : 'Here: ' + esc(p.motive) + ' \u00b7 ' + esc(PS.QUIRKS[p.quirk].blurb)) + '</div></div>';
    }).join('');
  }
  $('cards').addEventListener('input', function (e) {
    var el = e.target, i = +el.getAttribute('data-i'), k = el.getAttribute('data-k'); if (!k || isNaN(i)) return;
    var p = people[i]; p[k] = el.type === 'range' ? +el.value : el.value;
    if (el.type === 'range') el.nextElementSibling.textContent = el.value;
    if (k === 'gender') { p.look = PS.LOOKS[p.gender][0]; renderCards(); }
    if (run && run.bots[i]) paintCap(run.bots[i]);
  });
  $('cards').addEventListener('change', function (e) { if (e.target.getAttribute('data-k') === 'quirk') renderCards(); });
  $('cards').addEventListener('click', function (e) {
    var lk = e.target.closest('.look'), rb = e.target.closest('[data-rnd]');
    if (lk) { var p = people[+lk.getAttribute('data-i')], L = PS.LOOKS[p.gender]; p.look = L[(L.indexOf(p.look) + 1) % L.length]; renderCards(); }
    if (rb) { var i = +rb.getAttribute('data-rnd'), used = {}; people.forEach(function (q, j) { if (j !== i) used[q.name] = 1; }); var np = PS.make(i, Math.random, used); people[i] = np; renderCards(); }
  });

  // ------------------------------------------------------------------ event log
  function stamp() { if (!run) return '--:--'; var s = Math.floor(simNow() / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function addLog(bot, text, kind) {
    var ev = { t: stamp(), who: bot ? bot.p.name : null, text: text, kind: kind || (bot ? 'ai' : 'game') };
    if (run) { run.events.push(ev); if (run.events.length > 3000) run.events.shift(); }
    var el = $('log'), atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 30, d = document.createElement('div');
    d.className = 'e ' + ev.kind + (bot ? ' ai' : '');
    d.innerHTML = '<i>' + ev.t + '</i>' + (bot ? '<b style="color:' + bot.p.color + '">' + esc(bot.p.look + ' ' + bot.p.name) + '</b>' : ev.kind === 'game' ? '<b>TV</b>' : '') + esc(text);
    el.appendChild(d); while (el.children.length > 600) el.removeChild(el.firstChild);
    if (atEnd) el.scrollTop = el.scrollHeight;
    if (HOOKS.onEvent) try { HOOKS.onEvent(ev); } catch (e) {}
  }

  // ------------------------------------------------------------------ the sim clock (stops while paused)
  function simNow() { if (!run) return 0; return (run.paused ? run.pausedAt : Date.now()) - run.t0 - run.pauseTotal; }
  function setPaused(on) {
    if (!run || run.paused === on) return;
    var now = Date.now();
    if (on) { run.paused = true; run.pausedAt = now; }
    else { var d = now - run.pausedAt; run.pauseTotal += d; run.paused = false; run.bots.forEach(function (b) { if (b.pending) b.pending.at += d; if (b.h) { b.h.awayUntil += d; b.h.nextLapse += d; } b.nextFlip += d; }); }
    if (run.tv) G().setPaused(run.tv.contentWindow, on);
    $('bPause').innerHTML = on ? '&#9654; Resume' : '&#10074;&#10074; Pause';
    addLog(null, on ? 'Paused everything' : 'Resumed', 'sys');
  }

  // ------------------------------------------------------------------ start / stop
  function code4() { var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function start() {
    var A = G(); clearShared();
    $('people').hidden = true;
    run = { id: Math.random(), code: code4(), t0: Date.now(), pauseTotal: 0, paused: false, pausedAt: 0, bots: [], events: [], tv: null, tvCursor: null, turns: 0, lastTurn: null, rounds: 0,
      phase: 'boot', startReq: false, readyAt: 0, errors: [], online: false, spawned: false };
    var o = runOpts();
    $('grid').innerHTML = ''; $('log').innerHTML = '';
    addLog(null, 'Opening ' + A.name + ' TV board, room ' + run.code + (cfg.local ? ' (offline, this browser only)' : ''), 'sys');
    var box = $('tvBox'); box.innerHTML = '';
    var f = document.createElement('iframe'); f.width = A.tv.w; f.height = A.tv.h; f.style.width = A.tv.w + 'px'; f.style.height = A.tv.h + 'px'; f.src = A.tvUrl(o); f.setAttribute('allow', 'autoplay');
    box.appendChild(f); run.tv = f;
    f.addEventListener('load', function () { hookConsole(f.contentWindow, 'TV'); setTimeout(function () { try { A.muteTv(f.contentWindow, !cfg.sound); A.setSpeed(f.contentWindow, cfg.speed); } catch (e) {} }, 400); });
    people.slice(0, cfg.n).forEach(function (p, i) { run.bots.push(makeBot(p, i)); });
    layout();
    $('bStart').innerHTML = '&#9632; STOP'; $('bPause').disabled = false; $('bRestart').disabled = false;
    if (HOOKS.onRunStart) try { HOOKS.onRunStart(run); } catch (e) {}
  }
  function runOpts() { return { code: run.code, local: cfg.local, speed: cfg.speed, length: cfg.length }; }
  function stop() {
    if (!run) return;
    if (HOOKS.onRunStop) try { HOOKS.onRunStop(run); } catch (e) {}
    run.bots.forEach(function (b) { try { b.frame.src = 'about:blank'; } catch (e) {} });
    try { run.tv.src = 'about:blank'; } catch (e) {}
    run = null; $('grid').innerHTML = ''; $('tvBox').innerHTML = '<div class="empty">Stopped. Press <b>START</b> to open a fresh room.</div>';
    $('bStart').innerHTML = '&#9654; START'; $('bPause').disabled = true; $('bRestart').disabled = true; $('bStartGame').hidden = true; $('bPause').innerHTML = '&#10074;&#10074; Pause';
    $('rCode').textContent = '\u2014'; $('rUrl').textContent = ''; $('rMeta').textContent = ''; drawQr('');
    clearShared();
  }
  function hookConsole(w, who) {
    try {
      w.addEventListener('error', function (e) { if (run) { run.errors.push(who + ': ' + e.message); addLog(null, '\u26A0 ' + who + ' error: ' + e.message, 'miss'); } });
    } catch (e) {}
  }

  // ------------------------------------------------------------------ bots
  function makeBot(p, i) {
    var cell = document.createElement('div'); cell.className = 'cell';
    cell.innerHTML = '<div class="phone" style="--c:' + p.color + '"><div class="scr"></div></div><div class="cap" style="--c:' + p.color + '"><div class="n"></div><div class="s"></div><div class="t idle">arriving\u2026</div></div>';
    $('grid').appendChild(cell);
    var b = { p: p, i: i, cell: cell, ph: cell.querySelector('.phone'), scr: cell.querySelector('.scr'), capT: cell.querySelector('.cap .t'), frame: null, h: null, pilot: null, pending: null,
      orient: p.orient === 'landscape' ? 'landscape' : 'portrait', nextFlip: 0, arriveOff: (i === 0 ? 300 : 900 + i * 700 + Math.random() * 1600) / cfg.speed, arriveAt: 0, joined: false, info: {}, buzzT: 0 };
    if (p.orient === 'switch') { b.orient = Math.random() < 0.5 ? 'portrait' : 'landscape'; b.nextFlip = Date.now() + (40000 + Math.random() * 80000) / cfg.speed; }
    paintCap(b);
    return b;
  }
  function spawn(b) {
    var A = G(), f = document.createElement('iframe');
    f.src = A.phoneUrl(runOpts(), b.p); b.frame = f; b.scr.appendChild(f); sizePhone(b);
    f.addEventListener('load', function () {
      var w = f.contentWindow; if (!w || w.location.href === 'about:blank') return;
      hookConsole(w, b.p.name);
      try { w.navigator.vibrate = function (pat) { buzz(b, pat); return true; }; } catch (e) {}
      setTimeout(function () { A.mutePhone(w, true); }, 300);
      b.h = new PS.Human(b.p, function () { return cfg.speed; });
      b.pilot = A.pilot(b.p, b.h, api(b));
      b.joined = true; b.joinedAt = Date.now(); addLog(b, 'scans in (' + b.orient + ')' + ' \u00b7 ' + b.p.motive);
    });
  }
  function buzz(b, pat) {
    var ms = Array.isArray(pat) ? pat.reduce(function (a, x) { return a + x; }, 0) : +pat || 0; if (ms <= 0) return;
    b.ph.classList.add('buzz'); clearTimeout(b.buzzT); b.buzzT = setTimeout(function () { b.ph.classList.remove('buzz'); }, Math.min(1600, ms));
  }
  function api(b) {
    return {
      win: function () { return b.frame && b.frame.contentWindow; },
      speed: function () { return cfg.speed; },
      tap: function (el, what) { return tap(b, el, what); },
      plan: function (delay, cap, fn) { b.pending = { at: Date.now() + delay, fn: fn, cap: cap }; if (cap) setCap(b, cap, 'act'); },
      idle: function (txt) { if (!b.pending && txt) setCap(b, txt, 'idle'); },
      caption: function (txt) { setCap(b, txt, 'act'); },
      log: function (txt, kind) { addLog(b, txt, kind || 'ai'); },
      ctx: {
        solo: function () { return cfg.n === 1; },
        length: function () { return cfg.length; },
        autoReplay: function () { return cfg.autoReplay; },
        wantStart: function () { return !!run && wantStart(); },
        startNote: function () { return !run ? '' : cfg.hold && !run.startReq ? 'holding the lobby for you\u2026' : 'waiting for everyone to pick\u2026'; }
      }
    };
  }
  function wantStart() {
    var all = run.bots.every(function (x) { return x.pilot && x.pilot.ready(); });
    if (!all) { run.readyAt = 0; return false; }
    if (!run.readyAt) run.readyAt = Date.now();
    if (cfg.hold && !run.startReq) return false;
    return Date.now() - run.readyAt > 2500 / cfg.speed;
  }
  // a human tap on the real element: pointerdown, pointerup, click at a spot inside it, with a visible ripple.
  // A slip (persona skill) lands just off the button and does nothing, like a real missed tap.
  function tap(b, el, what) {
    var w = b.frame && b.frame.contentWindow; if (!w || !el) return false;
    var r = el.getBoundingClientRect(), x = r.left + r.width * (0.25 + Math.random() * 0.5), y = r.top + r.height * (0.25 + Math.random() * 0.5);
    b.h.stats.taps++;
    if (b.h.slips()) {
      var a = Math.random() * Math.PI * 2, d = Math.max(r.width, r.height) * 0.55 + 14; ripple(w, x + Math.cos(a) * d, y + Math.sin(a) * d, true);
      b.h.stats.misses++; setCap(b, 'fat-fingers it, misses ' + (what || 'the button') + '\u2026', 'miss'); addLog(b, 'missed tap (' + (what || 'button') + ')', 'miss'); paintCap(b);
      return false;
    }
    ripple(w, x, y, false);
    var o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, view: w };
    try { el.dispatchEvent(new w.PointerEvent('pointerdown', o)); o.buttons = 0; el.dispatchEvent(new w.PointerEvent('pointerup', o)); el.dispatchEvent(new w.MouseEvent('click', o)); } catch (e) { try { el.click(); } catch (x) {} }
    return true;
  }
  function ripple(w, x, y, miss) {
    try {
      var d = w.document, st = d.getElementById('simTapCss');
      if (!st) { st = d.createElement('style'); st.id = 'simTapCss'; st.textContent = '.simtap{position:fixed;z-index:2147483647;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,#ffd23fcc 0 30%,#ffd23f44 31% 60%,transparent 62%);animation:simtap .55s ease-out forwards}.simtap.miss{background:radial-gradient(circle,transparent 0 40%,#ff4a4acc 42% 52%,transparent 55%)}@keyframes simtap{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}'; d.head.appendChild(st); }
      var t = d.createElement('div'); t.className = 'simtap' + (miss ? ' miss' : ''); t.style.left = x + 'px'; t.style.top = y + 'px'; d.body.appendChild(t); setTimeout(function () { t.remove(); }, 600);
    } catch (e) {}
  }
  function setCap(b, txt, cls) { if (b.capTxt === txt && b.capCls === cls) return; b.capTxt = txt; b.capCls = cls; b.capT.textContent = txt; b.capT.className = 't ' + (cls || ''); }
  function paintCap(b) {
    var p = b.p, s = b.h ? b.h.stats : null, inf = b.info || {};
    b.cell.querySelector('.n').innerHTML = '<span class="lk">' + p.look + '</span>' + esc(p.name) + (p.quirk !== 'none' ? '<span class="q">' + esc(PS.QUIRKS[p.quirk].label) + '</span>' : '') + (inf.vip ? ' <span title="Host phone">\u2B50</span>' : '') + '<span class="cash">' + esc(inf.label || '') + '</span>';
    b.cell.querySelector('.s').innerHTML = 'Skill <em>' + p.skill + '</em> Smarts <em>' + p.smarts + '</em> React <em>' + p.reaction + '</em> <em>' + PS.temperLabel(p.temper) + '</em> ' + (b.orient === 'landscape' ? '\u25AD' : '\u25AF') + (p.orient === 'switch' ? '\u21BB' : '') +
      (s ? ' \u00b7 taps ' + s.taps + (s.misses ? ' (' + s.misses + ' missed)' : '') + (b.h.avgReact() ? ' \u00b7 ~' + (b.h.avgReact() / 1000).toFixed(1) + 's' : '') : '');
  }

  // ------------------------------------------------------------------ layout: TV tile + best-fit phone grid
  var PH = { cap: 74, gap: 12, minCapW: 200 };
  function dims(b) { var d = G().phone[b.orient]; return { w: d[0], h: d[1] }; }
  function fits(s, W, H) {
    var x = 0, y = 0, rowH = 0;
    for (var i = 0; i < run.bots.length; i++) {
      var d = dims(run.bots[i]), cw = Math.max(d.w * s + 12, PH.minCapW), ch = d.h * s + 12 + PH.cap + 4;
      if (cw > W) return false;
      if (x && x + cw > W) { y += rowH + PH.gap; x = 0; rowH = 0; }
      x += cw + PH.gap; rowH = Math.max(rowH, ch);
    }
    return y + rowH <= H;
  }
  function layout() {
    var tvb = $('tvBox'), f = tvb.querySelector('iframe'); if (f) { var k = tvb.clientWidth / G().tv.w; f.style.transform = 'scale(' + k + ')'; }
    if (!run) return;
    var gr = $('grid'), W = gr.clientWidth - 20, H = gr.clientHeight - 20, lo = 0.12, hi = 1.2;
    for (var it = 0; it < 22; it++) { var m = (lo + hi) / 2; if (fits(m, W, H)) lo = m; else hi = m; }
    run.scale = lo; run.bots.forEach(sizePhone);
  }
  function sizePhone(b) {
    if (!run) return; var s = run.scale || 0.4, d = dims(b);
    b.scr.style.width = Math.round(d.w * s) + 'px'; b.scr.style.height = Math.round(d.h * s) + 'px';
    b.cell.style.width = Math.max(d.w * s + 12, PH.minCapW) + 'px';
    if (b.frame) { b.frame.style.width = d.w + 'px'; b.frame.style.height = d.h + 'px'; b.frame.style.transform = 'scale(' + s + ')'; }
  }
  window.addEventListener('resize', function () { clearTimeout(layout._t); layout._t = setTimeout(layout, 100); });

  // ------------------------------------------------------------------ room box + QR
  function drawQr(text) {
    var cv = $('qr'), c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); if (!text) return;
    try { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); var n = q.getModuleCount(), m = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - m * n) / 2); c.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var cc = 0; cc < n; cc++) if (q.isDark(r, cc)) c.fillRect(off + cc * m, off + r * m, m, m); } catch (e) {}
  }
  function showRoom(code) {
    var url = G().joinUrl({ code: code });
    $('rCode').textContent = code;
    $('qr').style.visibility = cfg.local ? 'hidden' : 'visible';
    if (cfg.local) { drawQr(''); $('rNote').textContent = 'Offline room: only this browser can join. Switch Room to Online to scan in with your phone.'; $('rUrl').textContent = ''; }
    else { drawQr(url); $('rNote').textContent = 'Scan with your phone to play alongside the AIs' + (cfg.hold ? ' (the lobby waits for you).' : '. Tick "Wait for me" to hold the lobby.'); $('rUrl').textContent = url; $('rUrl').href = url; }
  }

  // ------------------------------------------------------------------ the main loop
  setInterval(function () {
    if (!run) return;
    var A = G(), now = Date.now(), tw = run.tv && run.tv.contentWindow, ti = { ok: false };
    try { ti = A.tvInfo(tw); } catch (e) {}
    // TV room up: show the code, let the phones arrive
    if (ti.ok && ti.online && !run.online) { run.online = true; if (ti.code && ti.code !== run.code) run.code = ti.code; showRoom(run.code); addLog(null, 'Room ' + run.code + ' is open' + (cfg.local ? '' : ' on the PeerJS broker'), 'sys'); run.bots.forEach(function (b) { b.arriveAt = now + b.arriveOff; }); }
    if (!run.online && now - run.t0 > 25000 && !run.warned) { run.warned = true; addLog(null, '\u26A0 The TV room has not opened after 25 s (' + (ti.status || 'no status') + '). The online broker may be blocked here: try Room \u2192 Offline.', 'miss'); }
    if (!cfg.local && run.online && !run.warnedPh && run.bots.some(function (b) { return b.joined && now - b.joinedAt > 25000 && (!b.info || !b.info.screen || b.info.screen === 'join'); })) { run.warnedPh = true; addLog(null, '\u26A0 Phones are still on "Connecting\u2026" after 25 s: WebRTC may be blocked on this network. Try Room \u2192 Offline (this browser) and Restart.', 'miss'); }
    if (run.paused) return;
    // TV log + turn tracking
    if (ti.ok) {
      try { var lg = A.tvLog(tw, run.tvCursor); run.tvCursor = lg.cursor; lg.lines.forEach(function (s) { addLog(null, s, 'game'); }); } catch (e) {}
      if (ti.phase === 'play' && ti.turnPid != null && ti.turnPid + ':' + ti.round !== run.lastTurn) { run.lastTurn = ti.turnPid + ':' + ti.round; run.turns++; run.rounds = ti.round; }
      if (ti.phase !== run.phase) { if (ti.phase === 'play' && run.phase !== 'play') { run.gameStartAt = now; addLog(null, 'Game on: ' + ti.players.length + ' players', 'big'); } if (ti.phase === 'over') addLog(null, 'Game over', 'big'); run.phase = ti.phase; }
      $('tvStat').textContent = 'TV \u00b7 room ' + (ti.code || run.code) + ' \u00b7 ' + (ti.phase === 'play' ? 'Round ' + ti.round + ' \u00b7 ' + ti.turnName + '\'s turn (' + ti.stage + ') \u00b7 turns ' + run.turns : ti.phase === 'lobby' ? 'Lobby \u00b7 ' + ti.players.length + ' joined' : ti.phase) + (ti.paused ? ' \u00b7 PAUSED' : '') + ' \u00b7 ' + cfg.speed + '\u00d7';
      $('rMeta').textContent = ti.players ? ti.players.map(function (q) { return q.name + (q.ai ? ' (TV AI)' : ''); }).join(', ') : '';
      if (ti.phase === 'lobby' && run.bots.every(function (b) { return b.pilot && b.pilot.ready(); }) && run.readyAt && wantStart() && now - run.readyAt > 30000 / cfg.speed && !run.forced) { run.forced = true; addLog(null, 'Host phone never started: starting from the TV', 'sys'); A.forceStart(tw); }
    }
    updStartBtn(ti);
    // bots
    run.bots.forEach(function (b) {
      if (!b.frame) { if (run.online && now >= b.arriveAt) spawn(b); return; }
      if (!b.pilot) return;
      var w = b.frame.contentWindow;
      if (b.p.orient === 'switch' && now >= b.nextFlip) { b.nextFlip = now + (40000 + Math.random() * 80000) / cfg.speed; b.orient = b.orient === 'portrait' ? 'landscape' : 'portrait'; addLog(b, 'turns the phone ' + (b.orient === 'landscape' ? 'sideways' : 'upright')); setCap(b, b.orient === 'landscape' ? 'turns the phone sideways' : 'turns the phone upright', 'act'); layout(); }
      if (b.pending) { if (now >= b.pending.at) { var pd = b.pending; b.pending = null; try { pd.fn(); } catch (e) { addLog(b, 'autopilot error: ' + e.message, 'miss'); } } return; }
      if (b.h.away(now)) { setCap(b, b.h.lapseNote, 'idle'); return; }
      try { b.pilot.tick(now); } catch (e) { addLog(b, 'autopilot error: ' + e.message, 'miss'); b.pending = { at: now + 2000, fn: function () {} }; }
    });
    // stat strips + turn glow (cheap, ~3 times a second)
    if (!run.capT || now - run.capT > 330) { run.capT = now; run.bots.forEach(function (b) { if (!b.frame || !b.pilot) return; try { b.info = A.phoneInfo(b.frame.contentWindow); } catch (e) { b.info = {}; } b.ph.classList.toggle('turn', !!b.info.myTurn); paintCap(b); }); }
  }, 100);
  function updStartBtn(ti) {
    var show = !!run && cfg.hold && !run.startReq && run.phase !== 'play' && run.phase !== 'over';
    if ($('bStartGame').hidden === show) $('bStartGame').hidden = !show;
  }

  // ------------------------------------------------------------------ test / dev hook
  window.ZTPSim = {
    cfg: cfg, people: people, start: start, stop: stop, setPaused: setPaused, setSpeed: setSpeed, layout: layout,
    state: function () {
      if (!run) return null; var ti = {}; try { ti = G().tvInfo(run.tv.contentWindow); } catch (e) {}
      return { code: run.code, online: run.online, phase: ti.phase, round: ti.round, turns: run.turns, paused: run.paused, errors: run.errors.slice(), simMs: simNow(), events: run.events.length,
        bots: run.bots.map(function (b) { return { name: b.p.name, orient: b.orient, joined: b.joined, ready: !!(b.pilot && b.pilot.ready()), cap: b.capTxt, stats: b.h ? b.h.stats : null, info: b.info }; }) };
    },
    events: function () { return run ? run.events.slice() : []; }
  };
  renderCards();
  if (Q.has('auto')) setTimeout(start, 300);
})();
