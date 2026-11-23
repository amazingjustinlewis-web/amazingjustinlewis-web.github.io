/* Zero to Phi · 0-Phi Room venue simulator v0.3
   v0.2 hangout, plus a living agent sim: patrons arrive, check coats, eat, drink,
   play, ride the pod, browse and leave; servers run orders; the band takes breaks.
   Time base is a single sim clock (v0.2 mixed Date.now with rAF and froze people).
   Drag-pan keeps the 16:9 screen logo mapped to the screen face. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search);
  var PS = window.ZTPPersonas, GAMES = window.ZTPSimGames || {}, MUS = window.ZTPVenueMusic, SCR = window.ZTPVenueScreens;
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var TYPES = ['curious', 'shy', 'competitive', 'drinking'];
  var TYPE_EMOTE = { curious: '\u{1F440}', shy: '\u{1F647}', competitive: '\u{1F525}', drinking: '\u{1F37A}' };
  var EM = { cheers: '\u{1F37A}', clap: '\u{1F44F}', cake: '\u{1F382}', eyes: '\u{1F440}', notes: '\u{1F3B5}', fire: '\u{1F525}', wow: '\u{1F62E}', laugh: '\u{1F602}', party: '\u{1F389}', phone: '\u{1F4F1}', heart: '\u{2764}\u{FE0F}', dash: '\u{1F4A8}', trophy: '\u{1F3C6}', food: '\u{1F37D}\u{FE0F}', check: '\u{2713}', coat: '\u{1F9E5}' };
  var ICO = { drink: '\u{1F378}', food: '\u{1F37D}\u{FE0F}', check: '\u{2713}', notes: '\u{1F3B5}' };

  var PRESETS = {
    dive:    { name: 'Dive bar', music: 'alley', mix: { curious: 0.18, shy: 0.14, competitive: 0.16, drinking: 0.52 }, crowd: 0.85, drinks: 1.25, dance: 0.6 },
    lounge:  { name: 'Classy lounge', music: 'goldhour', mix: { curious: 0.34, shy: 0.36, competitive: 0.12, drinking: 0.18 }, crowd: 0.55, drinks: 0.7, dance: 0.5 },
    arcade:  { name: 'Arcade bar', music: 'phipulse', mix: { curious: 0.4, shy: 0.1, competitive: 0.35, drinking: 0.15 }, crowd: 0.9, drinks: 0.9, dance: 0.8 },
    sports:  { name: 'Sports bar', music: 'stomp', mix: { curious: 0.2, shy: 0.1, competitive: 0.35, drinking: 0.35 }, crowd: 0.95, drinks: 1.2, dance: 0.5 },
    concert: { name: 'Concert night', music: 'neon', mix: { curious: 0.22, shy: 0.1, competitive: 0.16, drinking: 0.52 }, crowd: 1.15, drinks: 1.1, dance: 1.85 }
  };

  var cfg = {
    preset: PRESETS[Q.get('preset')] ? Q.get('preset') : 'arcade',
    crowd: Math.max(6, Math.min(36, +(Q.get('crowd') || 16))),
    arrive: Math.max(1, Math.min(10, +(Q.get('arrive') || 5))),
    curiosity: Math.max(0, Math.min(10, +(Q.get('cur') || 6))),
    compete: Math.max(0, Math.min(10, +(Q.get('comp') || 5))),
    drinks: Math.max(0, Math.min(10, +(Q.get('drink') || 5))),
    band: Math.max(0, Math.min(10, +(Q.get('band') || 6))),
    speed: Math.max(1, Math.min(10, +(Q.get('speed') || 5))),
    muted: Q.has('mute') || Q.has('shot') ? true : true,
    labels: Q.get('labels') === '0' ? false : true
  };

  var rng = (PS && PS.rng) ? PS.rng(Q.get('seed') || Date.now() % 99991) : Math.random;
  function r() { return rng(); }
  function pick(a) { return a[Math.floor(r() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // One sim clock. All since / until / arrival times use simNow (ms).
  var OPEN = 19 * 60, CLOSE = 26 * 60;
  var venueMin = OPEN, paused = false, closed = false, recapShown = false;
  var lastTs = performance.now(), simNow = 0;
  function speedRate() { return 0.55 + cfg.speed * 0.35; }
  function minPerSec() { return 0.45 + cfg.speed * 0.72; }
  function clockLabel() {
    var m = Math.floor(venueMin) % (24 * 60), h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (!h12) h12 = 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  function rush() {
    var h = venueMin / 60;
    if (h >= 20 && h < 21.5) return 1.75;
    if (h >= 23 && h < 24.6) return 1.7;
    if (h >= 19 && h < 20) return 0.7;
    if (h >= 25 && h < 26) return 0.3;
    return 1;
  }
  function isRush() { var x = rush(); return x > 1.2; }
  function isLastCall() { return venueMin >= 25 * 60; }

  var stats = { joinedHour: 0, hourMark: 19, podRides: 0, gamesRdr: 0, gamesBub: 0, gamesOrb: 0, peak: 0, winners: [], events: { birthday: 0, tournament: 0, flicker: 0 }, busiest: { rdr: 0, bubble: 0, orbit: 0, pod: 0 }, orders: 0 };
  var logEl = $('log');
  function log(text, kind) {
    if (!logEl) return;
    var d = document.createElement('div'); d.className = kind || '';
    d.textContent = clockLabel() + ' · ' + text;
    logEl.insertBefore(d, logEl.firstChild);
    while (logEl.childNodes.length > 48) logEl.removeChild(logEl.lastChild);
  }

  var KEEP = ['rdr_name', 'rdr_room', 'rdr_char', 'rdr_setup', 'rdr_phonehost', 'rdr_client', 'rdr_stuffView', 'rdr_moved'], saved = {};
  KEEP.forEach(function (k) { try { saved[k] = localStorage.getItem(k); } catch (e) {} });
  function clearShared() { ['rdr_char', 'rdr_setup', 'rdr_phonehost', 'rdr_moved'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); }
  function restoreShared() { KEEP.forEach(function (k) { try { if (saved[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]); } catch (e) {} }); }

  var myName = (function () { try { return localStorage.getItem('rdr_name') || ''; } catch (e) { return ''; } })() || 'Justin';

  // Floor furniture in the same % space as people (v0.2 tables lived in a sub-box and drifted from seats).
  var TABLE_SPOTS = [
    { id: 't0', x: 26, y: 34, name: 'table 1', kind: 'cocktail' },
    { id: 't1', x: 38, y: 30, name: 'table 2', kind: 'cocktail' },
    { id: 't2', x: 24, y: 48, name: 'table 3', kind: 'cocktail' },
    { id: 't3', x: 36, y: 46, name: 'table 4', kind: 'cocktail' },
    { id: 'oval', x: 65, y: 52, name: 'the oval table', kind: 'oval', r: 6.2 }
  ];
  var BAND_KIT = [
    { part: 'drums', cls: 'drum', name: 'Drummer', ico: '\u{1F941}' },
    { part: 'bass', cls: 'guitar', name: 'Bassist', ico: '\u{1F3B8}' },
    { part: 'keys', cls: 'keys', name: 'Keys', ico: '\u{1F3B9}' },
    { part: 'vox', cls: 'vox', name: 'Singer', ico: '\u{1F3A4}' }
  ];

  (function setupFurniture() {
    var b = $('bottles'), cols = ['#5ef2c8', '#ffd23f', '#ff6a9a', '#7aa8ff', '#ff9d3f', '#b98cff', '#8be36b', '#ff5a5a', '#fff'];
    for (var i = 0; i < 9; i++) { var el = document.createElement('i'); el.style.setProperty('--c', cols[i]); b.appendChild(el); }
    var st = $('stools');
    for (i = 0; i < 6; i++) { var s = document.createElement('div'); s.className = 'stool'; st.appendChild(s); }
    var tb = $('tables');
    TABLE_SPOTS.forEach(function (p) {
      if (p.kind === 'oval') return;
      var t = document.createElement('div'); t.className = 'tbl'; t.style.left = p.x + '%'; t.style.top = p.y + '%';
      [[-26, 0], [26, 0], [0, -26], [0, 26]].forEach(function (c) {
        var ch = document.createElement('div'); ch.className = 'chair'; ch.style.left = 'calc(50% + ' + c[0] + 'px)'; ch.style.top = 'calc(50% + ' + c[1] + 'px)'; t.appendChild(ch);
      });
      tb.appendChild(t);
    });
    var band = $('band');
    for (i = 0; i < BAND_KIT.length; i++) {
      var m = document.createElement('div'); m.className = 'bando play ' + BAND_KIT[i].cls;
      m.setAttribute('data-part', BAND_KIT[i].part);
      m.title = BAND_KIT[i].name;
      m.innerHTML = '<div class="kit">' + BAND_KIT[i].ico + '</div><div class="arms"><i class="arm-l"></i><i class="arm-r"></i></div><div class="head"></div><div class="body"></div>';
      band.appendChild(m);
    }
    if ($('bandstand')) $('bandstand').classList.add('lit');
  })();

  if (MUS && MUS.onBeat) MUS.onBeat(function () {
    var n = $('band').children, e = cfg.band / 10;
    for (var i = 0; i < n.length; i++) {
      if (n[i].classList.contains('away')) continue;
      if (Math.random() < 0.35 + e * 0.6) {
        n[i].classList.add('beat');
        (function (el) { setTimeout(function () { el.classList.remove('beat'); }, 140); })(n[i]);
      }
    }
  });

  // ------------------------------------------------------------------ screens
  var adReel = new SCR.AdReel($('adCanvas'));
  var podFlight = new SCR.Flight($('podCanvas'));
  var wallFlight = new SCR.Flight($('wallPod'));
  var orbMini = new SCR.MiniOrbit($('orbMini'));
  podFlight.start(); wallFlight.start();
  var wallMode = 'site'; // site | game | ads | pod | auto-pod
  var wallForced = false;
  function setWall(mode, silent) {
    wallMode = mode;
    $('siteFrame').hidden = mode !== 'site' && mode !== 'game';
    $('adCanvas').hidden = mode !== 'ads';
    $('wallPod').hidden = mode !== 'pod';
    if (mode === 'ads') adReel.start(); else adReel.stop();
    var lab = { site: '0-\u03a6 site', game: 'Red Deer Rich', ads: 'Local business demo', pod: 'GyroForge cam' }[mode] || mode;
    $('screenLbl').textContent = lab;
    document.querySelectorAll('#screenPick button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === mode); });
    if (mode === 'site' && !$('siteFrame').src) $('siteFrame').src = '../../index.html';
    if (mode === 'game') hookWallGame();
    if (!silent) log('Wall screen: ' + lab, 'sys');
  }
  function hookWallGame() {
    if (!rdr.run || !rdr.build) return;
    var url = new URL('../rdr-phone/' + rdr.build.tv + '?viewer=' + rdr.run.code + '&local=1&mute=1', location.href).href;
    if ($('siteFrame').src !== url) $('siteFrame').src = url;
  }

  // ------------------------------------------------------------------ RDR station
  var rdr = { build: { ver: 'v0.7.8b', tv: 'index_v078b.html', phone: 'controller_v078b.html' }, run: null, bots: [], tv: null, phase: 'boot', games: 0 };
  function code4() { var s = ''; for (var i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function adapter() { return GAMES.rdr; }
  function pickBuild(done) {
    var cands = {
      '078b': { ver: 'v0.7.8b', tv: 'index_v078b.html', phone: 'controller_v078b.html' },
      '077b': { ver: 'v0.7.7b', tv: 'index_v077b.html', phone: 'controller_v077b.html' },
      '077': { ver: 'v0.7.7', tv: 'index_v077.html', phone: 'controller_v077.html' },
      '076': { ver: 'v0.7.6', tv: 'index_v076.html', phone: 'controller_v076.html' },
      '075': { ver: 'v0.7.5', tv: 'index_v075.html', phone: 'controller_v075.html' },
      '074': { ver: 'v0.7.4', tv: 'index_v074.html', phone: 'controller_v074.html' }
    };
    var want = Q.get('tv') || '078b';
    var pick = cands[want] || cands['078b'] || cands['077b'];
    var fallback = cands['078b'] || cands['077b'] || cands['077'] || cands['076'];
    fetch('../rdr-phone/' + pick.tv, { method: 'HEAD' }).then(function (res) {
      if (res.ok) done(pick); else done(fallback);
    }).catch(function () { done(fallback); });
  }
  function mountScaled(box, url, w, h, pe) {
    box.innerHTML = '';
    var f = document.createElement('iframe');
    f.width = w; f.height = h;
    f.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;border:0;transform-origin:0 0;pointer-events:' + (pe ? 'auto' : 'none');
    f.setAttribute('allow', 'autoplay'); f.src = url;
    box.appendChild(f);
    function fit() { var s = Math.min((box.clientWidth || 1) / w, (box.clientHeight || 1) / h); f.style.transform = 'scale(' + (s || 0.1) + ')'; }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
    window.addEventListener('resize', fit);
    return f;
  }
  function startRdr() {
    var A = adapter(); if (!A) { log('Red Deer Rich adapter missing — TV is a stand-in', 'sys'); return; }
    clearShared();
    rdr.run = { code: code4(), t0: Date.now(), online: false, readyAt: 0, forced: false, lastPhase: 'boot' };
    var o = { code: rdr.run.code, local: true, speed: 1, length: 'quick' };
    var url = '../rdr-phone/' + rdr.build.tv + '?room=' + o.code + '&mute=1&local=1&sim=1';
    rdr.tv = mountScaled($('rdrTv'), url, 1920, 1080, false);
    rdr.tv.addEventListener('load', function () {
      try { A.muteTv(rdr.tv.contentWindow, true); A.setSpeed(rdr.tv.contentWindow, 1.15); } catch (e) {}
    });
    log('Red Deer Rich TV on, room ' + rdr.run.code + ' (this browser only)', 'sys');
  }
  function rdrOpts() { return { code: rdr.run.code, local: true, speed: 1, length: 'quick' }; }
  function phoneUrl(p) {
    return '../rdr-phone/' + rdr.build.phone + '?room=' + rdr.run.code + '&auto=1&name=' + encodeURIComponent(p.name) + '&cid=' + encodeURIComponent('ven-' + p.id + '-' + rdr.run.code) + '&local=1&sim=1';
  }
  function rdrApi(bot) {
    var A = adapter();
    return {
      win: function () { return bot.frame && bot.frame.contentWindow; },
      speed: function () { return 1.15; },
      rotate: function () {},
      tap: function (el, what) { return rdrTap(bot, el, what); },
      plan: function (delay, cap, fn) { bot.pending = { at: Date.now() + delay, fn: fn, cap: cap }; },
      idle: function () {}, caption: function () {},
      log: function (txt) { if (r() < 0.35) log(bot.p.name + ' · ' + txt, 'ai'); },
      ctx: {
        solo: function () { return rdr.bots.filter(function (b) { return !b.left; }).length === 1; },
        hostMode: function () { return 'ai'; },
        catchSec: function () { return 5; },
        length: function () { return 'quick'; },
        autoReplay: function () { return false; },
        wantStart: function () { return rdrWantStart(); },
        startNote: function () { return rdrWantStart() ? 'starting\u2026' : 'waiting\u2026'; }
      }
    };
  }
  function rdrTap(bot, el, what) {
    if (!el) return false;
    try {
      var rct = el.getBoundingClientRect(), x = rct.left + rct.width / 2, y = rct.top + rct.height / 2;
      var w = bot.frame.contentWindow, d = w.document;
      ['pointerdown', 'pointerup', 'click'].forEach(function (type) {
        var ev = new w.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' });
        el.dispatchEvent(ev);
      });
      return true;
    } catch (e) { return false; }
  }
  function rdrWantStart() {
    var live = rdr.bots.filter(function (b) { return !b.left && !b.mine; });
    var me = rdr.bots.filter(function (b) { return !b.left && b.mine; });
    if (live.length + me.length < 2) { rdr.run.readyAt = 0; return false; }
    var all = rdr.bots.every(function (b) { return b.left || b.mine || (b.pilot && b.pilot.ready()); });
    if (!all) { rdr.run.readyAt = 0; return false; }
    if (!rdr.run.readyAt) rdr.run.readyAt = Date.now();
    return Date.now() - rdr.run.readyAt > 2800;
  }
  function spawnRdrPhone(person, mine) {
    if (!rdr.run || !adapter()) return false;
    if (rdr.bots.filter(function (b) { return !b.left; }).length >= 4) return false;
    var A = adapter();
    var bot = { p: person, mine: !!mine, left: false, frame: null, chip: null, pilot: null, h: null, pending: null, joined: false };
    var chip = document.createElement('div'); chip.className = 'phonechip';
    var f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;left:0;top:0;width:390px;height:844px;border:0;transform-origin:0 0;transform:scale(' + (18 / 390) + ');pointer-events:none';
    f.setAttribute('allow', 'autoplay');
    var who = mine ? { id: person.id + 'me', name: myName } : person;
    f.src = phoneUrl(who);
    chip.appendChild(f); $('phones').appendChild(chip);
    bot.frame = f; bot.chip = chip;
    f.addEventListener('load', function () {
      var w = f.contentWindow; if (!w || w.location.href === 'about:blank') return;
      try { A.mutePhone(w, true); } catch (e) {}
      bot.h = new PS.Human(person, function () { return 1.15; });
      if (!mine) bot.pilot = A.pilot(person, bot.h, rdrApi(bot));
      bot.joined = true;
      stats.joinedHour++; stats.busiest.rdr++;
      log((mine ? myName : person.name) + ' scanned in at Red Deer Rich', mine ? 'ev' : '');
    });
    rdr.bots.push(bot); person.bot = bot; person.playing = 'rdr';
    return bot;
  }
  function dropRdrPhone(bot, why) {
    if (!bot || bot.left) return;
    bot.left = true; bot.pilot = null; bot.pending = null;
    try { bot.frame.src = 'about:blank'; } catch (e) {}
    try { bot.chip.remove(); } catch (e) {}
    if (bot.p) { bot.p.bot = null; bot.p.playing = null; }
  }
  function tickRdr(now) {
    var A = adapter(); if (!A || !rdr.run || !rdr.tv) return;
    var w = rdr.tv.contentWindow, ti = { ok: false };
    try { ti = A.tvInfo(w) || { ok: false }; } catch (e) {}
    if (ti.ok && ti.online && !rdr.run.online) {
      rdr.run.online = true; if (ti.code) rdr.run.code = ti.code;
      log('Room ' + rdr.run.code + ' is open', 'sys');
      if (wallMode === 'game') hookWallGame();
    }
    if (ti.ok && ti.phase && ti.phase !== rdr.run.lastPhase) {
      if (rdr.run.lastPhase === 'play' && ti.phase !== 'play') {
        rdr.games++; stats.gamesRdr++;
        var win = (ti.players || []).slice().sort(function (a, b) { return (b.cash || 0) - (a.cash || 0); })[0];
        if (win) { stats.winners.push(win.name); log(win.name + ' took the Red Deer Rich table ' + EM.trophy, 'ev'); }
        // let them linger, then wander off
        setTimeout(function () {
          rdr.bots.forEach(function (b) { if (!b.left && b.p && !b.mine) { b.p.playing = null; b.p.state = 'wander'; dropRdrPhone(b); } });
        }, 4000);
      }
      if (ti.phase === 'play') log('Red Deer Rich is on', 'ev');
      rdr.run.lastPhase = ti.phase;
    }
    rdr.bots.forEach(function (b) {
      if (b.left || b.mine || !b.frame) return;
      if (b.pending && now >= b.pending.at) { var pd = b.pending; b.pending = null; try { pd.fn(); } catch (e) {} return; }
      if (b.pilot) try { b.pilot.tick(now); } catch (e) {}
    });
    if (ti.ok && ti.phase === 'lobby' && rdrWantStart() && !rdr.run.forced && Date.now() - rdr.run.readyAt > 8000) {
      rdr.run.forced = true; try { A.forceStart(w); log('The table tips itself off', 'sys'); } catch (e) {}
    }
    // reset forced when back in lobby after a game
    if (ti.ok && ti.phase === 'lobby' && rdr.bots.filter(function (b) { return !b.left; }).length < 2) rdr.run.forced = false;
    if (paused && ti.ok) try { A.setPaused(w, true); } catch (e) {}
  }




  // ------------------------------------------------------------------ collision / pathfinding (floor % coordinates)
  var OBST = [
    { id: 'coat', kind: 'rect', x: 2, y: 2, w: 9, h: 16, enter: ['toCoat', 'coat', 'leaveCoat'] },
    { id: 'merch', kind: 'rect', x: 12, y: 2, w: 9, h: 16, enter: ['merch'] },
    { id: 'band', kind: 'rect', x: 22, y: 2, w: 54, h: 13, enter: ['bandStage'] },
    { id: 'green', kind: 'rect', x: 86, y: 2, w: 12, h: 13, enter: ['toGreen', 'green'] },
    { id: 'wash', kind: 'rect', x: 2, y: 20, w: 14, h: 30, enter: ['wash'] },
    { id: 'food', kind: 'rect', x: 3, y: 58, w: 16, h: 16, enter: ['food', 'serveKit', 'cook'] },
    { id: 'bar', kind: 'rect', x: 85, y: 16, w: 13, h: 62, enter: ['serveBar', 'tender'] },
    { id: 'pod', kind: 'circle', x: 50, y: 47, r: 8, enter: ['toPod', 'pod', 'queuePod'] },
    { id: 'podcam', kind: 'rect', x: 60, y: 30, w: 14, h: 14, enter: [] },
    { id: 'rdr', kind: 'rect', x: 66, y: 68, w: 22, h: 22, enter: ['toRdr', 'playRdr', 'watchRdr'] },
    { id: 'bub', kind: 'rect', x: 36, y: 72, w: 22, h: 18, enter: ['toBub', 'playBub', 'watchBub'] },
    { id: 'orb', kind: 'rect', x: 14, y: 74, w: 18, h: 17, enter: ['toOrb', 'playOrb', 'watchOrb'] },
    { id: 't0', kind: 'circle', x: 26, y: 34, r: 4.2, enter: [] },
    { id: 't1', kind: 'circle', x: 38, y: 30, r: 4.2, enter: [] },
    { id: 't2', kind: 'circle', x: 24, y: 48, r: 4.2, enter: [] },
    { id: 't3', kind: 'circle', x: 36, y: 46, r: 4.2, enter: [] },
    { id: 'oval', kind: 'circle', x: 65, y: 52, r: 6.2, enter: [] }
  ];
  var GW = 40, GH = 34;
  function cellX(x) { return clamp(Math.round(x / 100 * (GW - 1)), 0, GW - 1); }
  function cellY(y) { return clamp(Math.round(y / 100 * (GH - 1)), 0, GH - 1); }
  function worldX(i) { return (i + 0.5) / GW * 100; }
  function worldY(j) { return (j + 0.5) / GH * 100; }
  function hitsObst(o, x, y, pad) {
    pad = pad || 0;
    if (o.kind === 'circle') return Math.hypot(x - o.x, y - o.y) < (o.r + pad);
    return x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad;
  }
  function canEnter(o, p) {
    if (!p) return false;
    if (p.role === 'tender' && o.id === 'bar') return true;
    if (p.role === 'cook' && o.id === 'food') return true;
    if (p.role === 'band' && (o.id === 'green' || o.id === 'band' || o.id === 'bar')) return true;
    if (p.role === 'server' && (o.id === 'bar' || o.id === 'food')) return true;
    return !!(o.enter && o.enter.indexOf(p.state) >= 0);
  }
  function blockedAt(x, y, p, pad) {
    if (x < 2 || x > 98 || y < 12 || y > 108) return true;
    for (var i = 0; i < OBST.length; i++) {
      if (hitsObst(OBST[i], x, y, pad || 0) && !canEnter(OBST[i], p)) return true;
    }
    return false;
  }
  function pushOut(p) {
    if (!blockedAt(p.x, p.y, p, 0.2)) return false;
    var best = null, i, d, k, a, nx, ny;
    for (d = 1; d <= 16; d += 1) {
      for (k = 0; k < 12; k++) {
        a = (k / 12) * Math.PI * 2;
        nx = p.x + Math.cos(a) * d; ny = p.y + Math.sin(a) * d;
        if (!blockedAt(nx, ny, p, 0.2)) { best = { x: nx, y: ny }; break; }
      }
      if (best) break;
    }
    if (best) { p.x = best.x; p.y = best.y; return true; }
    return false;
  }
  function bump(p) {
    if (!p.el) return;
    p.el.classList.remove('bump');
    void p.el.offsetWidth;
    p.el.classList.add('bump');
    setTimeout(function () { try { p.el.classList.remove('bump'); } catch (e) {} }, 300);
  }
  function walkableDest(x, y, p) {
    if (!blockedAt(x, y, p, 0.8)) return { x: x, y: y };
    for (var d = 2; d <= 14; d += 2) {
      for (var k = 0; k < 12; k++) {
        var a = (k / 12) * Math.PI * 2 + d;
        var nx = clamp(x + Math.cos(a) * d, 4, 96), ny = clamp(y + Math.sin(a) * d, 18, 94);
        if (!blockedAt(nx, ny, p, 0.8)) return { x: nx, y: ny };
      }
    }
    return { x: x, y: y };
  }
  function routeTo(p, tx, ty) {
    var dest = walkableDest(tx, ty, p);
    if (blockedAt(tx, ty, p, 0.2) === false || canEnterPath(p, tx, ty)) dest = { x: tx, y: ty };
    var si = cellX(p.x), sj = cellY(p.y), ei = cellX(dest.x), ej = cellY(dest.y);
    if (si === ei && sj === ej) return [{ x: dest.x, y: dest.y }];
    var open = [{ i: si, j: sj, g: 0, f: Math.abs(ei - si) + Math.abs(ej - sj) }];
    var came = {}, seen = {}, key0 = si + ',' + sj;
    seen[key0] = 0;
    var found = null, guard = 0, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length && guard++ < 800) {
      open.sort(function (a, b) { return a.f - b.f; });
      var cur = open.shift();
      if (cur.i === ei && cur.j === ej) { found = cur; break; }
      for (var d = 0; d < dirs.length; d++) {
        var ni = cur.i + dirs[d][0], nj = cur.j + dirs[d][1];
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        var wx = worldX(ni), wy = worldY(nj);
        var atEnd = ni === ei && nj === ej;
        if (!atEnd && blockedAt(wx, wy, p, 0.7)) continue;
        if (atEnd && blockedAt(wx, wy, p, 0.2) && blockedAt(dest.x, dest.y, p, 0.2) && !canEnterPath(p, dest.x, dest.y)) continue;
        var g = cur.g + (dirs[d][0] && dirs[d][1] ? 1.4 : 1);
        var key = ni + ',' + nj;
        if (seen[key] != null && seen[key] <= g) continue;
        seen[key] = g;
        came[key] = cur.i + ',' + cur.j;
        open.push({ i: ni, j: nj, g: g, f: g + Math.abs(ei - ni) + Math.abs(ej - nj) });
      }
    }
    var path = [{ x: dest.x, y: dest.y }];
    if (found) {
      var k = ei + ',' + ej, pts = [];
      while (k && k !== key0) {
        var ij = k.split(',');
        pts.push({ x: worldX(+ij[0]), y: worldY(+ij[1]) });
        k = came[k];
      }
      pts.reverse();
      path = pts.concat([{ x: dest.x, y: dest.y }]);
    }
    return path;
  }
  function canEnterPath(p, x, y) {
    for (var i = 0; i < OBST.length; i++) if (hitsObst(OBST[i], x, y, 0.2) && canEnter(OBST[i], p)) return true;
    return false;
  }
  function setPath(p, x, y) {
    p.gx = x; p.gy = y;
    p.path = routeTo(p, x, y) || [{ x: x, y: y }];
    p.pi = 0;
    p.tx = p.path[0].x; p.ty = p.path[0].y;
  }
  function peopleHits() {
    var n = 0;
    people.forEach(function (p) {
      if (p.role && p.role !== 'patron') return;
      if (blockedAt(p.x, p.y, p, 0.15)) n++;
    });
    return n;
  }


  // ------------------------------------------------------------------ people + staff
  var people = [];
  var pid = 0, usedNames = {};
  var stools = [0, 1, 2, 3, 4, 5].map(function (i) { return { i: i, x: 80, y: 28 + i * 9, who: null }; });
  var seats = [];
  TABLE_SPOTS.forEach(function (t) {
    var rad = t.kind === 'oval' ? 7.4 : 5.6, n = t.kind === 'oval' ? 6 : 4;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      seats.push({ x: t.x + Math.cos(a) * rad, y: t.y + Math.sin(a) * rad, who: null, table: t });
    }
  });
  var washBusy = [false, false];
  var coatCount = 0;
  var orders = []; // {id, patron, kind, table, stage, server}

  function isPatron(p) { return p && (p.role === 'patron' || !p.role); }
  function patrons() { return people.filter(isPatron); }
  function mixType() {
    var m = PRESETS[cfg.preset].mix, x = r(), a = m.curious, b = a + m.shy, c = b + m.competitive;
    return x < a ? 'curious' : x < b ? 'shy' : x < c ? 'competitive' : 'drinking';
  }
  function paintCoats() {
    var rack = document.querySelectorAll('#coat .rack i');
    for (var i = 0; i < rack.length; i++) rack[i].classList.toggle('hung', i < Math.min(coatCount, rack.length));
  }
  function activityLabel(p) {
    if (p.role === 'server') {
      if (p.job === 'take') return 'taking order';
      if (p.job === 'fetch') return p.fetchKind === 'food' ? 'to the kitchen' : 'to the bar';
      if (p.job === 'deliver') return 'serving';
      return 'waiting for a table';
    }
    if (p.role === 'tender') return p.busyUntil > simNow ? 'pouring' : 'behind the bar';
    if (p.role === 'cook') return p.busyUntil > simNow ? 'plating' : 'in the kitchen';
    if (p.role === 'band') return p.state === 'green' || p.state === 'toGreen' ? 'on break' : (p.state === 'bar' ? 'on break' : 'on stage');
    var st = p.state;
    if (st === 'enter' || st === 'toCoat') return p.coat ? 'arriving' : 'checking a coat';
    if (st === 'coat') return 'checking a coat';
    if (st === 'leaveCoat' || st === 'leave') return 'leaving';
    if (st === 'bar') return p.waiting ? 'ordering' : 'at the bar';
    if (st === 'sit') return p.waiting ? 'ordering' : (p.need === 'food' ? 'eating' : (p.drink ? 'sipping' : 'sitting'));
    if (st === 'watch') return 'watching the band';
    if (st === 'dance') return 'dancing';
    if (st === 'wash') return 'washroom';
    if (st === 'food') return 'at the kitchen';
    if (st === 'merch') return 'browsing merch';
    if (st === 'chat') return 'chatting';
    if (st === 'toRdr' || st === 'playRdr' || st === 'watchRdr') return st === 'playRdr' ? 'playing' : (st === 'watchRdr' ? 'watching a game' : 'to the arcade');
    if (st === 'toBub' || st === 'playBub' || st === 'watchBub') return st === 'playBub' ? 'playing' : (st === 'watchBub' ? 'watching a game' : 'to the arcade');
    if (st === 'toOrb' || st === 'playOrb' || st === 'watchOrb') return st === 'playOrb' ? 'playing' : (st === 'watchOrb' ? 'watching a game' : 'to the arcade');
    if (st === 'toPod') return 'to the pod';
    if (st === 'queuePod') return 'in the pod line';
    if (st === 'pod') return 'riding the pod';
    if (st === 'wander') return 'wandering';
    return st || '';
  }
  function setBubble(p, ch) {
    if (!p.el) return;
    var b = p.el.querySelector('.bubble');
    if (!ch) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'bubble'; p.el.appendChild(b); }
    b.textContent = ch;
  }
  function makePerson(atDoor, group, opts) {
    opts = opts || {};
    var persona = PS ? PS.make(pid, r, usedNames) : { id: 'p' + pid, name: 'Guest' + pid, look: '', color: '#ffd23f' };
    pid++;
    var p = {
      id: persona.id || ('p' + pid), name: opts.name || persona.name, look: persona.look || '', color: opts.color || persona.color || '#ffd23f',
      type: opts.type || mixType(), x: 50 + (r() - 0.5) * 6, y: 102, tx: 50, ty: 90, state: 'enter', since: simNow,
      drink: 0, playing: null, bot: null, seat: null, stool: null, wash: -1, rideUntil: 0, group: group || 0,
      mine: false, wob: r() * 6, el: null, role: opts.role || 'patron', spd: 0.75 + r() * 0.55,
      coat: !atDoor, waiting: false, need: null, pauseUntil: 0, job: null, fetchKind: null, order: null,
      part: opts.part || null, stageEl: opts.stageEl || null
    };
    if (!atDoor) { p.x = 20 + r() * 60; p.y = 30 + r() * 50; p.state = 'wander'; p.since = simNow; pushOut(p); }
    var el = document.createElement('div');
    el.className = 'person' + (p.role !== 'patron' ? ' ' + p.role : '');
    el.style.setProperty('--c', p.color);
    el.innerHTML = '<div class="shadow"></div><div class="body"></div><div class="head">' + (p.look || '') + '</div><div class="nam">' + p.name + '</div><div class="act"></div>' + (p.role === 'server' ? '<div class="tray"></div>' : '');
    $('actors').appendChild(el); p.el = el;
    people.push(p);
    if (!atDoor) pushOut(p);
    if (p.role === 'patron' && !atDoor) pickDest(p);
    return p;
  }
  function removePerson(p) {
    if (p.bot) dropRdrPhone(p.bot);
    if (p.seat) p.seat.who = null;
    if (p.stool) p.stool.who = null;
    if (p.wash >= 0) washBusy[p.wash] = false;
    if (p.playing === 'pod') endPod(p);
    if (p.order) { p.order.cancelled = true; p.order = null; }
    if (p.coat && isPatron(p) && coatCount > 0) { coatCount--; paintCoats(); }
    try { p.el.remove(); } catch (e) {}
    people = people.filter(function (q) { return q !== p; });
  }
  function emote(p, ch) {
    var e = document.createElement('div'); e.className = 'emote'; e.textContent = ch;
    e.style.left = p.x + '%'; e.style.top = p.y + '%';
    $('emotes').appendChild(e);
    setTimeout(function () { try { e.remove(); } catch (err) {} }, 1500);
  }
  function freeSeat() { for (var i = 0; i < seats.length; i++) if (!seats[i].who) return seats[i]; return null; }
  function freeStool() { for (var i = 0; i < stools.length; i++) if (!stools[i].who) return stools[i]; return null; }
  function at(p, x, y, d) { return Math.hypot(p.x - x, p.y - y) < (d || 3); }

  function pickDest(p) {
    var dest = { x: clamp(18 + r() * 62, 12, 86), y: clamp(30 + r() * 50, 26, 88) };
    dest = walkableDest(dest.x, dest.y, p);
    setPath(p, dest.x, dest.y);
  }
  function goTo(p, x, y, state) { p.state = state; p.since = simNow; setPath(p, x, y); }

  function decide(p) {
    if (!isPatron(p)) return;
    if (p.mine && p.playing) return;
    if (closed || (isLastCall() && r() < 0.45)) { beginLeave(p); return; }
    var cur = cfg.curiosity / 10, comp = cfg.compete / 10, drink = cfg.drinks / 10 * PRESETS[cfg.preset].drinks;
    var dance = PRESETS[cfg.preset].dance * (cfg.band / 10);
    var late = (venueMin - OPEN) / (CLOSE - OPEN);
    var w = [
      ['bar', 0.12 + drink * 0.2 + (p.type === 'drinking' ? 0.26 : 0)],
      ['sit', 0.16 + (p.type === 'shy' ? 0.2 : 0)],
      ['watch', 0.1 + cur * 0.14],
      ['dance', 0.04 + dance * 0.22 + (cfg.preset === 'concert' ? 0.18 : 0)],
      ['wash', 0.05],
      ['food', 0.07],
      ['merch', 0.06 + cur * 0.06],
      ['chat', 0.08 + (p.type === 'shy' ? 0.04 : 0.02)],
      ['rdr', 0.04 + cur * 0.1 + comp * 0.14 + (p.type === 'competitive' ? 0.16 : 0) + (p.type === 'curious' ? 0.1 : 0)],
      ['bubble', 0.04 + comp * 0.1 + cur * 0.05],
      ['orbit', 0.04 + cur * 0.08 + comp * 0.08],
      ['pod', 0.06 + cur * 0.14],
      ['wander', 0.1 + (p.type === 'curious' ? 0.1 : 0)],
      ['leave', 0.02 + late * 0.12]
    ];
    if (p.type === 'shy') { w.forEach(function (x) { if (x[0] === 'rdr' || x[0] === 'orbit' || x[0] === 'pod') x[1] *= 0.35; }); }
    if (p.type === 'drinking') { w.forEach(function (x) { if (x[0] === 'rdr' || x[0] === 'orbit') x[1] *= 0.45; }); }
    var sum = 0; w.forEach(function (x) { sum += x[1]; });
    var x = r() * sum, acc = 0, choice = 'wander';
    for (var i = 0; i < w.length; i++) { acc += w[i][1]; if (x <= acc) { choice = w[i][0]; break; } }
    startAction(p, choice);
  }
  function beginLeave(p) {
    if (p.seat) { p.seat.who = null; p.seat = null; }
    if (p.stool) { p.stool.who = null; p.stool = null; }
    if (p.order) { p.order.cancelled = true; p.order = null; p.waiting = false; setBubble(p, null); }
    if (p.coat) goTo(p, 8, 20, 'leaveCoat');
    else goTo(p, 50, 106, 'leave');
  }
  function startAction(p, choice) {
    if (p.seat) { p.seat.who = null; p.seat = null; }
    if (p.stool) { p.stool.who = null; p.stool = null; }
    p.waiting = false; p.need = null; setBubble(p, null);
    if (choice === 'leave') { beginLeave(p); return; }
    if (choice === 'bar') {
      var s = freeStool(); if (s) { s.who = p; p.stool = s; goTo(p, s.x, s.y, 'bar'); p.need = 'drink'; } else startAction(p, 'sit');
    } else if (choice === 'sit') {
      var t = freeSeat(); if (t) { t.who = p; p.seat = t; goTo(p, t.x, t.y, 'sit'); p.need = r() < (0.45 + cfg.drinks * 0.04) ? 'drink' : (r() < 0.55 ? 'food' : 'drink'); } else goTo(p, 40 + r() * 20, 50 + r() * 10, 'wander');
    } else if (choice === 'watch') {
      goTo(p, 40 + r() * 18, 20 + r() * 8, 'watch');
    } else if (choice === 'dance') {
      goTo(p, 38 + r() * 18, 22 + r() * 8, 'dance');
    } else if (choice === 'wash') {
      var slot = !washBusy[0] ? 0 : !washBusy[1] ? 1 : -1;
      if (slot < 0) { pickDest(p); p.state = 'wander'; p.since = simNow; return; }
      washBusy[slot] = true; p.wash = slot; goTo(p, 8, 36 + slot * 8, 'wash');
    } else if (choice === 'food') {
      goTo(p, 20, 66, 'food'); p.need = 'food';
    } else if (choice === 'merch') {
      goTo(p, 16.5, 20, 'merch');
    } else if (choice === 'chat') {
      startChat(p);
    } else if (choice === 'rdr') {
      goTo(p, 74 + r() * 6, 80 + r() * 6, 'toRdr');
    } else if (choice === 'bubble') {
      goTo(p, 44 + r() * 8, 82 + r() * 5, 'toBub');
    } else if (choice === 'orbit') {
      goTo(p, 22 + r() * 6, 84 + r() * 4, 'toOrb');
    } else if (choice === 'pod') {
      goTo(p, 50, 58, 'toPod');
    } else {
      pickDest(p); p.state = 'wander'; p.since = simNow;
    }
  }
  function startChat(p) {
    var other = null, best = 99;
    patrons().forEach(function (q) {
      if (q === p || q.mine || q.playing || q.state === 'leave' || q.state === 'wash' || q.state === 'pod') return;
      var d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 22 && d < best && r() < 0.8) { best = d; other = q; }
    });
    var spot = walkableDest(32 + r() * 16, 40 + r() * 12, p);
    if (other) {
      if (other.seat) { other.seat.who = null; other.seat = null; }
      if (other.stool) { other.stool.who = null; other.stool = null; }
      goTo(p, spot.x - 1.6, spot.y, 'chat');
      goTo(other, spot.x + 1.6, spot.y, 'chat');
      other.pauseUntil = simNow + 5000 + r() * 5000;
    } else {
      goTo(p, spot.x, spot.y, 'chat');
    }
  }
  function placeOrder(p, kind) {
    if (p.order || !kind) return;
    var table = p.seat && p.seat.table ? p.seat.table : (p.stool ? { name: 'the bar' } : { name: 'the window' });
    var o = { id: 'o' + pid++, patron: p, kind: kind, table: table, stage: 'wait', server: null, placedAt: simNow };
    p.order = o; p.waiting = true; p.need = kind;
    orders.push(o);
    setBubble(p, kind === 'food' ? ICO.food : ICO.drink);
  }

  var bubPlayers = [], orbPlayers = [], podRider = null, bubT = 0, orbT = 0, podQueue = [];

  function tryJoinRdr(p) {
    if (p.playing || !rdr.run) { p.state = 'watchRdr'; p.since = simNow; return; }
    var n = rdr.bots.filter(function (b) { return !b.left; }).length;
    var shyLeave = p.type === 'shy' && n >= 2 && r() < 0.5;
    var drinkSkip = p.type === 'drinking' && r() < 0.45;
    if (n >= 4 || shyLeave || drinkSkip) { p.state = 'watchRdr'; p.since = simNow; emote(p, EM.eyes); return; }
    if (spawnRdrPhone(p, false)) { p.state = 'playRdr'; p.since = simNow; emote(p, EM.phone); }
    else { p.state = 'watchRdr'; p.since = simNow; }
  }
  function tryJoinBub(p) {
    if (bubPlayers.length >= 2) { p.state = 'watchBub'; p.since = simNow; return; }
    bubPlayers.push(p); p.playing = 'bubble'; p.state = 'playBub'; p.since = simNow; stats.joinedHour++; stats.busiest.bubble++;
    emote(p, EM.fire); log(p.name + ' grabs a Bubble Hockey rod');
    if (bubPlayers.length === 2) bubT = simNow + 18000 + r() * 18000;
  }
  function tryJoinOrb(p) {
    if (orbPlayers.length >= 2) { p.state = 'watchOrb'; p.since = simNow; return; }
    orbPlayers.push(p); p.playing = 'orbit'; p.state = 'playOrb'; p.since = simNow; stats.joinedHour++; stats.busiest.orbit++;
    emote(p, EM.wow); log(p.name + ' sits down at Orbit Brawl');
    if (orbPlayers.length && !orbT) orbT = simNow + 20000 + r() * 20000;
  }
  function tryJoinPod(p) {
    if (podRider || (podQueue.length && podQueue[0] !== p)) {
      if (podQueue.indexOf(p) < 0) podQueue.push(p);
      var i = podQueue.indexOf(p);
      goTo(p, 50 + (i % 3 - 1) * 3.2, 58 + Math.floor(i / 3) * 3, 'queuePod');
      return;
    }
    startPod(p);
  }
  function startPod(p) {
    var qi = podQueue.indexOf(p); if (qi >= 0) podQueue.splice(qi, 1);
    podRider = p; p.playing = 'pod'; p.state = 'pod'; p.rideUntil = simNow + 16000 + r() * 8000;
    p.x = 50; p.y = 47; p.tx = 50; p.ty = 47; p.path = [];
    $('pod').classList.add('lit'); podFlight.setLit(true); wallFlight.setLit(true);
    stats.podRides++; stats.busiest.pod++;
    log(p.name + ' straps into the G-F POD', 'ev');
    emote(p, EM.wow);
    if (wallMode === 'site' || wallMode === 'ads') { wallForced = wallMode; setWall('pod', true); }
  }
  function endPod(p) {
    if (podRider === p) podRider = null;
    p.playing = null; p.rideUntil = 0;
    p.x = 50; p.y = 58;
    $('pod').classList.remove('lit'); podFlight.setLit(false); wallFlight.setLit(false);
    if (wallForced) { setWall(wallForced, true); wallForced = false; }
    // next in line
    if (podQueue.length) {
      var n = podQueue[0];
      if (n && n.state === 'queuePod') startPod(n);
    }
  }
  function endSession(list, kind) {
    if (kind === 'bubble') { stats.gamesBub++; log('Bubble Hockey game over', 'ev'); }
    if (kind === 'orbit') { stats.gamesOrb++; log('Orbit Brawl match over', 'ev'); }
    list.forEach(function (p) { p.playing = null; p.state = 'wander'; p.since = simNow; pickDest(p); if (r() < 0.5) emote(p, EM.clap); });
    list.length = 0;
  }

  function moveToward(p, dt) {
    var sp = (p.type === 'competitive' ? 14 : p.type === 'shy' ? 8 : 11) * p.spd * dt;
    if (p.role === 'server') sp *= 1.15;
    if (p.role === 'band') sp *= 0.9;
    if (p.drink > 0.5) sp *= 0.85;
    if (!p.path || !p.path.length) setPath(p, p.gx != null ? p.gx : p.tx, p.gy != null ? p.gy : p.ty);
    var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.55) {
      p.x = p.tx; p.y = p.ty;
      if (p.path && p.pi < p.path.length - 1) {
        p.pi++; p.tx = p.path[p.pi].x; p.ty = p.path[p.pi].y;
        return false;
      }
      return true;
    }
    var nx = p.x + dx / d * sp, ny = p.y + dy / d * sp;
    if (p.drink > 0.4) { nx += Math.sin(simNow / 280 + p.wob) * p.drink * 0.08; }
    if (blockedAt(nx, ny, p, 0.5)) {
      if (!p._bumped || (simNow - p._bumped) > 700) { bump(p); p._bumped = simNow; }
      pushOut(p);
      setPath(p, p.gx != null ? p.gx : p.tx, p.gy != null ? p.gy : p.ty);
      return false;
    }
    p.x = nx; p.y = ny;
    return false;
  }
  function separate() {
    for (var i = 0; i < people.length; i++) {
      var a = people[i];
      if (a.state === 'pod' || a.state === 'wash' || a.role === 'tender' || a.role === 'cook') continue;
      for (var j = i + 1; j < people.length; j++) {
        var b = people[j];
        if (b.state === 'pod' || b.state === 'wash' || b.role === 'tender' || b.role === 'cook') continue;
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 0.01) { b.x += 0.4; continue; }
        if (d < 2.4) {
          var push = (2.4 - d) * 0.35, ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }
  function placeEl(p) {
    if (!p.el) return;
    p.el.style.left = p.x + '%'; p.el.style.top = p.y + '%';
    var moving = p.path && p.pi < (p.path.length) && Math.hypot((p.gx || p.tx) - p.x, (p.gy || p.ty) - p.y) > 1.2 && p.state !== 'pod' && p.state !== 'sit' && p.state !== 'bar' && p.state !== 'watch' && p.state !== 'chat';
    p.el.classList.toggle('walk', !!moving);
    p.el.classList.toggle('idle', !moving && p.state !== 'dance' && p.state !== 'pod');
    p.el.classList.toggle('dance', p.state === 'dance' || p.state === 'pod');
    p.el.classList.toggle('playing', !!p.playing);
    p.el.classList.toggle('mine', !!p.mine);
    var glance = !moving && (p.state === 'watch' || p.state === 'sit' || p.state === 'wander' || p.state === 'chat') && (Math.sin(simNow / 1400 + p.wob) > 0.55);
    p.el.classList.toggle('glance', !!glance);
    var act = p.el.querySelector('.act');
    if (act) act.textContent = activityLabel(p);
    if (p.bot && p.bot.chip) { p.bot.chip.style.left = (p.x + 3) + '%'; p.bot.chip.style.top = (p.y - 4) + '%'; }
  }

  function tickPerson(p, now, dt) {
    if (p.role === 'server') return tickServer(p, now, dt);
    if (p.role === 'tender') return tickTender(p, now, dt);
    if (p.role === 'cook') return tickCook(p, now, dt);
    if (p.role === 'band') return tickBandMember(p, now, dt);
    if (p.pauseUntil && now < p.pauseUntil && (p.state === 'wander' || p.state === 'chat' || p.state === 'sit' || p.state === 'bar' || p.state === 'watch' || p.state === 'merch')) {
      placeEl(p); return;
    }
    var arrived = moveToward(p, dt);
    if (arrived && p.state !== 'pod' && p.state !== 'wash' && !p.pauseUntil) {
      // small natural pause at arrival
      if (!p._justArrived) { p._justArrived = true; p.pauseUntil = now + 280 + r() * 700; }
    }
    if (p.state === 'enter') {
      if (arrived || p.y < 94) { goTo(p, 8, 20, 'toCoat'); }
    } else if (p.state === 'toCoat') {
      if (arrived) {
        p.state = 'coat'; p.since = now;
        if (!p.coat) { p.coat = true; coatCount++; paintCoats(); emote(p, EM.coat); }
      }
    } else if (p.state === 'coat') {
      if (now - p.since > 700 + r() * 600) decide(p);
    } else if (p.state === 'leaveCoat') {
      if (arrived) {
        if (p.coat) { p.coat = false; if (coatCount > 0) coatCount--; paintCoats(); }
        goTo(p, 50, 106, 'leave');
      }
    } else if (p.state === 'leave') {
      if (p.y > 104) { log(p.name + ' heads out'); removePerson(p); return; }
    } else if (p.state === 'wander') {
      if (arrived) pickDest(p);
      if (now - p.since > 4000 + r() * 5000) decide(p);
    } else if (p.state === 'bar' || p.state === 'sit') {
      if (arrived && now - p.since > 400 && p.need && !p.order && !p.waiting) placeOrder(p, p.need);
      if (p.state === 'bar' && arrived && !p.waiting) { p.drink = Math.min(1, p.drink + 0.08 * (cfg.drinks / 10 + 0.3)); }
      if (now - p.since > 10000 + r() * 14000 && !p.waiting) decide(p);
    } else if (p.state === 'watch') {
      if (arrived && r() < 0.12 + cfg.drinks * 0.02) emote(p, pick([EM.notes, EM.clap, EM.eyes, EM.wow]));
      if (now - p.since > 7000 + r() * 8000) decide(p);
    } else if (p.state === 'dance') {
      if (r() < 0.08 + cfg.band * 0.015) emote(p, EM.notes);
      if (now - p.since > 8000 + r() * 10000) decide(p);
    } else if (p.state === 'wash') {
      if (arrived && p.el.style.opacity !== '0') p.el.style.opacity = '0';
      if (now - p.since > 6000 + r() * 8000) {
        p.el.style.opacity = '1'; washBusy[p.wash] = false; p.wash = -1; decide(p);
      }
    } else if (p.state === 'food') {
      if (arrived && p.need && !p.order) placeOrder(p, 'food');
      if (arrived && now - p.since > 9000 && !p.waiting) { emote(p, '\u{1F355}'); decide(p); }
    } else if (p.state === 'merch') {
      if (arrived && now - p.since > 5000 + r() * 5000) decide(p);
    } else if (p.state === 'chat') {
      if (now - p.since > 6000 + r() * 6000) decide(p);
    } else if (p.state === 'toRdr') {
      if (arrived) tryJoinRdr(p);
    } else if (p.state === 'toBub') {
      if (arrived) tryJoinBub(p);
    } else if (p.state === 'toOrb') {
      if (arrived) tryJoinOrb(p);
    } else if (p.state === 'toPod' || p.state === 'queuePod') {
      if (arrived) tryJoinPod(p);
    } else if (p.state === 'playRdr' || p.state === 'watchRdr') {
      if (p.state === 'watchRdr' && r() < 0.06) emote(p, pick([EM.wow, EM.eyes, EM.clap]));
      if (p.state === 'playRdr' && p.bot && !p.bot.mine && (p.type === 'drinking' || p.type === 'shy') && now - p.since > 20000 && r() < 0.002 + (p.type === 'drinking' ? 0.003 : 0)) {
        log(p.name + ' puts the phone down and heads to the bar');
        dropRdrPhone(p.bot); p.state = 'wander'; decide(p);
      }
      if (p.state === 'watchRdr' && now - p.since > 10000 + r() * 8000) decide(p);
    } else if (p.state === 'playBub' || p.state === 'watchBub') {
      if (p.state === 'watchBub' && now - p.since > 8000) decide(p);
    } else if (p.state === 'playOrb' || p.state === 'watchOrb') {
      if (p.state === 'watchOrb' && now - p.since > 8000) decide(p);
    } else if (p.state === 'pod') {
      p.x = 50; p.y = 47;
      if (now >= p.rideUntil) { endPod(p); emote(p, EM.clap); decide(p); }
    }
    if (arrived) p._justArrived = true; else p._justArrived = false;
    placeEl(p);
  }

  // ------------------------------------------------------------------ servers, bartender, cook
  var serverNames = ['Rio', 'Adele', 'Nico'];
  function nearestWaiter(x, y) {
    var best = null, bd = 1e9;
    people.forEach(function (s) {
      if (s.role !== 'server' || s.job) return;
      var d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    });
    return best;
  }
  function tickOrders() {
    orders = orders.filter(function (o) { return o.patron && !o.cancelled && o.stage !== 'done'; });
    orders.forEach(function (o) {
      if (o.stage !== 'wait' || o.server) return;
      var px = o.patron.x, py = o.patron.y;
      var s = nearestWaiter(px, py);
      if (!s) return;
      o.server = s; o.stage = 'take';
      s.job = 'take'; s.order = o; s.fetchKind = o.kind;
      goTo(s, px + (px < 50 ? 2.2 : -2.2), py, 'toTable');
    });
  }
  function tickServer(s, now, dt) {
    var arrived = moveToward(s, dt);
    var o = s.order;
    if (s.job === 'take') {
      if (arrived || (o && o.patron && at(s, o.patron.x, o.patron.y, 4))) {
        if (o && o.patron) {
          log(s.name + ' took order at ' + (o.table && o.table.name ? o.table.name : 'a table'), 'ev');
          stats.orders++;
          setBubble(s, o.kind === 'food' ? ICO.food : ICO.drink);
          s.job = 'fetch';
          if (o.kind === 'food') goTo(s, 12, 64, 'serveKit');
          else goTo(s, 88, 40, 'serveBar');
        } else { s.job = null; s.order = null; goTo(s, 22, 64, 'wander'); }
      }
    } else if (s.job === 'fetch') {
      if (arrived) {
        if (s.fetchKind === 'food') { cookBusy(2200 + r() * 1400); $('cook').classList.add('working'); }
        else { tenderBusy(1800 + r() * 1200); $('tender').classList.add('working'); }
        s.job = 'waitPrep'; s.since = now; s.waitPrep = now + 1800 + r() * 1400;
      }
    } else if (s.job === 'waitPrep') {
      if (now >= s.waitPrep) {
        s.job = 'deliver';
        setBubble(s, o && o.kind === 'food' ? ICO.food : ICO.drink);
        if (o && o.patron) goTo(s, o.patron.x + 2, o.patron.y + 2, 'toTable');
        else { s.job = null; setBubble(s, null); goTo(s, 22, 64, 'wander'); }
      }
    } else if (s.job === 'deliver') {
      if (arrived || (o && o.patron && at(s, o.patron.x, o.patron.y, 4))) {
        if (o && o.patron && !o.cancelled) {
          o.stage = 'done'; o.patron.waiting = false; o.patron.order = null;
          if (o.kind === 'drink') o.patron.drink = Math.min(1, o.patron.drink + 0.25);
          setBubble(o.patron, ICO.check);
          setTimeout(function () { try { setBubble(o.patron, null); } catch (e) {} }, 2200);
          emote(o.patron, o.kind === 'food' ? '\u{1F355}' : EM.cheers);
          log(s.name + ' delivered ' + (o.kind === 'food' ? 'food' : 'a drink') + ' to ' + o.patron.name);
        }
        setBubble(s, null);
        s.job = null; s.order = null;
        goTo(s, 20 + r() * 8, 62 + r() * 6, 'wander');
        $('cook').classList.remove('working');
        $('tender').classList.remove('working');
      }
    } else {
      if (arrived) {
        var home = walkableDest(20 + r() * 10, 60 + r() * 10, s);
        if (r() < 0.5) home = walkableDest(76 + r() * 6, 64 + r() * 10, s);
        setPath(s, home.x, home.y);
        s.since = now;
      }
    }
    placeEl(s);
  }
  var tenderTimer = 0, cookTimer = 0;
  function tenderBusy(ms) { tenderTimer = Math.max(tenderTimer, simNow + ms); }
  function cookBusy(ms) { cookTimer = Math.max(cookTimer, simNow + ms); }
  function tickTender(p, now, dt) {
    p.busyUntil = tenderTimer;
    if (!p.path || Math.hypot(p.tx - p.x, p.ty - p.y) < 0.6) {
      setPath(p, 90 + r() * 4, 28 + r() * 42);
    }
    moveToward(p, dt * 0.45);
    $('tender').classList.toggle('working', now < tenderTimer);
    // keep the CSS tender in sync as a backup silhouette; hide if the agent is visible
    placeEl(p);
  }
  function tickCook(p, now, dt) {
    p.busyUntil = cookTimer;
    if (!p.path || Math.hypot(p.tx - p.x, p.ty - p.y) < 0.6) {
      setPath(p, 8 + r() * 8, 62 + r() * 8);
    }
    moveToward(p, dt * 0.4);
    $('cook').classList.toggle('working', now < cookTimer);
    placeEl(p);
  }

  // ------------------------------------------------------------------ band breaks
  var nextBreakAt = 0, bandAgents = [];
  function applyBandParts() {
    var parts = { drums: true, bass: true, keys: true, vox: true };
    bandAgents.forEach(function (b) {
      if (b.state === 'green' || b.state === 'toGreen' || b.state === 'bar' || b.state === 'toBar') parts[b.part] = false;
    });
    if (MUS && MUS.setParts) MUS.setParts(parts);
    BAND_KIT.forEach(function (k) {
      var el = document.querySelector('#band .bando[data-part="' + k.part + '"]');
      if (!el) return;
      var away = !parts[k.part];
      el.classList.toggle('away', away);
      el.classList.toggle('play', !away);
    });
  }
  function startBandBreak(who) {
    var on = bandAgents.filter(function (b) { return b.state === 'playing'; });
    if (on.length <= 2) return false; // never leave fewer than 2 on stage
    var b = who ? bandAgents.filter(function (x) { return x.part === who || x.name === who; })[0] : pick(on);
    if (!b || b.state !== 'playing') return false;
    var goingBar = r() < 0.4;
    b.el.style.display = '';
    var idx = 0; for (var bi = 0; bi < BAND_KIT.length; bi++) if (BAND_KIT[bi].part === b.part) idx = bi;
    b.x = 36 + idx * 10;
    b.y = 16;
    if (goingBar) {
      var s = freeStool();
      if (s) { s.who = b; b.stool = s; goTo(b, s.x, s.y, 'bar'); }
      else goTo(b, 88, 22, 'toGreen');
    } else {
      goTo(b, 90, 10, 'toGreen');
    }
    b.breakUntil = simNow + 14000 + r() * 16000;
    log(b.name + ' on break', 'ev');
    applyBandParts();
    return true;
  }
  function tickBandMember(b, now, dt) {
    if (b.state === 'playing') { placeEl(b); return; }
    var arrived = moveToward(b, dt);
    if (b.state === 'toGreen' && arrived) { b.state = 'green'; b.since = now; b.x = 91; b.y = 9; }
    if ((b.state === 'green' || b.state === 'bar') && now >= (b.breakUntil || 0)) {
      if (b.stool) { b.stool.who = null; b.stool = null; }
      goTo(b, 48, 16, 'bandStage');
    }
    if (b.state === 'bandStage' && arrived) {
      b.state = 'playing'; b.since = now;
      b.el.style.display = 'none';
      log(b.name + ' is back on stage', 'ev');
      applyBandParts();
    }
    // hide walking sprite while on stage
    if (b.el) b.el.style.display = b.state === 'playing' ? 'none' : '';
    applyBandParts();
    placeEl(b);
  }
  function tickBand(now) {
    if (!nextBreakAt) nextBreakAt = now + 8000 + r() * 8000;
    if (closed) return;
    var away = bandAgents.filter(function (b) { return b.state !== 'playing'; }).length;
    if (now >= nextBreakAt) {
      if (away < 2) startBandBreak();
      nextBreakAt = now + 18000 + r() * 22000;
    }
  }

  // ------------------------------------------------------------------ arrivals
  var nextArrive = 0;
  function capPatrons() { return Math.round(cfg.crowd * PRESETS[cfg.preset].crowd); }
  function arriveDelay() {
    var base = 14000 - cfg.arrive * 1100;
    var room = capPatrons() - patrons().length;
    if (room <= 0) return 8000 + r() * 6000;
    return Math.max(600, (base / rush()) * (0.7 + r() * 0.6));
  }
  function tickArrivals(now) {
    if (closed || isLastCall()) return;
    if (now >= nextArrive) {
      if (patrons().length < capPatrons()) {
        var p = makePerson(true);
        log(p.name + ' walks in (' + p.type + ')');
        stats.joinedHour++;
        if (r() < 0.15 + cfg.drinks * 0.02) emote(p, pick([EM.notes, EM.cheers, EM.eyes]));
      }
      nextArrive = now + arriveDelay();
    }
    // slider went down: ask extras to leave
    var extra = patrons().length - capPatrons();
    if (extra > 0) {
      patrons().forEach(function (p) {
        if (extra <= 0 || p.mine || p.state === 'leave' || p.state === 'leaveCoat' || p.playing) return;
        if (r() < 0.08) { beginLeave(p); extra--; }
      });
    }
  }


  // ------------------------------------------------------------------ events
  function banner(text) {
    var b = document.createElement('div'); b.className = 'banner'; b.textContent = text;
    $('floor').appendChild(b);
    setTimeout(function () { try { b.remove(); } catch (e) {} }, 3200);
  }
  function evBirthday() {
    stats.events.birthday++;
    banner('HAPPY BIRTHDAY');
    log('A birthday group piles in ' + EM.cake, 'ev');
    var g = simNow;
    for (var i = 0; i < 4; i++) {
      var p = makePerson(true, g);
      p.type = i === 0 ? 'drinking' : mixType();
      (function (pp, k) { setTimeout(function () { if (people.indexOf(pp) < 0) return; emote(pp, EM.cake); if (k === 0) startAction(pp, 'sit'); }, 900 + k * 400); })(p, i);
    }
    var old = cfg.band; cfg.band = Math.min(10, cfg.band + 2); applyBand();
    setTimeout(function () { cfg.band = old; applyBand(); paintSliders(); }, 20000);
  }
  function evTournament() {
    stats.events.tournament++;
    var which = pick(['rdr', 'bubble', 'orbit']);
    var label = { rdr: 'RED DEER RICH TOURNAMENT', bubble: 'BUBBLE HOCKEY TOURNAMENT', orbit: 'ORBIT BRAWL TOURNAMENT' }[which];
    banner(label);
    log('A ' + which + ' tournament breaks out ' + EM.trophy, 'ev');
    var old = cfg.compete; cfg.compete = 10; paintSliders();
    patrons().forEach(function (p, i) {
      if (p.mine || p.playing) return;
      if (r() < 0.7 && p.type !== 'shy') setTimeout(function () { if (people.indexOf(p) >= 0 && !p.playing) startAction(p, which); }, 400 * i);
    });
    setTimeout(function () { cfg.compete = old; paintSliders(); }, 28000);
  }
  function evFlicker() {
    stats.events.flicker++;
    log('The lights flicker', 'ev');
    $('stageWrap').classList.add('flicker'); $('screenOff').style.display = 'flex';
    setTimeout(function () {
      $('stageWrap').classList.remove('flicker'); $('screenOff').style.display = 'none';
      patrons().forEach(function (p) { if (r() < 0.5) emote(p, pick([EM.wow, EM.laugh, EM.dash])); });
      log('The room cheers as the lights come back', 'ev');
    }, 1100 + r() * 700);
  }
  function randomEvent(kind) {
    var k = kind || pick(['birthday', 'tournament', 'flicker']);
    if (k === 'birthday') evBirthday();
    else if (k === 'tournament') evTournament();
    else evFlicker();
  }

  // ------------------------------------------------------------------ night lighting + stats
  function paintNight() {
    var u = (venueMin - OPEN) / (CLOSE - OPEN);
    var ng = $('night');
    if (u < 0.25) { ng.style.background = '#3a2a18'; ng.style.opacity = String(0.12 + u * 0.2); }
    else if (u < 0.55) { ng.style.background = '#1a1030'; ng.style.opacity = String(0.22 + u * 0.15); }
    else { ng.style.background = '#100818'; ng.style.opacity = String(0.32 + (u - 0.55) * 0.25); }
    var cl = $('clock'); cl.textContent = clockLabel();
    cl.classList.toggle('rush', isRush() && !isLastCall());
    cl.classList.toggle('last', isLastCall());
  }
  function countStates() {
    var watch = 0, play = 0, list = patrons();
    list.forEach(function (p) {
      if (p.playing) play++;
      else if (p.state === 'watch' || p.state === 'watchRdr' || p.state === 'watchBub' || p.state === 'watchOrb' || p.state === 'dance') watch++;
    });
    return { n: list.length, watch: watch, play: play };
  }
  function paintStats() {
    var c = countStates();
    $('sIn').textContent = c.n; $('sWatch').textContent = c.watch; $('sPlay').textContent = c.play;
    $('sJoin').textContent = stats.joinedHour; $('sPod').textContent = stats.podRides;
    if (c.n > stats.peak) stats.peak = c.n;
  }
  function paintSliders() {
    $('cCrowd').value = cfg.crowd; $('vCrowd').textContent = cfg.crowd;
    $('cArrive').value = cfg.arrive;
    $('vArrive').textContent = cfg.arrive <= 3 ? 'quiet' : cfg.arrive <= 6 ? 'normal' : cfg.arrive <= 8 ? 'busy' : 'packed';
    $('cCur').value = cfg.curiosity; $('vCur').textContent = cfg.curiosity;
    $('cComp').value = cfg.compete; $('vComp').textContent = cfg.compete;
    $('cDrink').value = cfg.drinks; $('vDrink').textContent = cfg.drinks;
    $('cBand').value = cfg.band; $('vBand').textContent = cfg.band;
    $('cSpeed').value = cfg.speed;
    $('vSpeed').textContent = cfg.speed <= 3 ? 'chill' : cfg.speed <= 6 ? 'brisk' : cfg.speed <= 8 ? 'flying' : 'blazing';
    paintLabels();
  }
  function applyBand() { if (MUS) MUS.setEnergy(cfg.band / 10); }
  function paintLabels() {
    document.body.classList.toggle('show-acts', !!cfg.labels);
    if ($('bLabels')) {
      $('bLabels').classList.toggle('on', !!cfg.labels);
      $('bLabels').textContent = cfg.labels ? 'Labels on' : 'Labels off';
    }
  }

  function spawnStaff() {
    // hide the static silhouettes — moving agents take their place (silhouettes still bob when working)
    var nServers = cfg.crowd >= 24 ? 3 : 2;
    for (var i = 0; i < nServers; i++) {
      var s = makePerson(false, 0, { role: 'server', name: serverNames[i], color: '#e2b84a', type: 'curious' });
      s.x = 22 + i * 6; s.y = 62; s.state = 'wander'; s.coat = false; s.spd = 1.05 + r() * 0.2;
      setPath(s, s.x, 64);
    }
    var t = makePerson(false, 0, { role: 'tender', name: 'Marlow', color: '#7a1a1a', type: 'curious' });
    t.x = 91; t.y = 40; t.state = 'tender'; t.coat = false; t.spd = 0.6;
    $('tender').style.opacity = '0.15';
    var c = makePerson(false, 0, { role: 'cook', name: 'Paz', color: '#3a4a6a', type: 'curious' });
    c.x = 10; c.y = 64; c.state = 'cook'; c.coat = false; c.spd = 0.55;
    $('cook').style.opacity = '0.2';
    bandAgents = [];
    BAND_KIT.forEach(function (k, i) {
      var b = makePerson(false, 0, { role: 'band', name: k.name, color: '#222', type: 'curious', part: k.part });
      b.x = 36 + i * 10; b.y = 16; b.state = 'playing'; b.coat = false; b.el.style.display = 'none';
      bandAgents.push(b);
    });
    applyBandParts();
  }

  // ------------------------------------------------------------------ recap
  function beginClosing() {
    if (closed) return;
    closed = true;
    venueMin = Math.max(venueMin, CLOSE);
    if (bubPlayers.length) { stats.gamesBub++; bubPlayers = []; }
    if (orbPlayers.length) { stats.gamesOrb++; orbPlayers = []; }
    podQueue = [];
    patrons().forEach(function (p) { if (!p.mine) beginLeave(p); });
    log('Last call — the doors are closing', 'ev');
    setTimeout(showRecap, 2800);
  }
  function showRecap() {
    if (recapShown) return; recapShown = true; closed = true;
    var top = '—', counts = {};
    stats.winners.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
    var best = 0; Object.keys(counts).forEach(function (n) { if (counts[n] > best) { best = counts[n]; top = n + ' (' + best + ' table' + (best > 1 ? 's' : '') + ')'; } });
    var busy = Object.keys(stats.busiest).sort(function (a, b) { return stats.busiest[b] - stats.busiest[a]; })[0];
    var busyName = { rdr: 'Red Deer Rich', bubble: 'Bubble Hockey', orbit: 'Orbit Brawl', pod: 'G-F POD' }[busy];
    var games = stats.gamesRdr + stats.gamesBub + stats.gamesOrb;
    $('recapSub').textContent = 'The 0-\u03a6 Room has closed. What a night.';
    $('recapDl').innerHTML =
      '<dt>Peak crowd</dt><dd>' + stats.peak + '</dd>' +
      '<dt>Games played</dt><dd>' + games + ' <small style="color:#9a96ad;font-weight:500">(' + stats.gamesRdr + ' Red Deer Rich · ' + stats.gamesBub + ' Bubble · ' + stats.gamesOrb + ' Orbit)</small></dd>' +
      '<dt>Top player</dt><dd>' + top + '</dd>' +
      '<dt>Pod rides</dt><dd>' + stats.podRides + '</dd>' +
      '<dt>Orders run</dt><dd>' + (stats.orders || 0) + '</dd>' +
      '<dt>Busiest station</dt><dd>' + busyName + '</dd>' +
      '<dt>Moments</dt><dd>' + stats.events.birthday + ' birthdays · ' + stats.events.tournament + ' tournaments · ' + stats.events.flicker + ' flickers</dd>';
    $('recap').classList.add('show');
    log('Last call — here is the night recap', 'ev');
  }
  function newNight() {
    $('recap').classList.remove('show');
    people.slice().forEach(removePerson);
    rdr.bots.slice().forEach(function (b) { dropRdrPhone(b); });
    rdr.bots = []; bubPlayers = []; orbPlayers = []; podRider = null; bubT = 0; orbT = 0; podQueue = []; orders = [];
    coatCount = 0; paintCoats(); bandAgents = []; nextBreakAt = 0;
    stats = { joinedHour: 0, hourMark: 19, podRides: 0, gamesRdr: 0, gamesBub: 0, gamesOrb: 0, peak: 0, winners: [], events: { birthday: 0, tournament: 0, flicker: 0 }, busiest: { rdr: 0, bubble: 0, orbit: 0, pod: 0 }, orders: 0 };
    venueMin = OPEN; closed = false; recapShown = false;
    if (rdr.tv) { try { rdr.tv.src = 'about:blank'; } catch (e) {} }
    startRdr();
    spawnStaff();
    seedCrowd(Math.max(4, Math.round(cfg.crowd * 0.45)));
    nextArrive = simNow + 2000;
    log('Doors open. Another night in the 0-\u03a6 Room.', 'sys');
  }

  function seedCrowd(n) {
    for (var i = 0; i < n; i++) {
      var p = makePerson(false);
      if (r() < 0.55) decide(p);
    }
  }

  // ------------------------------------------------------------------ camera (drag pan + wheel zoom)
  var cam = { x: 0, y: 0, z: 1 };
  var drag = null;
  function applyCam() {
    var w = $('world');
    if (!w) return;
    w.style.transform = 'translate(' + cam.x + 'px, ' + cam.y + 'px) scale(' + cam.z + ')';
  }
  function bindCam() {
    var stage = $('cam');
    if (!stage) return;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var t = e.target;
      if (t && (t.closest && t.closest('#desk, #mePanel, #recap, button, input, select, a, iframe'))) return;
      drag = { x: e.clientX, y: e.clientY, ox: cam.x, oy: cam.y };
      stage.classList.add('is-panning');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      cam.x = drag.ox + (e.clientX - drag.x);
      cam.y = drag.oy + (e.clientY - drag.y);
      applyCam();
    });
    function endPan(e) {
      if (!drag) return;
      drag = null;
      setTimeout(function () { stage.classList.remove('is-panning'); }, 80);
    }
    stage.addEventListener('pointerup', endPan);
    stage.addEventListener('pointercancel', endPan);
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var next = clamp(cam.z * (e.deltaY > 0 ? 0.92 : 1.08), 0.7, 1.85);
      cam.z = next;
      applyCam();
    }, { passive: false });
    stage.addEventListener('dblclick', function (e) {
      if (e.target && e.target.closest && e.target.closest('#desk, button, input, select, a, iframe')) return;
      cam.x = 0; cam.y = 0; cam.z = 1; applyCam();
    });
  }

  // ------------------------------------------------------------------ presets / music / wall UI
  function applyPreset(id, fromUser) {
    if (!PRESETS[id]) return;
    cfg.preset = id;
    document.body.setAttribute('data-preset', id);
    document.querySelectorAll('#presets button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-p') === id); });
    if (MUS) MUS.setTrack(PRESETS[id].music);
    if ($('cTune')) $('cTune').value = PRESETS[id].music;
    if (fromUser) log('Preset: ' + PRESETS[id].name, 'sys');
  }

  function bindUi() {
    $('cCrowd').oninput = function () { cfg.crowd = +this.value; paintSliders(); };
    $('cArrive').oninput = function () { cfg.arrive = +this.value; paintSliders(); };
    $('cCur').oninput = function () { cfg.curiosity = +this.value; paintSliders(); };
    $('cComp').oninput = function () { cfg.compete = +this.value; paintSliders(); };
    $('cDrink').oninput = function () { cfg.drinks = +this.value; paintSliders(); };
    $('cBand').oninput = function () { cfg.band = +this.value; applyBand(); paintSliders(); };
    $('cSpeed').oninput = function () { cfg.speed = +this.value; paintSliders(); };
    document.querySelectorAll('#presets button').forEach(function (b) {
      b.onclick = function () { applyPreset(b.getAttribute('data-p'), true); };
    });
    document.querySelectorAll('#screenPick button').forEach(function (b) {
      b.onclick = function () { wallForced = false; setWall(b.getAttribute('data-s')); };
    });
    if (MUS) {
      MUS.tracks.forEach(function (t) {
        var o = document.createElement('option'); o.value = t.id; o.textContent = t.title + ' — ' + t.kind;
        $('cTune').appendChild(o);
      });
      $('cTune').onchange = function () { MUS.setTrack(this.value); log('Band: ' + MUS.state().title, 'sys'); };
      $('cVol').oninput = function () { MUS.setVolume(this.value / 100); if (cfg.muted) { cfg.muted = false; MUS.mute(false); paintMute(); MUS.resume(); MUS.play(); } };
      $('bMute').onclick = function () { cfg.muted = !cfg.muted; MUS.mute(cfg.muted); if (!cfg.muted) { MUS.resume(); MUS.play(); $('hint').classList.remove('show'); } paintMute(); };
    }
    $('bPause').onclick = togglePause;
    $('bEvent').onclick = function () { randomEvent(); };
    if ($('bLabels')) $('bLabels').onclick = function () { cfg.labels = !cfg.labels; paintLabels(); };
    $('bMe').onclick = function () { openMe(); };
    $('bMeClose').onclick = closeMe;
    document.querySelectorAll('#mePick button').forEach(function (b) { b.onclick = function () { joinMe(b.getAttribute('data-j')); }; });
    $('bAgain').onclick = newNight;
    $('bRecapX').onclick = function () { $('recap').classList.remove('show'); };
    var arm = function () {
      if (MUS) { MUS.resume(); if (!cfg.muted) MUS.play(); }
      $('hint').classList.remove('show');
      window.removeEventListener('pointerdown', arm);
    };
    window.addEventListener('pointerdown', arm);
    bindCam();
  }
  function paintMute() {
    $('bMute').classList.toggle('on', cfg.muted);
    $('bMute').textContent = cfg.muted ? 'Muted' : 'Band on';
  }
  function togglePause() {
    paused = !paused;
    $('bPause').textContent = paused ? 'Resume' : 'Pause';
    log(paused ? 'Paused' : 'Back in motion', paused ? 'sys' : 'sys');
  }

  // ------------------------------------------------------------------ drop me in
  var mePerson = null, meKind = null;
  function openMe() { $('mePanel').classList.add('show'); $('mePick').style.display = 'grid'; $('meTitle').textContent = 'Drop me in'; clearMeFrame(); }
  function closeMe() {
    $('mePanel').classList.remove('show');
    if (meKind === 'rdr' && mePerson && mePerson.bot) {
      // keep playing in the little chip if they close the panel? Move iframe back? Keep them in.
    }
    if (meKind === 'bubble' || meKind === 'orbit') clearMeFrame();
  }
  function clearMeFrame() {
    var body = $('meBody');
    var fr = body.querySelector('iframe'); if (fr) fr.remove();
    $('mePick').style.display = 'grid';
  }
  function ensureMePerson(x, y) {
    if (mePerson && people.indexOf(mePerson) >= 0) return mePerson;
    var p = makePerson(false);
    p.name = myName; p.mine = true; p.type = 'curious'; p.x = x; p.y = y; p.tx = x; p.ty = y;
    p.el.querySelector('.nam').textContent = myName;
    p.el.querySelector('.head').textContent = '\u{1F60E}';
    mePerson = p; return p;
  }
  function joinMe(kind) {
    meKind = kind;
    if (kind === 'rdr') {
      var p = ensureMePerson(76, 82);
      if (p.bot) dropRdrPhone(p.bot);
      var bot = spawnRdrPhone(p, true);
      if (!bot) { log('No free seats at Red Deer Rich', 'sys'); return; }
      p.state = 'playRdr'; p.x = 76; p.y = 82;
      $('meTitle').textContent = 'You · Red Deer Rich';
      $('mePick').style.display = 'none';
      // full-size playable copy: reload the same URL in the panel (same cid = same seat? might duplicate)
      // Use the existing iframe moved into the panel (moving iframes reloads). So open a second controller with a unique cid — bad.
      // Better: scale-up the existing iframe in the panel by reparenting... reparent reloads.
      // Open panel as a zoomed phone: leave iframe in chip but also set chip... 
      // We'll put a NEW iframe in the panel with the same cid — BroadcastChannel + same cid might fight.
      // Safest: move the chip visually into the panel by CSS zoom? Or just tell them the seat is live and enlarge the chip.
      // Put playable iframe in the panel with cid + '-panel' — that's a second player.
      // Best v0.1: take the bot iframe and set pointer-events auto, and also show it large in the panel by using src of a unique new seat... 
      // Justin wants to play. I'll put the playable iframe IN the panel and NOT keep a second one. Hide the chip or use it as a dummy.
      try { bot.chip.remove(); } catch (e) {}
      bot.frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;transform:none;pointer-events:auto';
      $('meBody').appendChild(bot.frame);
      log(myName + ' takes a seat at Red Deer Rich', 'ev');
    } else if (kind === 'bubble') {
      var p = ensureMePerson(47, 84);
      if (bubPlayers.indexOf(p) < 0 && bubPlayers.length < 2) { bubPlayers.push(p); p.playing = 'bubble'; p.state = 'playBub'; }
      $('meTitle').textContent = 'You · Bubble Hockey';
      $('mePick').style.display = 'none';
      var f = document.createElement('iframe'); f.src = '../bubble/index.html?b=966'; f.setAttribute('allow', 'autoplay');
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      $('meBody').appendChild(f);
      log(myName + ' jumps onto Bubble Hockey', 'ev');
    } else if (kind === 'orbit') {
      var p = ensureMePerson(23, 86);
      if (orbPlayers.indexOf(p) < 0 && orbPlayers.length < 2) { orbPlayers.push(p); p.playing = 'orbit'; p.state = 'playOrb'; }
      $('meTitle').textContent = 'You · Orbit Brawl';
      $('mePick').style.display = 'none';
      var f2 = document.createElement('iframe'); f2.src = '../orbit/index.html'; f2.setAttribute('allow', 'autoplay');
      f2.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      $('meBody').appendChild(f2);
      log(myName + ' grabs an Orbit Brawl cockpit', 'ev');
    } else if (kind === 'pod') {
      var p = ensureMePerson(50, 52);
      if (podRider && podRider !== p) { log('The pod is busy — wait for the ride to finish', 'sys'); return; }
      startPod(p); p.rideUntil = simNow + 22000;
      $('meTitle').textContent = 'You · GyroForge';
      $('mePick').style.display = 'none';
      // show wall-quality cam in the panel
      var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      $('meBody').appendChild(cv);
      var fl = new SCR.Flight(cv); fl.setLit(true); fl.start();
      p._meFlight = fl;
      setWall('pod', true);
      log(myName + ' rides the GyroForge pod', 'ev');
    }
  }

  // ------------------------------------------------------------------ puck + hour reset
  function tickToys(now, dt) {
    var pk = $('puck');
    if (pk && bubPlayers.length) {
      var t = now / 400;
      pk.style.left = (50 + Math.sin(t) * 32) + '%';
      pk.style.top = (50 + Math.cos(t * 1.35) * 22) + '%';
    }
    if (bubPlayers.length === 2 && bubT && now > bubT) { endSession(bubPlayers, 'bubble'); bubT = 0; }
    if (bubPlayers.length === 1 && now - (bubPlayers[0].since || now) > 25000 && !bubT) { endSession(bubPlayers, 'bubble'); }
    if (orbPlayers.length && orbT && now > orbT) { endSession(orbPlayers, 'orbit'); orbT = 0; }
    var hr = Math.floor(venueMin / 60);
    if (hr !== stats.hourMark) { stats.hourMark = hr; stats.joinedHour = 0; }
  }

  // ------------------------------------------------------------------ main loop
  function loop(ts) {
    var dt = Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts;
    if (!paused) {
      var sdt = Math.min(0.12, dt * speedRate());
      simNow += sdt * 1000;
      venueMin += minPerSec() * dt;
      if (venueMin >= CLOSE && !closed) beginClosing();
      tickArrivals(simNow);
      tickOrders();
      tickBand(simNow);
      people.slice().forEach(function (p) { tickPerson(p, simNow, sdt); });
      separate();
      tickRdr(ts);
      tickToys(simNow, sdt);
    }
    try { adReel.tick(ts); } catch (e) {}
    try { podFlight.tick(dt); } catch (e) {}
    try { wallFlight.tick(dt); } catch (e) {}
    try { orbMini.tick(dt); } catch (e) {}
    try { if (mePerson && mePerson._meFlight) mePerson._meFlight.tick(dt); } catch (e) {}
    paintNight(); paintStats();
    requestAnimationFrame(loop);
  }

  function boot() {
    bindUi();
    applyPreset(cfg.preset, false);
    paintSliders(); paintMute(); applyBand(); paintLabels();
    if (MUS) { MUS.setVolume(0.42); MUS.mute(true); MUS.setTrack(PRESETS[cfg.preset].music); }
    setWall('site', true);
    $('hint').classList.add('show');
    var nSeed = Q.has('shot') ? Math.max(12, cfg.crowd - 2) : Math.max(5, Math.round(cfg.crowd * 0.5));
    spawnStaff();
    pickBuild(function (b) {
      rdr.build = b;
      startRdr();
      seedCrowd(nSeed);
      nextArrive = simNow + 1800;
      log('Doors open on a ' + PRESETS[cfg.preset].name + ' night. Band is playing ' + (MUS ? MUS.state().title : 'the room tune') + ' (muted until you unmute). Red Deer Rich TV is ' + b.ver + '.', 'sys');
      if (Q.get('event')) setTimeout(function () { randomEvent(Q.get('event')); }, 1200);
    });
    requestAnimationFrame(loop);
  }

  window.ZTPVenue = {
    state: function () {
      return {
        clock: clockLabel(), minutes: venueMin, paused: paused, closed: closed, preset: cfg.preset, cfg: cfg, stats: stats,
        hits: peopleHits(), simNow: Math.round(simNow), labels: cfg.labels, cam: { x: cam.x, y: cam.y, z: cam.z },
        people: people.map(function (p) { return { name: p.name, type: p.type, role: p.role || 'patron', state: p.state, playing: p.playing, mine: p.mine, act: activityLabel(p), x: +p.x.toFixed(1), y: +p.y.toFixed(1) }; }),
        staff: people.filter(function (p) { return p.role && p.role !== 'patron'; }).map(function (p) { return { name: p.name, role: p.role, state: p.state, job: p.job, part: p.part }; }),
        band: { parts: MUS && MUS.parts ? MUS.parts() : null, away: bandAgents.filter(function (b) { return b.state !== 'playing'; }).map(function (b) { return b.name; }) },
        orders: orders.filter(function (o) { return !o.cancelled && o.stage !== 'done'; }).length,
        rdr: { code: rdr.run && rdr.run.code, phase: rdr.run && rdr.run.lastPhase, players: rdr.bots.filter(function (b) { return !b.left; }).length, ver: rdr.build.ver },
        wall: wallMode
      };
    },
    event: randomEvent,
    preset: function (id) { applyPreset(id, true); },
    setClock: function (min) { venueMin = min; },
    closeNight: function () { venueMin = CLOSE; beginClosing(); },
    pause: function (on) { if (!!on !== paused) togglePause(); },
    setWall: setWall,
    setLabels: function (on) { cfg.labels = !!on; paintLabels(); },
    forceBandBreak: function (who) { return startBandBreak(who); },
    cfg: cfg
  };

  boot();
})();
