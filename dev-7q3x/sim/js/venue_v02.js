/* Zero to Phi · 0-Phi Room venue simulator v0.2
   v0.1 hangout, plus patrons who collide with and path around furniture,
   a living animated band, a 16:9 wall screen, a GyroForge sign that no longer
   overlaps names, and a coat-check / merch strip left of the stage. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search);
  var PS = window.ZTPPersonas, GAMES = window.ZTPSimGames || {}, MUS = window.ZTPVenueMusic, SCR = window.ZTPVenueScreens;
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var TYPES = ['curious', 'shy', 'competitive', 'drinking'];
  var TYPE_EMOTE = { curious: '\u{1F440}', shy: '\u{1F647}', competitive: '\u{1F525}', drinking: '\u{1F37A}' };
  var EM = { cheers: '\u{1F37A}', clap: '\u{1F44F}', cake: '\u{1F382}', eyes: '\u{1F440}', notes: '\u{1F3B5}', fire: '\u{1F525}', wow: '\u{1F62E}', laugh: '\u{1F602}', party: '\u{1F389}', phone: '\u{1F4F1}', heart: '\u{2764}\u{FE0F}', dash: '\u{1F4A8}', trophy: '\u{1F3C6}' };

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
    muted: Q.has('mute') || Q.has('shot') ? true : true
  };

  var rng = (PS && PS.rng) ? PS.rng(Q.get('seed') || Date.now() % 99991) : Math.random;
  function r() { return rng(); }
  function pick(a) { return a[Math.floor(r() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ------------------------------------------------------------------ clock: 7:00 PM -> 2:00 AM (minutes from midnight, 2am = 26:00)
  var OPEN = 19 * 60, CLOSE = 26 * 60;
  var venueMin = OPEN, paused = false, closed = false, recapShown = false;
  var lastTs = performance.now(), simOffset = 0, pauseAt = 0;
  function minPerSec() { return 0.45 + cfg.speed * 0.72; } // ~1: 1.17 min/s (~6 min night) … 5: 4.05 (~1.7 min) … 10: 7.65 (~55s)
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
    if (h >= 24.6) return 0.45;
    return 1;
  }
  function isRush() { var x = rush(); return x > 1.2; }
  function isLastCall() { return venueMin >= 25 * 60; }

  // ------------------------------------------------------------------ stats / log
  var stats = { joinedHour: 0, hourMark: 19, podRides: 0, gamesRdr: 0, gamesBub: 0, gamesOrb: 0, peak: 0, winners: [], events: { birthday: 0, tournament: 0, flicker: 0 }, busiest: { rdr: 0, bubble: 0, orbit: 0, pod: 0 } };
  var logEl = $('log');
  function log(text, kind) {
    if (!logEl) return;
    var d = document.createElement('div'); d.className = kind || '';
    d.textContent = clockLabel() + ' · ' + text;
    logEl.insertBefore(d, logEl.firstChild);
    while (logEl.childNodes.length > 48) logEl.removeChild(logEl.lastChild);
  }

  // ------------------------------------------------------------------ localStorage guard (don't clobber Justin's real RDR picks)
  var KEEP = ['rdr_name', 'rdr_room', 'rdr_char', 'rdr_setup', 'rdr_phonehost', 'rdr_client', 'rdr_stuffView', 'rdr_moved'], saved = {};
  KEEP.forEach(function (k) { try { saved[k] = localStorage.getItem(k); } catch (e) {} });
  function clearShared() { ['rdr_char', 'rdr_setup', 'rdr_phonehost', 'rdr_moved'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); }
  function restoreShared() { KEEP.forEach(function (k) { try { if (saved[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]); } catch (e) {} }); }
  window.addEventListener('pagehide', restoreShared);
  window.addEventListener('beforeunload', restoreShared);

  var myName = (function () { try { return localStorage.getItem('rdr_name') || ''; } catch (e) { return ''; } })() || 'Justin';

  // ------------------------------------------------------------------ furniture
  (function setupFurniture() {
    var b = $('bottles'), cols = ['#5ef2c8', '#ffd23f', '#ff6a9a', '#7aa8ff', '#ff9d3f', '#b98cff', '#8be36b', '#ff5a5a', '#fff'];
    for (var i = 0; i < 9; i++) { var el = document.createElement('i'); el.style.setProperty('--c', cols[i]); b.appendChild(el); }
    var st = $('stools');
    for (i = 0; i < 6; i++) { var s = document.createElement('div'); s.className = 'stool'; st.appendChild(s); }
    var tb = $('tables');
    [[22, 30], [58, 22], [38, 68], [72, 62]].forEach(function (p) {
      var t = document.createElement('div'); t.className = 'tbl'; t.style.left = p[0] + '%'; t.style.top = p[1] + '%';
      [[-28, 0], [28, 0], [0, -28], [0, 28]].forEach(function (c) {
        var ch = document.createElement('div'); ch.className = 'chair'; ch.style.left = 'calc(50% + ' + c[0] + 'px)'; ch.style.top = 'calc(50% + ' + c[1] + 'px)'; t.appendChild(ch);
      });
      tb.appendChild(t);
    });
    var band = $('band'), kit = [
      { cls: 'drum', ico: '\u{1F941}' },
      { cls: 'guitar', ico: '\u{1F3B8}' },
      { cls: 'keys', ico: '\u{1F3B9}' },
      { cls: 'vox', ico: '\u{1F3A4}' }
    ];
    for (i = 0; i < 4; i++) {
      var m = document.createElement('div'); m.className = 'bando play ' + kit[i].cls;
      m.innerHTML = '<div class="kit">' + kit[i].ico + '</div><div class="arms"><i class="arm-l"></i><i class="arm-r"></i></div><div class="head"></div><div class="body"></div>';
      band.appendChild(m);
    }
    if ($('bandstand')) $('bandstand').classList.add('lit');
  })();

  if (MUS && MUS.onBeat) MUS.onBeat(function () {
    var n = $('band').children, e = cfg.band / 10;
    for (var i = 0; i < n.length; i++) {
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
  // Furniture is solid. People walk around it, and bump off if they clip a corner.
  // States listed in `enter` may step into that piece (bar stools, seats around tables, a pod ride, etc.).
  var OBST = [
    { id: 'coat', kind: 'rect', x: 2, y: 2, w: 9, h: 16, enter: [] },
    { id: 'merch', kind: 'rect', x: 12, y: 2, w: 9, h: 16, enter: [] },
    { id: 'band', kind: 'rect', x: 22, y: 2, w: 56, h: 13, enter: [] },
    { id: 'wash', kind: 'rect', x: 2, y: 20, w: 14, h: 30, enter: ['wash'] },
    { id: 'food', kind: 'rect', x: 3, y: 58, w: 16, h: 16, enter: ['food'] },
    { id: 'bar', kind: 'rect', x: 85, y: 16, w: 13, h: 62, enter: [] },
    { id: 'pod', kind: 'circle', x: 50, y: 47, r: 8, enter: ['toPod', 'pod'] },
    { id: 'podcam', kind: 'rect', x: 60, y: 30, w: 14, h: 14, enter: [] },
    { id: 'rdr', kind: 'rect', x: 66, y: 68, w: 22, h: 22, enter: ['toRdr', 'playRdr', 'watchRdr'] },
    { id: 'bub', kind: 'rect', x: 36, y: 72, w: 22, h: 18, enter: ['toBub', 'playBub', 'watchBub'] },
    { id: 'orb', kind: 'rect', x: 14, y: 74, w: 18, h: 17, enter: ['toOrb', 'playOrb', 'watchOrb'] },
    { id: 't0', kind: 'circle', x: 30, y: 42, r: 4.6, enter: [] },
    { id: 't1', kind: 'circle', x: 46, y: 38, r: 4.6, enter: [] },
    { id: 't2', kind: 'circle', x: 38, y: 58, r: 4.6, enter: [] },
    { id: 't3', kind: 'circle', x: 52, y: 56, r: 4.6, enter: [] }
  ];
  var GW = 40, GH = 34;
  function cellX(x) { return clamp(Math.round(x / 100 * (GW - 1)), 0, GW - 1); }
  function cellY(y) { return clamp(Math.round(y / 100 * (GH - 1)), 0, GH - 1); }
  function worldX(i) { return (i + 0.5) / GW * 100; }
  function worldY(j) { return (j + 0.5) / GH * 100; }
  function hitsObst(o, x, y, pad) {
    pad = pad || 0;
    if (o.kind === 'circle') return Math.hypot(x - o.x, y - o.y) < (o.r + pad);
    return x >= o.x - pad && x <= o.x + o.w + pad && y >= o.y - pad && y <= o.y + o.h + pad;
  }
  function canEnter(o, p) {
    if (!p) return false;
    var st = p.state || '';
    if (o.enter && o.enter.indexOf(st) >= 0) return true;
    // seats sit just outside table circles; bar stools sit just left of the bar body
    return false;
  }
  function blockedAt(x, y, p, pad) {
    if (x < 1 || x > 99 || y < 0 || y > 106) return y < 0 || y > 106 || x < 1 || x > 99;
    for (var i = 0; i < OBST.length; i++) {
      if (canEnter(OBST[i], p)) continue;
      if (hitsObst(OBST[i], x, y, pad || 0.6)) return true;
    }
    return false;
  }
  function pushOut(p) {
    if (!blockedAt(p.x, p.y, p, 0.2)) return false;
    var best = null, bd = 99, a, d, nx, ny, k;
    for (k = 0; k < 16; k++) {
      a = (k / 16) * Math.PI * 2; d = 1.8;
      nx = p.x + Math.cos(a) * d; ny = p.y + Math.sin(a) * d;
      if (!blockedAt(nx, ny, p, 0.2)) {
        var dd = Math.hypot(nx - p.x, ny - p.y);
        if (dd < bd) { bd = dd; best = { x: nx, y: ny }; }
      }
    }
    if (!best) {
      for (d = 3; d <= 12 && !best; d += 2) {
        for (k = 0; k < 12; k++) {
          a = (k / 12) * Math.PI * 2;
          nx = p.x + Math.cos(a) * d; ny = p.y + Math.sin(a) * d;
          if (!blockedAt(nx, ny, p, 0.2)) { best = { x: nx, y: ny }; break; }
        }
      }
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
    var gx = tx, gy = ty;
    var dest = walkableDest(tx, ty, p);
    // if the real target is inside an allowed obstacle (pod, wash, station), keep it
    if (blockedAt(tx, ty, p, 0.2) === false || (p && p.state && ['toPod', 'pod', 'wash', 'food', 'toRdr', 'playRdr', 'watchRdr', 'toBub', 'playBub', 'watchBub', 'toOrb', 'playOrb', 'watchOrb', 'bar', 'sit'].indexOf(p.state) >= 0 && blockedAt(tx, ty, { state: p.state }, 0.2) === false)) {
      dest = { x: tx, y: ty };
    } else if (['toPod', 'pod', 'wash', 'food', 'toRdr', 'playRdr', 'watchRdr', 'toBub', 'playBub', 'watchBub', 'toOrb', 'playOrb', 'watchOrb', 'bar'].indexOf(p.state) >= 0) {
      dest = { x: tx, y: ty };
    }
    gx = dest.x; gy = dest.y;
    var sx = cellX(p.x), sy = cellY(p.y), ex = cellX(gx), ey = cellY(gy);
    if (sx === ex && sy === ey) return [{ x: gx, y: gy }];
    // A* on a coarse grid
    var key = function (i, j) { return i + j * GW; };
    var open = [{ i: sx, j: sy, g: 0, f: Math.abs(ex - sx) + Math.abs(ey - sy), from: -1 }];
    var seen = {}; seen[key(sx, sy)] = 0;
    var nodes = [open[0]], came = {}, found = null, guard = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length && guard++ < 800) {
      var bi = 0;
      for (var n = 1; n < open.length; n++) if (open[n].f < open[bi].f) bi = n;
      var cur = open.splice(bi, 1)[0];
      if (cur.i === ex && cur.j === ey) { found = cur; break; }
      for (var d = 0; d < dirs.length; d++) {
        var ni = cur.i + dirs[d][0], nj = cur.j + dirs[d][1];
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        var wx = worldX(ni), wy = worldY(nj);
        // allow the destination cell even if it sits in an enterable obstacle
        var atEnd = (ni === ex && nj === ey);
        if (!atEnd && blockedAt(wx, wy, p, 0.7)) continue;
        if (atEnd && blockedAt(wx, wy, p, 0.2) && blockedAt(gx, gy, p, 0.2)) {
          // still allow if this is the requested destination
        }
        var cost = cur.g + (dirs[d][0] && dirs[d][1] ? 1.4 : 1);
        var k = key(ni, nj);
        if (seen[k] != null && seen[k] <= cost) continue;
        seen[k] = cost;
        var nd = { i: ni, j: nj, g: cost, f: cost + Math.abs(ex - ni) + Math.abs(ey - nj), from: nodes.length };
        // store parent index of cur
        nd.parent = cur;
        open.push(nd); nodes.push(nd);
      }
    }
    var pts = [{ x: gx, y: gy }];
    if (found) {
      var chain = [];
      var c = found;
      while (c) { chain.push(c); c = c.parent; }
      chain.reverse();
      pts = [];
      for (var i = 1; i < chain.length; i++) pts.push({ x: worldX(chain[i].i), y: worldY(chain[i].j) });
      pts.push({ x: gx, y: gy });
      // skip almost-straight midpoints
      if (pts.length > 2) {
        var slim = [pts[0]];
        for (i = 1; i < pts.length - 1; i++) {
          var a = slim[slim.length - 1], b = pts[i], c2 = pts[i + 1];
          var abx = b.x - a.x, aby = b.y - a.y, bcx = c2.x - b.x, bcy = c2.y - b.y;
          var cross = Math.abs(abx * bcy - aby * bcx);
          if (cross > 8) slim.push(b);
        }
        slim.push(pts[pts.length - 1]);
        pts = slim;
      }
    }
    return pts;
  }
  function setPath(p, x, y) {
    p.gx = x; p.gy = y;
    p.path = routeTo(p, x, y) || [{ x: x, y: y }];
    p.pi = 0;
    var w = p.path[0];
    p.tx = w.x; p.ty = w.y;
  }
  function peopleHits() {
    var n = 0;
    people.forEach(function (p) {
      if (p.state === 'leave' || p.state === 'enter' || p.state === 'wash' || p.state === 'pod') return;
      if (blockedAt(p.x, p.y, p, 0.15)) n++;
    });
    return n;
  }

  // ------------------------------------------------------------------ people
  var people = [];
  var pid = 0, usedNames = {};
  var stools = [0, 1, 2, 3, 4, 5].map(function (i) { return { i: i, x: 80, y: 28 + i * 9, who: null }; });
  var seats = [];
  [[30, 42], [46, 38], [38, 58], [52, 56]].forEach(function (t) {
    [[-6, 0], [6, 0], [0, -6], [0, 6]].forEach(function (c) { seats.push({ x: t[0] + c[0], y: t[1] + c[1], who: null }); });
  });
  var washBusy = [false, false];

  function mixType() {
    var m = PRESETS[cfg.preset].mix, x = r(), a = m.curious, b = a + m.shy, c = b + m.competitive;
    return x < a ? 'curious' : x < b ? 'shy' : x < c ? 'competitive' : 'drinking';
  }
  function makePerson(atDoor, group) {
    var persona = PS ? PS.make(pid, r, usedNames) : { id: 'p' + pid, name: 'Guest' + pid, look: '', color: '#ffd23f' };
    pid++;
    var p = {
      id: persona.id || ('p' + pid), name: persona.name, look: persona.look || '', color: persona.color || '#ffd23f',
      type: mixType(), x: 50 + (r() - 0.5) * 6, y: 102, tx: 50, ty: 90, state: 'enter', since: Date.now(),
      drink: 0, playing: null, bot: null, seat: null, stool: null, wash: -1, rideUntil: 0, group: group || 0,
      mine: false, wob: r() * 6, el: null
    };
    if (!atDoor) { p.x = 20 + r() * 60; p.y = 30 + r() * 50; p.state = 'wander'; pushOut(p); pickDest(p); }
    var el = document.createElement('div'); el.className = 'person'; el.style.setProperty('--c', p.color);
    el.innerHTML = '<div class="shadow"></div><div class="body"></div><div class="head">' + (p.look || '') + '</div><div class="nam">' + p.name + '</div>';
    $('actors').appendChild(el); p.el = el;
    people.push(p);
    if (atDoor) { /* door is clear */ } else { pushOut(p); }
    return p;
  }
  function removePerson(p) {
    if (p.bot) dropRdrPhone(p.bot);
    if (p.seat) p.seat.who = null;
    if (p.stool) p.stool.who = null;
    if (p.wash >= 0) washBusy[p.wash] = false;
    if (p.playing === 'pod') endPod(p);
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
  function goTo(p, x, y, state) { p.state = state; p.since = Date.now(); setPath(p, x, y); }

  function decide(p) {
    if (p.mine && p.playing) return;
    if (closed || isLastCall() && r() < 0.4) { goTo(p, 50, 106, 'leave'); return; }
    var cur = cfg.curiosity / 10, comp = cfg.compete / 10, drink = cfg.drinks / 10 * PRESETS[cfg.preset].drinks;
    var dance = PRESETS[cfg.preset].dance * (cfg.band / 10);
    var w = [
      ['bar', 0.14 + drink * 0.22 + (p.type === 'drinking' ? 0.28 : 0)],
      ['sit', 0.14 + (p.type === 'shy' ? 0.22 : 0)],
      ['watch', 0.1 + cur * 0.16],
      ['dance', 0.04 + dance * 0.22 + (cfg.preset === 'concert' ? 0.18 : 0)],
      ['wash', 0.05],
      ['food', 0.06],
      ['rdr', 0.04 + cur * 0.1 + comp * 0.14 + (p.type === 'competitive' ? 0.16 : 0) + (p.type === 'curious' ? 0.1 : 0)],
      ['bubble', 0.04 + comp * 0.1 + cur * 0.05],
      ['orbit', 0.04 + cur * 0.08 + comp * 0.08],
      ['pod', 0.05 + cur * 0.14],
      ['wander', 0.12 + (p.type === 'curious' ? 0.1 : 0)]
    ];
    if (p.type === 'shy') { w.forEach(function (x) { if (x[0] === 'rdr' || x[0] === 'orbit' || x[0] === 'pod') x[1] *= 0.35; }); }
    if (p.type === 'drinking') { w.forEach(function (x) { if (x[0] === 'rdr' || x[0] === 'orbit') x[1] *= 0.45; }); }
    var sum = 0; w.forEach(function (x) { sum += x[1]; });
    var x = r() * sum, acc = 0, choice = 'wander';
    for (var i = 0; i < w.length; i++) { acc += w[i][1]; if (x <= acc) { choice = w[i][0]; break; } }
    startAction(p, choice);
  }
  function startAction(p, choice) {
    if (p.seat) { p.seat.who = null; p.seat = null; }
    if (p.stool) { p.stool.who = null; p.stool = null; }
    if (choice === 'bar') {
      var s = freeStool(); if (s) { s.who = p; p.stool = s; goTo(p, s.x, s.y, 'bar'); } else startAction(p, 'sit');
    } else if (choice === 'sit') {
      var t = freeSeat(); if (t) { t.who = p; p.seat = t; goTo(p, t.x, t.y, 'sit'); } else goTo(p, 40 + r() * 20, 50 + r() * 10, 'wander');
    } else if (choice === 'watch') {
      goTo(p, 55 + r() * 16, 30 + r() * 8, 'watch');
    } else if (choice === 'dance') {
      goTo(p, 40 + r() * 20, 24 + r() * 8, 'dance');
    } else if (choice === 'wash') {
      var slot = !washBusy[0] ? 0 : !washBusy[1] ? 1 : -1;
      if (slot < 0) { pickDest(p); p.state = 'wander'; return; }
      washBusy[slot] = true; p.wash = slot; goTo(p, 8, 36 + slot * 8, 'wash');
    } else if (choice === 'food') {
      goTo(p, 12, 70, 'food');
    } else if (choice === 'rdr') {
      goTo(p, 74 + r() * 6, 80 + r() * 6, 'toRdr');
    } else if (choice === 'bubble') {
      goTo(p, 44 + r() * 8, 82 + r() * 5, 'toBub');
    } else if (choice === 'orbit') {
      goTo(p, 22 + r() * 6, 84 + r() * 4, 'toOrb');
    } else if (choice === 'pod') {
      goTo(p, 50, 52, 'toPod');
    } else {
      pickDest(p); p.state = 'wander'; p.since = Date.now();
    }
  }

  var bubPlayers = [], orbPlayers = [], podRider = null, bubT = 0, orbT = 0;

  function tryJoinRdr(p) {
    if (p.playing || !rdr.run) { p.state = 'watchRdr'; return; }
    var n = rdr.bots.filter(function (b) { return !b.left; }).length;
    var shyLeave = p.type === 'shy' && n >= 2 && r() < 0.5;
    var drinkSkip = p.type === 'drinking' && r() < 0.45;
    if (n >= 4 || shyLeave || drinkSkip) { p.state = 'watchRdr'; emote(p, EM.eyes); return; }
    if (spawnRdrPhone(p, false)) { p.state = 'playRdr'; emote(p, EM.phone); }
    else { p.state = 'watchRdr'; }
  }
  function tryJoinBub(p) {
    if (bubPlayers.length >= 2) { p.state = 'watchBub'; return; }
    bubPlayers.push(p); p.playing = 'bubble'; p.state = 'playBub'; stats.joinedHour++; stats.busiest.bubble++;
    emote(p, EM.fire); log(p.name + ' grabs a Bubble Hockey rod');
    if (bubPlayers.length === 2) bubT = Date.now() + 18000 + r() * 18000;
  }
  function tryJoinOrb(p) {
    if (orbPlayers.length >= 2) { p.state = 'watchOrb'; return; }
    orbPlayers.push(p); p.playing = 'orbit'; p.state = 'playOrb'; stats.joinedHour++; stats.busiest.orbit++;
    emote(p, EM.wow); log(p.name + ' sits down at Orbit Brawl');
    if (orbPlayers.length && !orbT) orbT = Date.now() + 20000 + r() * 20000;
  }
  function tryJoinPod(p) {
    if (podRider) { p.state = 'wander'; pickDest(p); return; }
    startPod(p);
  }
  function startPod(p) {
    podRider = p; p.playing = 'pod'; p.state = 'pod'; p.rideUntil = Date.now() + 16000 + r() * 8000;
    $('pod').classList.add('lit'); podFlight.setLit(true); wallFlight.setLit(true);
    stats.podRides++; stats.busiest.pod++;
    log(p.name + ' straps into the GyroForge pod', 'ev');
    emote(p, EM.wow);
    if (wallMode === 'site' || wallMode === 'ads') { wallForced = wallMode; setWall('pod', true); }
  }
  function endPod(p) {
    if (podRider === p) podRider = null;
    p.playing = null; p.rideUntil = 0;
    $('pod').classList.remove('lit'); podFlight.setLit(false); wallFlight.setLit(false);
    if (wallForced) { setWall(wallForced, true); wallForced = false; }
  }
  function endSession(list, kind) {
    if (kind === 'bubble') { stats.gamesBub++; log('Bubble Hockey game over', 'ev'); }
    if (kind === 'orbit') { stats.gamesOrb++; log('Orbit Brawl match over', 'ev'); }
    list.forEach(function (p) { p.playing = null; p.state = 'wander'; pickDest(p); if (r() < 0.5) emote(p, EM.clap); });
    list.length = 0;
  }

  function moveToward(p, dt) {
    var sp = (p.type === 'competitive' ? 14 : p.type === 'shy' ? 8 : 11) * dt;
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
    if (p.drink > 0.4) { nx += Math.sin(performance.now() / 280 + p.wob) * p.drink * 0.08; }
    // collide: if the next step is inside furniture, bump and path around
    if (blockedAt(nx, ny, p, 0.5)) {
      if (!p._bumped || (performance.now() - p._bumped) > 700) { bump(p); p._bumped = performance.now(); }
      pushOut(p);
      setPath(p, p.gx != null ? p.gx : p.tx, p.gy != null ? p.gy : p.ty);
      return false;
    }
    p.x = nx; p.y = ny;
    return false;
  }
  function placeEl(p) {
    p.el.style.left = p.x + '%'; p.el.style.top = p.y + '%';
    p.el.classList.toggle('dance', p.state === 'dance' || p.state === 'pod');
    p.el.classList.toggle('playing', !!p.playing);
    p.el.classList.toggle('mine', !!p.mine);
    if (p.bot && p.bot.chip) { p.bot.chip.style.left = (p.x + 3) + '%'; p.bot.chip.style.top = (p.y - 4) + '%'; }
  }

  function tickPerson(p, now, dt) {
    var arrived = moveToward(p, dt);
    if (p.state === 'enter') {
      if (arrived || p.y < 92) decide(p);
    } else if (p.state === 'leave') {
      if (p.y > 104) removePerson(p);
    } else if (p.state === 'wander') {
      if (arrived) pickDest(p);
      if (now - p.since > 4000 + r() * 5000) decide(p);
    } else if (p.state === 'bar' || p.state === 'sit') {
      if (arrived && now - p.since > 200) {
        if (p.state === 'bar') { p.drink = Math.min(1, p.drink + 0.15 * (cfg.drinks / 10 + 0.3)); if (r() < 0.25 + cfg.drinks * 0.04) emote(p, EM.cheers); }
        if (p.state === 'sit' && r() < 0.08 + cfg.drinks * 0.02) emote(p, pick([EM.laugh, EM.cheers, EM.notes]));
      }
      if (now - p.since > 8000 + r() * 12000) decide(p);
    } else if (p.state === 'watch') {
      if (arrived && r() < 0.12 + cfg.drinks * 0.02) emote(p, pick([EM.notes, EM.clap, EM.eyes, EM.wow]));
      if (now - p.since > 7000 + r() * 8000) decide(p);
    } else if (p.state === 'dance') {
      p.el.classList.add('dance');
      if (r() < 0.08 + cfg.band * 0.015) emote(p, EM.notes);
      if (now - p.since > 8000 + r() * 10000) decide(p);
    } else if (p.state === 'wash') {
      if (arrived && p.el.style.opacity !== '0') p.el.style.opacity = '0';
      if (now - p.since > 6000 + r() * 8000) {
        p.el.style.opacity = '1'; washBusy[p.wash] = false; p.wash = -1; decide(p);
      }
    } else if (p.state === 'food') {
      if (arrived && now - p.since > 2500) { emote(p, '\u{1F355}'); decide(p); }
    } else if (p.state === 'toRdr') {
      if (arrived) tryJoinRdr(p);
    } else if (p.state === 'toBub') {
      if (arrived) tryJoinBub(p);
    } else if (p.state === 'toOrb') {
      if (arrived) tryJoinOrb(p);
    } else if (p.state === 'toPod') {
      if (arrived) tryJoinPod(p);
    } else if (p.state === 'playRdr' || p.state === 'watchRdr') {
      if (p.state === 'watchRdr' && r() < 0.06) emote(p, pick([EM.wow, EM.eyes, EM.clap]));
      // leave mid-game?
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
      if (now >= p.rideUntil) { endPod(p); emote(p, EM.clap); decide(p); }
    }
    placeEl(p);
  }

  // ------------------------------------------------------------------ arrivals
  var nextArrive = 0;
  function arriveDelay() {
    var base = 14000 - cfg.arrive * 1100; // 1: 12.9s, 5: 8.5s, 10: 3s
    var cap = Math.round(cfg.crowd * PRESETS[cfg.preset].crowd);
    var room = cap - people.length;
    if (room <= 0) return 8000 + r() * 6000;
    return Math.max(600, (base / rush()) * (0.7 + r() * 0.6));
  }
  function tickArrivals(now) {
    if (closed || isLastCall()) return;
    if (now >= nextArrive) {
      var cap = Math.round(cfg.crowd * PRESETS[cfg.preset].crowd);
      if (people.length < cap) {
        var p = makePerson(true);
        log(p.name + ' walks in (' + p.type + ')');
        if (r() < 0.15 + cfg.drinks * 0.02) emote(p, pick([EM.notes, EM.cheers, EM.eyes]));
      }
      nextArrive = now + arriveDelay();
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
    var g = Date.now();
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
    people.forEach(function (p, i) {
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
      people.forEach(function (p) { if (r() < 0.5) emote(p, pick([EM.wow, EM.laugh, EM.dash])); });
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
    var watch = 0, play = 0;
    people.forEach(function (p) {
      if (p.playing) play++;
      else if (p.state === 'watch' || p.state === 'watchRdr' || p.state === 'watchBub' || p.state === 'watchOrb' || p.state === 'dance') watch++;
    });
    return { n: people.length, watch: watch, play: play };
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
  }
  function applyBand() { if (MUS) MUS.setEnergy(cfg.band / 10); }

  // ------------------------------------------------------------------ recap
  function beginClosing() {
    if (closed) return;
    closed = true;
    venueMin = Math.max(venueMin, CLOSE);
    if (bubPlayers.length) { stats.gamesBub++; bubPlayers = []; }
    if (orbPlayers.length) { stats.gamesOrb++; orbPlayers = []; }
    people.forEach(function (p) { if (!p.mine) goTo(p, 50, 106, 'leave'); });
    log('Last call — the doors are closing', 'ev');
    setTimeout(showRecap, 2800);
  }
  function showRecap() {
    if (recapShown) return; recapShown = true; closed = true;
    var top = '—', counts = {};
    stats.winners.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
    var best = 0; Object.keys(counts).forEach(function (n) { if (counts[n] > best) { best = counts[n]; top = n + ' (' + best + ' table' + (best > 1 ? 's' : '') + ')'; } });
    var busy = Object.keys(stats.busiest).sort(function (a, b) { return stats.busiest[b] - stats.busiest[a]; })[0];
    var busyName = { rdr: 'Red Deer Rich', bubble: 'Bubble Hockey', orbit: 'Orbit Brawl', pod: 'GyroForge' }[busy];
    var games = stats.gamesRdr + stats.gamesBub + stats.gamesOrb;
    $('recapSub').textContent = 'The 0-\u03a6 Room has closed. What a night.';
    $('recapDl').innerHTML =
      '<dt>Peak crowd</dt><dd>' + stats.peak + '</dd>' +
      '<dt>Games played</dt><dd>' + games + ' <small style="color:#9a96ad;font-weight:500">(' + stats.gamesRdr + ' Red Deer Rich · ' + stats.gamesBub + ' Bubble · ' + stats.gamesOrb + ' Orbit)</small></dd>' +
      '<dt>Top player</dt><dd>' + top + '</dd>' +
      '<dt>Pod rides</dt><dd>' + stats.podRides + '</dd>' +
      '<dt>Busiest station</dt><dd>' + busyName + '</dd>' +
      '<dt>Moments</dt><dd>' + stats.events.birthday + ' birthdays · ' + stats.events.tournament + ' tournaments · ' + stats.events.flicker + ' flickers</dd>';
    $('recap').classList.add('show');
    log('Last call — here is the night recap', 'ev');
  }
  function newNight() {
    $('recap').classList.remove('show');
    people.slice().forEach(removePerson);
    rdr.bots.slice().forEach(function (b) { dropRdrPhone(b); });
    rdr.bots = []; bubPlayers = []; orbPlayers = []; podRider = null; bubT = 0; orbT = 0;
    stats = { joinedHour: 0, hourMark: 19, podRides: 0, gamesRdr: 0, gamesBub: 0, gamesOrb: 0, peak: 0, winners: [], events: { birthday: 0, tournament: 0, flicker: 0 }, busiest: { rdr: 0, bubble: 0, orbit: 0, pod: 0 } };
    venueMin = OPEN; closed = false; recapShown = false;
    if (rdr.tv) { try { rdr.tv.src = 'about:blank'; } catch (e) {} }
    startRdr();
    seedCrowd(Math.max(4, Math.round(cfg.crowd * 0.45)));
    nextArrive = Date.now() + 2000;
    log('Doors open. Another night in the 0-\u03a6 Room.', 'sys');
  }

  function seedCrowd(n) {
    for (var i = 0; i < n; i++) {
      var p = makePerson(false);
      if (r() < 0.5) decide(p);
    }
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
  }
  function paintMute() {
    $('bMute').classList.toggle('on', cfg.muted);
    $('bMute').textContent = cfg.muted ? 'Muted' : 'Band on';
  }
  function togglePause() {
    paused = !paused;
    if (paused) pauseAt = Date.now();
    else if (pauseAt) simOffset += Date.now() - pauseAt;
    $('bPause').textContent = paused ? 'Resume' : 'Pause';
    $('bPause').classList.toggle('on', paused);
    var A = adapter();
    if (A && rdr.tv) try { A.setPaused(rdr.tv.contentWindow, paused); } catch (e) {}
    log(paused ? 'Paused' : 'Back in motion', 'sys');
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
      startPod(p); p.rideUntil = Date.now() + 22000;
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
      venueMin += minPerSec() * dt;
      if (venueMin >= CLOSE && !closed) beginClosing();
      tickArrivals(ts);
      people.slice().forEach(function (p) { tickPerson(p, ts, dt); });
      tickRdr(ts);
      tickToys(ts, dt);
      // mid-game leave already handled; leftover wash doors
    }
    try { adReel.tick(ts); } catch (e) {}
    try { podFlight.tick(dt); } catch (e) {}
    try { wallFlight.tick(dt); } catch (e) {}
    try { orbMini.tick(dt); } catch (e) {}
    try { if (mePerson && mePerson._meFlight) mePerson._meFlight.tick(dt); } catch (e) {}
    paintNight(); paintStats();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    bindUi();
    applyPreset(cfg.preset, false);
    paintSliders(); paintMute(); applyBand();
    if (MUS) { MUS.setVolume(0.42); MUS.mute(true); MUS.setTrack(PRESETS[cfg.preset].music); }
    setWall('site', true);
    $('hint').classList.add('show');
    var nSeed = Q.has('shot') ? Math.max(12, cfg.crowd - 2) : Math.max(5, Math.round(cfg.crowd * 0.5));
    pickBuild(function (b) {
      rdr.build = b;
      startRdr();
      seedCrowd(nSeed);
      nextArrive = Date.now() + 1800;
      log('Doors open on a ' + PRESETS[cfg.preset].name + ' night. Band is playing ' + (MUS ? MUS.state().title : 'the room tune') + ' (muted until you unmute). Red Deer Rich TV is ' + b.ver + '.', 'sys');
      if (Q.get('event')) setTimeout(function () { randomEvent(Q.get('event')); }, 1200);
    });
    requestAnimationFrame(loop);
  }

  window.ZTPVenue = {
    state: function () {
      return { clock: clockLabel(), minutes: venueMin, paused: paused, closed: closed, preset: cfg.preset, cfg: cfg, stats: stats, hits: peopleHits(), people: people.map(function (p) { return { name: p.name, type: p.type, state: p.state, playing: p.playing, mine: p.mine, x: +p.x.toFixed(1), y: +p.y.toFixed(1) }; }), rdr: { code: rdr.run && rdr.run.code, phase: rdr.run && rdr.run.lastPhase, players: rdr.bots.filter(function (b) { return !b.left; }).length, ver: rdr.build.ver }, wall: wallMode };
    },
    event: randomEvent,
    preset: function (id) { applyPreset(id, true); },
    setClock: function (min) { venueMin = min; },
    closeNight: function () { venueMin = CLOSE; beginClosing(); },
    pause: function (on) { if (!!on !== paused) togglePause(); },
    setWall: setWall,
    cfg: cfg
  };

  boot();
})();
