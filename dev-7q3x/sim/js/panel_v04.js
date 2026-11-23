/* Zero to Phi dev kit - AI playtest panel v0.4 (core). v0.4: TV v0.7.6, readable score strip under the TV preview,
   queue-for-next-game on the phones, game-switch closeout to the 0-Phi logo. Built on v0.3:
   per-phone + master phone SFX (TV music stays on the TV),
   bouncing gold speaker per phone, curious AIs (personas_v02 curiosity), TV board + explore-after-pick controller,
   TV breakout (full screen / own window via viewer mode), host mode (auto / me / first AI), Leave / Rejoin / Late join,
   Pace (Relaxed / Normal / Snappy).
   v0.2: v0.2: phone-friendly layout (gear drawer, scrolling 2-column phones,
   collapsible log, desktop-site mode zoomed up from the window size), no text selection / Touch to Search, AI / Me seats,
   double-tap any phone or the TV to zoom it full screen (yellow tab zooms back out), everything keeps running while zoomed.
   v0.1 notes:
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
    local: Q.get('net') === 'local', hold: Q.has('hold'), host: ['auto', 'me', 'ai'].indexOf(Q.get('host')) >= 0 ? Q.get('host') : 'auto', pace: ['relaxed', 'normal', 'snappy'].indexOf(Q.get('pace')) >= 0 ? Q.get('pace') : 'snappy', phoneSfx: Q.has('sfx'), speed: [1, 2, 4].indexOf(+Q.get('speed')) >= 0 ? +Q.get('speed') : 1, sound: false, autoReplay: true };
  var people = PS.makeSet(8, Q.get('seed'));
  var run = null, logFilter = 'all';
  var G = function () { return GAMES[cfg.game]; };
  // v0.3 pace: ai = think-time multiplier, game = TV timing factor (game speed divisor), catch = suggested PAY UP window
  var PACE = { relaxed: { ai: 1.8, game: 0.72, catchSec: 8, label: 'Relaxed' }, normal: { ai: 1.35, game: 0.85, catchSec: 5, label: 'Normal' }, snappy: { ai: 1, game: 1, catchSec: 5, label: 'Snappy' } };
  function tvSpeed() { return cfg.speed * PACE[cfg.pace].game; }
  function humanSpeed() { return cfg.speed / PACE[cfg.pace].ai; }
  cfg.me = (function () { try { return localStorage.getItem('rdr_name') || ''; } catch (e) { return ''; } })() || 'Me';
  var mineSeats = (Q.get('me') || '').split(',').filter(Boolean).map(Number);   // ?me=1 makes seat 1 yours
  mineSeats.forEach(function (n) { if (people[n - 1]) people[n - 1].mine = true; });

  // ------------------------------------------------------------------ v0.2 viewport: phone layout + desktop-site zoom
  // Android Chrome "desktop site" lays the page out ~980 px wide on a ~400 px phone, so everything is microscopic.
  // Zoom the whole panel back up by the real screen width (or ?zoom=x), then pick the phone layout by the logical width.
  var Z = 1, MOB = false;
  function viewport() { return { W: window.innerWidth / Z, H: window.innerHeight / Z }; }
  function fitViewport() {
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches, sw = screen.width || 0, z = 1;
    if (Q.get('zoom')) z = Math.max(0.5, Math.min(4, +Q.get('zoom') || 1));
    else if (coarse && sw && sw < 820 && window.innerWidth > sw * 1.25) z = window.innerWidth / sw;
    if (Math.abs(z - Z) > 0.01) { Z = z; document.documentElement.style.zoom = z === 1 ? '' : String(z); }
    var v = viewport(); MOB = v.W < 820 || (coarse && v.W < 1000 && v.H > v.W);
    document.body.classList.toggle('mob', MOB);
  }
  fitViewport();

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
  $('cGame').onchange = function () {
    var next = this.value;
    if (run && next !== cfg.game) {
      closeoutPhones(function () { cfg.game = next; fillLen(); stop(); start(); });
      return;
    }
    cfg.game = next; fillLen();
  };
  function closeoutPhones(done) {
    try {
      run.bots.forEach(function (b) {
        var w = b.frame && b.frame.contentWindow;
        if (w && typeof w.RDR076Closeout === 'function') w.RDR076Closeout();
      });
    } catch (e) {}
    var ov = document.getElementById('closeLogo');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'closeLogo';
      ov.innerHTML = '<img src="../rdr-phone/assets/logo.svg" alt="Zero to Phi"><div class="w">ZERO TO PHI</div>';
      document.body.appendChild(ov);
    }
    ov.classList.add('on');
    setTimeout(function () { ov.classList.remove('on'); if (done) done(); }, 1100);
  }
  $('cN').onchange = function () { cfg.n = +this.value; renderCards(); };
  $('cLen').onchange = function () { cfg.length = this.value; };
  $('cNet').onchange = function () { cfg.local = this.value === 'local'; };
  $('cHold').onchange = function () { cfg.hold = this.checked; updStartBtn(); };
  $('bStart').onclick = function () { if (run) stop(); else start(); };
  $('cHost').value = cfg.host; $('cPace').value = cfg.pace;
  $('cHost').onchange = function () { cfg.host = this.value; addLog(null, 'Host: ' + this.options[this.selectedIndex].text + (run ? ' (join order applies on Restart)' : ''), 'sys'); updStartBtn(); };
  $('cPace').onchange = function () { cfg.pace = this.value; if (run && run.tv) { G().setSpeed(run.tv.contentWindow, tvSpeed()); G().setCatch && G().setCatch(run.tv.contentWindow, PACE[cfg.pace].catchSec); } addLog(null, 'Pace: ' + PACE[cfg.pace].label + ' (AI think \u00d7' + PACE[cfg.pace].ai + ', game timing \u00d7' + (1 / PACE[cfg.pace].game).toFixed(2) + ', catch window ' + PACE[cfg.pace].catchSec + ' s)', 'sys'); };
  $('bSfx').onclick = function () { cfg.phoneSfx = !cfg.phoneSfx; if (run) run.bots.forEach(function (b) { b.sfx = null; applySound(b); }); paintSfx(); unlockAudio(); addLog(null, 'All phone SFX ' + (cfg.phoneSfx ? 'ON' : 'off'), 'sys'); };
  function paintSfx() { $('bSfx').classList.toggle('on', cfg.phoneSfx); $('bSfx').querySelector('.ic').innerHTML = cfg.phoneSfx ? '&#128266;' : '&#128264;'; }
  paintSfx();
  $('bAddSeat').onclick = function () { lateJoin(); };
  $('bTvFull').onclick = function () { tvFull(); };
  $('bTvWin').onclick = function () { tvWindow(); };
  // audio needs a gesture: every tap or key in the panel (re)unlocks the phones that are allowed to sound, and the TV
  function unlockAudio() { if (!run) return; run.bots.forEach(function (b) { if (b.frame && audible(b)) G().unlockPhone(b.frame.contentWindow); }); if (cfg.sound && run.tv) try { run.tv.contentWindow.RDRSfx.unlock(); } catch (e) {} }
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { unlockAudio(); }, true); });
  document.addEventListener('click', function (e) { if (e.target.closest('#bStart2')) { if (!run) start(); } });
  $('cMe').value = cfg.me; $('cMe').oninput = function () { cfg.me = this.value.trim() || 'Me'; };
  $('bGear').onclick = function () { var d = $('drawer'), on = !d.classList.contains('open'); d.classList.toggle('open', on); this.setAttribute('aria-expanded', on); };
  document.addEventListener('pointerdown', function (e) { var d = $('drawer'); if (d.classList.contains('open') && !e.target.closest('#drawer') && !e.target.closest('#bGear') && !e.target.closest('#people')) { d.classList.remove('open'); $('bGear').setAttribute('aria-expanded', false); } });
  $('lToggle').onclick = function () { var b = $('logBox'), shut = !b.classList.contains('shut'); b.classList.toggle('shut', shut); this.firstChild.nodeValue = shut ? '\u25B8 ' : '\u25BE '; if (!MOB) layout(); };
  if (MOB) { $('logBox').classList.add('shut'); $('lToggle').firstChild.nodeValue = '\u25B8 '; }
  $('bRestart').onclick = function () { stop(); start(); };
  $('bPause').onclick = function () { setPaused(!(run && run.paused)); };
  $('bStartGame').onclick = function () { if (run) { run.startReq = true; addLog(null, 'You pressed START GAME NOW', 'sys'); } };
  $('bSound').onclick = function () { cfg.sound = !cfg.sound; unlockAudio(); this.innerHTML = (cfg.sound ? '&#128266;' : '&#128263;') + '<span class="lbl2"> TV sound</span>'; if (run && run.tv) G().muteTv(run.tv.contentWindow, !cfg.sound); };
  $('cSpeed').onclick = function (e) { var b = e.target.closest('button[data-x]'); if (b) setSpeed(+b.getAttribute('data-x')); };
  $('bRand').onclick = function () { people = PS.makeSet(8); renderCards(); addLog(null, 'New random people' + (run ? ' (names and looks apply on Restart; stats apply now)' : ''), 'sys'); if (run) run.bots.forEach(function (b, i) { ['skill', 'smarts', 'reaction', 'temper', 'quirk', 'motive'].forEach(function (k) { b.p[k] = people[i][k]; }); paintCap(b); }); };
  $('bPlayers').onclick = function () { $('people').hidden = !$('people').hidden; if (!$('people').hidden) renderCards(); };
  $('bPeopleClose').onclick = function () { $('people').hidden = true; };
  $('lFilter').onclick = function (e) { var b = e.target.closest('button[data-f]'); if (!b) return; logFilter = b.getAttribute('data-f'); Array.prototype.forEach.call(this.children, function (c) { c.className = c === b ? 'on' : ''; }); $('log').className = 'f-' + logFilter; };
  $('lClear').onclick = function () { $('log').innerHTML = ''; };
  function setSpeed(x) {
    cfg.speed = x; Array.prototype.forEach.call($('cSpeed').children, function (c) { c.className = +c.getAttribute('data-x') === x ? 'on' : ''; });
    if (run && run.tv) G().setSpeed(run.tv.contentWindow, tvSpeed()); addLog(null, 'Speed ' + x + '\u00d7', 'sys');
  }

  // persona editor cards
  function renderCards() {
    $('cards').innerHTML = people.map(function (p, i) {
      var sl = function (k, lab) { return '<div class="row"><span>' + lab + '</span><input type="range" min="0" max="10" step="1" data-i="' + i + '" data-k="' + k + '" value="' + p[k] + '"><b>' + p[k] + '</b></div>'; };
      var opt = function (list, v) { return list.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); };
      return '<div class="pcard' + (i >= cfg.n ? ' off' : '') + '" style="--c:' + p.color + '"><div class="top"><span class="look" data-i="' + i + '" title="Tap for another look">' + p.look + '</span><input type="text" maxlength="12" data-i="' + i + '" data-k="name" value="' + esc(p.name) + '"><button class="ghost" data-rnd="' + i + '" title="Randomise this person">&#127922;</button></div>' +
        '<div class="sel"><span>Gender</span><select data-i="' + i + '" data-k="gender">' + opt(PS.GENDERS, p.gender) + '</select></div>' +
        sl('skill', 'Skill') + sl('smarts', 'Smarts') + sl('reaction', 'Reaction') + sl('temper', 'Calm\u2192Intense') + sl('curiosity', 'Curiosity') +
        '<div class="sel"><span>Seat</span><select data-i="' + i + '" data-k="mine"><option value=""' + (p.mine ? '' : ' selected') + '>AI plays it</option><option value="1"' + (p.mine ? ' selected' : '') + '>Me (I play it)</option></select></div>' +
        '<div class="sel"><span>Phone</span><select data-i="' + i + '" data-k="orient">' + opt(PS.ORIENT, p.orient) + '</select></div>' +
        '<div class="sel"><span>Quirk</span><select data-i="' + i + '" data-k="quirk">' + opt(Object.keys(PS.QUIRKS).map(function (k) { return [k, PS.QUIRKS[k].label]; }), p.quirk) + '</select></div>' +
        '<div class="mot">' + (i >= cfg.n ? 'not playing (raise Players)' : 'Here: ' + esc(p.motive) + ' \u00b7 ' + esc(PS.QUIRKS[p.quirk].blurb)) + '</div></div>';
    }).join('');
  }
  $('cards').addEventListener('input', function (e) {
    var el = e.target, i = +el.getAttribute('data-i'), k = el.getAttribute('data-k'); if (!k || isNaN(i)) return;
    var p = people[i]; p[k] = el.type === 'range' ? +el.value : k === 'mine' ? !!el.value : el.value;
    if (k === 'mine' && run && run.bots[i]) setMine(run.bots[i], p.mine);
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
    $('lCount').textContent = run ? '(' + run.events.length + ')' : '';
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
    var tov = document.createElement('div'); tov.className = 'ov'; box.appendChild(tov); dblTap(tov, function () { zoomTo('tv'); });
    f.addEventListener('load', function () { hookConsole(f.contentWindow, 'TV'); setTimeout(function () { try { A.muteTv(f.contentWindow, !cfg.sound); A.setSpeed(f.contentWindow, tvSpeed()); } catch (e) {} }, 400); });
    people.slice(0, cfg.n).forEach(function (p, i) { if (p.curiosity == null) p.curiosity = 5; run.bots.push(makeBot(p, i)); });
    // join order decides who the game makes host: Me = your seats first, First AI = AI seats first, Auto = seat order
    var order = run.bots.slice();
    if (cfg.host === 'me') order.sort(function (a, b) { return (b.mine ? 1 : 0) - (a.mine ? 1 : 0); });
    if (cfg.host === 'ai') order.sort(function (a, b) { return (a.mine ? 1 : 0) - (b.mine ? 1 : 0); });
    order.forEach(function (b, k) { b.arriveOff = (k === 0 ? 300 : 900 + k * 700 + Math.random() * 1600) / cfg.speed; });
    layout();
    $('bStart').innerHTML = '&#9632; STOP'; $('bPause').disabled = false; $('bRestart').disabled = false; $('bAddSeat').disabled = false; $('bTvFull').disabled = false; $('bTvWin').disabled = false;
    if (HOOKS.onRunStart) try { HOOKS.onRunStart(run); } catch (e) {}
  }
  function runOpts() { return { code: run.code, local: cfg.local, speed: cfg.speed, length: cfg.length }; }
  function stop() {
    if (!run) return;
    zoomOut();
    if (HOOKS.onRunStop) try { HOOKS.onRunStop(run); } catch (e) {}
    run.bots.forEach(function (b) { try { b.frame.src = 'about:blank'; } catch (e) {} });
    try { run.tv.src = 'about:blank'; } catch (e) {}
    run = null; $('grid').innerHTML = ''; if ($('tvScores')) { $('tvScores').hidden = true; $('tvScores').innerHTML = ''; }
    $('tvBox').innerHTML = '<div class="empty"><button id="bStart2" class="go big">&#9654; START</button><span>Stopped. Start opens a fresh room.</span></div>';
    $('bStart').innerHTML = '&#9654; START'; $('bPause').disabled = true; $('bRestart').disabled = true; $('bAddSeat').disabled = true; $('bTvFull').disabled = true; $('bTvWin').disabled = true; $('bStartGame').hidden = true; $('bPause').innerHTML = '&#10074;&#10074; Pause';
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
    cell.innerHTML = '<div class="phone" style="--c:' + p.color + '"><div class="scr"></div><div class="ov" title="Double-tap to zoom in"></div></div><div class="cap" style="--c:' + p.color + '"><div class="row1"><button class="spk" title="This phone\'s sound effects on / off" aria-label="Phone sound"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w1" d="M16 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path class="w2" d="M18.5 7a7 7 0 0 1 0 10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg></button><div class="n"></div><button class="lv" title="Leave the room / walk back in">&#9167;</button></div><div class="s"></div><div class="t idle">arriving\u2026</div></div>';
    $('grid').appendChild(cell);
    var b = { p: p, i: i, cell: cell, ph: cell.querySelector('.phone'), scr: cell.querySelector('.scr'), capT: cell.querySelector('.cap .t'), frame: null, h: null, pilot: null, pending: null,
      orient: p.orient === 'landscape' ? 'landscape' : 'portrait', nextFlip: 0, arriveOff: (i === 0 ? 300 : 900 + i * 700 + Math.random() * 1600) / cfg.speed, arriveAt: 0, joined: false, info: {}, buzzT: 0 };
    if (p.orient === 'switch') { b.orient = Math.random() < 0.5 ? 'portrait' : 'landscape'; b.nextFlip = Date.now() + (40000 + Math.random() * 80000) / cfg.speed; }
    b.mine = !!p.mine; cell.classList.toggle('mine', b.mine); b.ph.classList.toggle('mine', b.mine);
    dblTap(cell.querySelector('.ov'), function () { zoomTo(b); });
    cell.querySelector('.cap').addEventListener('click', function (e) {
      if (e.target.closest('.seat')) setMine(b, !b.mine);
      if (e.target.closest('.spk')) { b.sfx = !audible(b); applySound(b); unlockAudio(); addLog(b, 'phone sound ' + (b.sfx ? 'ON' : 'off'), 'sys'); }
      if (e.target.closest('.lv')) { if (b.left) rejoin(b); else leave(b); }
    });
    b.spk = cell.querySelector('.spk'); b.sfx = null; applySound(b);
    paintCap(b);
    return b;
  }
  // v0.2 seats: AI (autopilot) or Me (the autopilot lets go; the phone is yours to tap)
  function setMine(b, on) {
    on = !!on; if (b.mine === on && b.p.mine === on) return; b.mine = on; b.p.mine = on; b.pending = null;
    b.cell.classList.toggle('mine', on); b.ph.classList.toggle('mine', on);
    setCap(b, on ? '\uD83D\uDE4B Your seat: double-tap to play full screen' : 'autopilot taking over\u2026', on ? 'act' : 'idle');
    addLog(b, on ? 'seat switched to ME (autopilot off)' : 'seat switched back to AI', 'sys'); paintCap(b);
    if (run && run.zoom === b) zoomTo(b);
    renderCards();
  }
  // double-tap (touch) or double-click (mouse) on an element, or inside a same-origin iframe document
  function dblTap(el, fn) {
    var last = 0, lx = 0, ly = 0;
    el.addEventListener('pointerup', function (e) {
      var t = Date.now();
      if (t - last < 380 && Math.abs(e.clientX - lx) < 40 && Math.abs(e.clientY - ly) < 40) { last = 0; e.preventDefault(); fn(); return; }
      last = t; lx = e.clientX; ly = e.clientY;
    });
    el.addEventListener('dblclick', function (e) { e.preventDefault(); });
  }
  // ------------------------------------------------------------------ v0.3 phone sound
  function audible(b) { return b.sfx == null ? cfg.phoneSfx : b.sfx; }
  function applySound(b) {
    var on = audible(b); b.spk.classList.toggle('on', on); b.spk.classList.toggle('off', !on);
    if (b.frame && b.frame.contentWindow) G().mutePhone(b.frame.contentWindow, !on);
  }
  function soundHit(b, name) {
    if (!run) return; run.sfxCount = (run.sfxCount || 0) + 1; b.sfxN = (b.sfxN || 0) + 1;
    var el = b.spk; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); clearTimeout(b.hitT); b.hitT = setTimeout(function () { el.classList.remove('hit'); }, 520);
  }
  // ------------------------------------------------------------------ v0.3 leave / rejoin / late join
  function leave(b) {
    if (!b.frame) return; if (run.zoom === b) zoomOut();
    b.left = true; b.pending = null; b.pilot = null; try { b.frame.remove(); } catch (e) {} b.frame = null;
    b.cell.classList.add('gone'); setCap(b, '\uD83D\uDEAA left the room', 'idle'); addLog(b, 'leaves the room (phone closed)', 'big'); paintCap(b);
  }
  function rejoin(b) { if (!b.left) return; b.left = false; b.cell.classList.remove('gone'); setCap(b, 'walking back in\u2026', 'act'); addLog(b, 'walks back in (same phone, same seat)', 'big'); spawn(b); }
  function lateJoin() {
    if (!run) return; if (run.bots.length >= 8) { addLog(null, 'All 8 seats are in use', 'sys'); return; }
    var i = run.bots.length, used = {}; run.bots.forEach(function (x) { used[x.p.name] = 1; });
    var p = people[i] && !run.bots.some(function (x) { return x.p === people[i]; }) ? people[i] : PS.make(i, Math.random, used); people[i] = p; p.mine = false;
    var b = makeBot(p, i); run.bots.push(b); b.arriveAt = Date.now() + 400; layout();
    addLog(b, 'walks in late' + (run.phase === 'play' ? ' (game already running: takes a free seat or watches)' : ''), 'big');
  }
  // ------------------------------------------------------------------ v0.3 TV breakout
  function tvFull() {
    if (!run) return; var de = document.documentElement;
    if (!document.fullscreenElement && de.requestFullscreen) de.requestFullscreen().catch(function () {});
    zoomTo('tv'); run.fullTv = true;
  }
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && run && run.fullTv) { run.fullTv = false; if (run.zoom === 'tv') zoomOut(); } setTimeout(layout, 120); });
  function tvWindow() {
    if (!run) return; var url = G().viewerUrl(runOpts());
    var w = window.open(url, 'ztp-tv-' + run.code, 'popup,width=1280,height=760');
    addLog(null, w ? 'TV board opened in its own window (viewer synced to room ' + run.code + ')' : 'The browser blocked the new window: allow pop-ups for this page', w ? 'sys' : 'miss');
    run.tvWin = w;
  }
  function spawn(b) {
    var A = G(), f = document.createElement('iframe');
    var who = b.p.mine ? Object.assign({}, b.p, { name: cfg.me, id: b.p.id + 'me' }) : b.p; b.joinName = who.name;
    f.src = A.phoneUrl(runOpts(), who); b.frame = f; b.scr.appendChild(f); sizePhone(b);
    f.addEventListener('load', function () {
      var w = f.contentWindow; if (!w || w.location.href === 'about:blank') return;
      hookConsole(w, b.p.name);
      try { var lt = 0, lx = 0, ly = 0; w.document.addEventListener('pointerup', function (e) { if (!b.mine || (run && run.zoom === b)) return; var t = Date.now(); if (t - lt < 380 && Math.abs(e.clientX - lx) < 40 && Math.abs(e.clientY - ly) < 40) { lt = 0; zoomTo(b); return; } lt = t; lx = e.clientX; ly = e.clientY; }, true); } catch (e) {}
      try { w.navigator.vibrate = function (pat) { buzz(b, pat); return true; }; } catch (e) {}
      A.soundHook && A.soundHook(w, function (n) { soundHit(b, n); });
      A.mutePhone(w, !audible(b)); setTimeout(function () { applySound(b); }, 300);
      b.h = b.h || new PS.Human(b.p, humanSpeed);
      b.pilot = A.pilot(b.p, b.h, api(b));
      b.joined = true; b.joinedAt = Date.now(); addLog(b, b.p.mine ? 'your seat joins as ' + b.joinName : 'scans in (' + b.orient + ')' + ' \u00b7 ' + b.p.motive);
    });
  }
  function rotate(b, why) {
    if (run.zoom === b) return; b.orient = b.orient === 'portrait' ? 'landscape' : 'portrait'; setCap(b, why || 'turns the phone', 'act'); addLog(b, (why || 'turns the phone') + ' (' + b.orient + ')'); layout();
    if (b.p.orient !== 'switch') { clearTimeout(b.rotT); b.rotT = setTimeout(function () { if (!run || b.left) return; var want = b.p.orient === 'landscape' ? 'landscape' : 'portrait'; if (b.orient !== want && run.zoom !== b) { b.orient = want; layout(); } }, (5000 + Math.random() * 9000) / humanSpeed()); }
  }
  function buzz(b, pat) {
    var ms = Array.isArray(pat) ? pat.reduce(function (a, x) { return a + x; }, 0) : +pat || 0; if (ms <= 0) return;
    b.ph.classList.add('buzz'); clearTimeout(b.buzzT); b.buzzT = setTimeout(function () { b.ph.classList.remove('buzz'); }, Math.min(1600, ms));
  }
  function api(b) {
    return {
      win: function () { return b.frame && b.frame.contentWindow; },
      speed: humanSpeed,
      rotate: function (why) { rotate(b, why); },
      tap: function (el, what) { return tap(b, el, what); },
      plan: function (delay, cap, fn) { b.pending = { at: Date.now() + delay, fn: fn, cap: cap }; if (cap) setCap(b, cap, 'act'); },
      idle: function (txt) { if (!b.pending && txt) setCap(b, txt, 'idle'); },
      caption: function (txt) { setCap(b, txt, 'act'); },
      log: function (txt, kind) { addLog(b, txt, kind || 'ai'); },
      ctx: {
        solo: function () { return run && run.bots.length === 1; },
        hostMode: function () { return cfg.host; },
        catchSec: function () { return PACE[cfg.pace].catchSec; },
        length: function () { return cfg.length; },
        autoReplay: function () { return cfg.autoReplay; },
        wantStart: function () { return !!run && wantStart(); },
        startNote: function () { return !run ? '' : cfg.hold && !run.startReq ? 'holding the lobby for you\u2026' : wantStart() ? 'starting\u2026' : 'waiting for everyone to pick\u2026'; }
      }
    };
  }
  function wantStart() {
    var all = run.bots.every(function (x) { return x.left ? true : x.mine ? !!(x.info && x.info.screen && x.info.screen !== 'join') : x.pilot && x.pilot.ready(); });
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
    var nh = '<span class="lk">' + (b.mine ? '\uD83D\uDE4B' : p.look) + '</span>' + esc(b.mine ? (b.joinName || cfg.me) : p.name) + '<span class="seat' + (b.mine ? ' me' : '') + '" role="button" aria-label="Switch seat between AI and me"><span class="' + (b.mine ? '' : 'on') + '">AI</span><span class="' + (b.mine ? 'on' : '') + '">Me</span></span>' + (p.quirk !== 'none' && !b.mine ? '<span class="q">' + esc(PS.QUIRKS[p.quirk].label) + '</span>' : '') + (inf.vip ? ' <span title="Host phone">\u2B50</span>' : '') + '<span class="cash">' + esc(inf.label || '') + '</span>';
    if (b._nh !== nh) { b._nh = nh; b.cell.querySelector('.n').innerHTML = nh; }
    var sh = 'Skill <em>' + p.skill + '</em> Smarts <em>' + p.smarts + '</em> React <em>' + p.reaction + '</em> <em>' + PS.temperLabel(p.temper) + '</em> ' + (b.orient === 'landscape' ? '\u25AD' : '\u25AF') + (p.orient === 'switch' ? '\u21BB' : '') +
      (s ? ' \u00b7 taps ' + s.taps + (s.misses ? ' (' + s.misses + ' missed)' : '') + (b.h.avgReact() ? ' \u00b7 ~' + (b.h.avgReact() / 1000).toFixed(1) + 's' : '') : '');
    if (b._sh !== sh) { b._sh = sh; b.cell.querySelector('.s').innerHTML = sh; }
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
    fitViewport();
    var tvb = $('tvBox'), f = tvb.querySelector('iframe'); if (f && !(run && run.zoom === 'tv')) { var k = tvb.clientWidth / G().tv.w; f.style.transform = 'scale(' + k + ')'; f.style.left = f.style.top = '0'; }
    if (!run) return;
    if (run.zoom) sizeZoom();
    if (MOB) { run.bots.forEach(sizePhone); return; }
    var gr = $('grid'), W = gr.clientWidth - 20, H = gr.clientHeight - 20, lo = 0.12, hi = 1.2;
    for (var it = 0; it < 22; it++) { var m = (lo + hi) / 2; if (fits(m, W, H)) lo = m; else hi = m; }
    run.scale = lo; run.bots.forEach(sizePhone);
  }
  function sizePhone(b) {
    if (!run) return; var s = run.scale || 0.4, d = dims(b);
    b.cell.classList.toggle('land', b.orient === 'landscape');
    if (run.zoom === b) return;
    if (MOB) { var gw = $('grid').clientWidth - 12, colW = (gw - 10) / 2 - 12; s = b.orient === 'landscape' ? (gw - 12) / d.w : colW / d.h * d.h / d.w; s = Math.max(0.1, s); b.ph.style.width = ''; }
    b.scr.style.width = Math.round(d.w * s) + 'px'; b.scr.style.height = Math.round(d.h * s) + 'px';
    if (!MOB) b.cell.style.width = Math.max(d.w * s + 12, PH.minCapW) + 'px'; else b.cell.style.width = '';
    b.scr.style.left = b.scr.style.top = '';
    if (b.frame) { b.frame.style.width = d.w + 'px'; b.frame.style.height = d.h + 'px'; b.frame.style.transform = 'scale(' + s + ')'; }
  }
  window.addEventListener('resize', function () { clearTimeout(layout._t); layout._t = setTimeout(layout, 100); });

  // ------------------------------------------------------------------ v0.2 zoom: one phone (or the TV) fills the window
  // Nothing is moved in the DOM (moving an iframe reloads it): the phone box just becomes position:fixed full screen,
  // so every other iframe keeps running underneath. The yellow tab (or Esc) zooms back out.
  function zoomTo(t) {
    if (!run) return;
    if (run.zoom && run.zoom !== t) zoomOut(true);
    run.zoom = t; document.body.classList.add('zoom'); $('drawer').classList.remove('open');
    if (t === 'tv') $('tvBox').classList.add('zoomed');
    else { t.ph.classList.add('zoomed'); t.ph.classList.toggle('mine', !!t.mine); }
    $('zTab').hidden = false; $('zTab').title = t === 'tv' ? 'Back to the panel (TV)' : (t.mine ? 'Back to the panel (your phone)' : 'Back to the panel (watching ' + t.p.name + ')');
    sizeZoom();
    addLog(t === 'tv' ? null : t, t === 'tv' ? 'Zoomed in on the TV' : t.mine ? 'you zoom into your phone' : 'zoomed in to watch (autopilot still playing)', 'sys');
  }
  function zoomOut(quiet) {
    if (run && run.fullTv && document.fullscreenElement && document.exitFullscreen) { run.fullTv = false; document.exitFullscreen().catch(function () {}); }
    if (!run || !run.zoom) return; var t = run.zoom; run.zoom = null;
    document.body.classList.remove('zoom'); $('zTab').hidden = true;
    if (t === 'tv') $('tvBox').classList.remove('zoomed'); else { t.ph.classList.remove('zoomed', 'full'); t.scr.style.position = ''; }
    if (!quiet) layout(); else { if (t !== 'tv') sizePhone(t); }
  }
  function sizeZoom() {
    var t = run.zoom, v = viewport();
    if (t === 'tv') {
      $('zTab').style.top = $('zTab').style.right = '';
      var f = run.tv, A = G(), k = Math.min(v.W / A.tv.w, v.H / A.tv.h);
      f.style.transform = 'scale(' + k + ')'; f.style.left = Math.round((v.W - A.tv.w * k) / 2) + 'px'; f.style.top = Math.round((v.H - A.tv.h * k) / 2) + 'px';
      return;
    }
    var full = MOB || v.W < 900;      // phone: the controller fills the screen at its real size; desktop: the phone, as big as fits
    t.ph.classList.toggle('full', full);
    if (!t.frame) return;
    var zt = $('zTab'); zt.style.top = zt.style.right = ''; t.scr.style.marginTop = '';
    if (full) { var w = Math.round(v.W), h = Math.round(v.H - 14); t.scr.style.width = w + 'px'; t.scr.style.height = h + 'px'; t.frame.style.width = w + 'px'; t.frame.style.height = h + 'px'; t.frame.style.transform = 'none'; }
    else { var d = dims(t), s = Math.min((v.H - 40) / d.h, (v.W - 40) / d.w); t.scr.style.width = Math.round(d.w * s) + 'px'; t.scr.style.height = Math.round(d.h * s) + 'px'; t.frame.style.width = d.w + 'px'; t.frame.style.height = d.h + 'px'; t.frame.style.transform = 'scale(' + s + ')';
      var sw = Math.round(d.w * s), shh = Math.round(d.h * s), lft = (v.W - sw) / 2, tp = (v.H - shh) / 2; zt.style.top = Math.max(0, tp - 22) + 'px'; zt.style.right = Math.max(4, v.W - (lft + sw) - 10) + 'px'; }
  }
  $('zTab').addEventListener('click', function () { zoomOut(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && run && run.zoom) zoomOut(); });

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


  function paintTvScores(ti) {
    var el = $('tvScores'); if (!el) return;
    var list = (ti && ti.ok && ti.players) ? ti.players : [];
    if (!list.length || ti.phase === 'lobby') { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = list.map(function (q) {
      var cash = (q.cash != null) ? ('$' + Math.round(q.cash).toLocaleString('en-US')) : '';
      var cls = 'sc' + (ti.turnPid === q.id ? ' cur' : '') + (q.bankrupt ? ' out' : '');
      var col = q.color || '#ffd23f';
      return '<div class="' + cls + '" style="--c:' + col + '"><b>' + esc(q.name) + '</b><span>' + (q.bankrupt ? 'BUST' : cash) + '</span>' + (q.ai ? '<div class="tag">AI</div>' : '') + '</div>';
    }).join('');
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
      paintTvScores(ti);
      if (ti.phase === 'lobby' && !run.forced && run.readyAt && now - run.readyAt > 4000 / cfg.speed && cfg.host !== 'me' && run.bots.some(function (b) { return b.mine && b.info && b.info.vip; }) && wantStart()) { run.forced = true; addLog(null, 'Your seat is the host: starting the game from the TV (or tap START GAME on your phone)', 'sys'); A.forceStart(tw); }
      if (ti.phase === 'lobby' && cfg.host === 'me' && run.startReq && !run.forced && ti.players && ti.players.length) { run.forced = true; addLog(null, 'Host = Me: starting the game from the TV', 'sys'); A.forceStart(tw); }
      if (ti.phase === 'lobby' && cfg.host !== 'me' && run.bots.every(function (b) { return b.left || (b.pilot && b.pilot.ready()); }) && run.readyAt && wantStart() && now - run.readyAt > 30000 / cfg.speed && !run.forced) { run.forced = true; addLog(null, 'Host phone never started: starting from the TV', 'sys'); A.forceStart(tw); }
    }
    if (ti.ok && ti.phase === 'lobby' && !run.catchSet && G().setCatch) { run.catchSet = true; try { G().setCatch(tw, PACE[cfg.pace].catchSec); } catch (e) {} }
    if (ti.phase === 'play' || ti.phase === 'over') run.catchSet = false;
    updStartBtn(ti);
    // bots
    run.bots.forEach(function (b) {
      if (b.left) return;
      if (!b.frame) { if (run.online && now >= b.arriveAt) spawn(b); return; }
      if (!b.pilot) return;
      var w = b.frame.contentWindow;
      if (b.mine) { b.pending = null; if (!b.capMine) { b.capMine = 1; } return; }
      if (b.p.orient === 'switch' && now >= b.nextFlip && run.zoom !== b) { b.nextFlip = now + (40000 + Math.random() * 80000) / cfg.speed; b.orient = b.orient === 'portrait' ? 'landscape' : 'portrait'; addLog(b, 'turns the phone ' + (b.orient === 'landscape' ? 'sideways' : 'upright')); setCap(b, b.orient === 'landscape' ? 'turns the phone sideways' : 'turns the phone upright', 'act'); layout(); }
      if (b.pending) { if (now >= b.pending.at) { var pd = b.pending; b.pending = null; try { pd.fn(); } catch (e) { addLog(b, 'autopilot error: ' + e.message, 'miss'); } } return; }
      if (b.h.away(now)) { setCap(b, b.h.lapseNote, 'idle'); return; }
      try { b.pilot.tick(now); } catch (e) { addLog(b, 'autopilot error: ' + e.message, 'miss'); b.pending = { at: now + 2000, fn: function () {} }; }
    });
    // stat strips + turn glow (cheap, ~3 times a second)
    if (!run.capT || now - run.capT > 330) { run.capT = now; run.bots.forEach(function (b) { if (!b.frame || !b.pilot) return; try { b.info = A.phoneInfo(b.frame.contentWindow); } catch (e) { b.info = {}; } b.ph.classList.toggle('turn', !!b.info.myTurn); paintCap(b); }); }
  }, 100);
  function updStartBtn(ti) {
    var show = !!run && (cfg.hold || cfg.host === 'me') && !run.startReq && run.phase !== 'play' && run.phase !== 'over';
    if ($('bStartGame').hidden === show) $('bStartGame').hidden = !show;
  }

  // ------------------------------------------------------------------ test / dev hook
  window.ZTPSim = {
    cfg: cfg, people: people, start: start, stop: stop, setPaused: setPaused, setSpeed: setSpeed, layout: layout,
    state: function () {
      if (!run) return null; var ti = {}; try { ti = G().tvInfo(run.tv.contentWindow); } catch (e) {}
      return { code: run.code, online: run.online, phase: ti.phase, round: ti.round, turns: run.turns, paused: run.paused, errors: run.errors.slice(), simMs: simNow(), events: run.events.length,
        zoom: run.zoom === 'tv' ? 'tv' : run.zoom ? run.zoom.i : null, mob: MOB, host: cfg.host, pace: cfg.pace, phoneSfx: cfg.phoneSfx, Z: Z,
        bots: run.bots.map(function (b) { return { name: b.p.name, mine: !!b.mine, orient: b.orient, joined: b.joined, ready: !!(b.pilot && b.pilot.ready()), cap: b.capTxt, stats: b.h ? b.h.stats : null, info: b.info, left: !!b.left, sound: audible(b), sfxHits: b.sfxN || 0 }; }) };
    },
    events: function () { return run ? run.events.slice() : []; },
    zoomTo: function (i) { if (run) zoomTo(i === 'tv' ? 'tv' : run.bots[i]); }, zoomOut: function () { zoomOut(); }, setMine: function (i, on) { if (run && run.bots[i]) setMine(run.bots[i], on); }
  };
  renderCards();
  if (Q.has('auto')) setTimeout(start, 300);
})();
