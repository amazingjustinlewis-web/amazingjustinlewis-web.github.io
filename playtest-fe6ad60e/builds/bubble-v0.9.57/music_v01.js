// Bubble Hockey music v01 (dev) - synth stand-ins in the spirit of the NES 2A03: 2 pulse leads (12.5/25/50% duty),
// 1 triangle bass (4-bit stepped), 1 noise drum channel. Original compositions, laid out from Justin's hummed spec.
// Cues: rush (game start / after a goal's face-off), loop (soft techno under play), goal (half-time fanfare through
// the replay), settle ("ra-pa-tu-pa-paaah", lands its held note as players settle, then the whistle drops the puck).
// Live: Web Audio lookahead scheduling, per-cue buses with crossfades. Mute: the corner note button or the M key (remembered).
(function (root) {
  var BPM = 128, B = 60 / BPM, S = B / 4;   // beat and 16th in seconds
  var MASTER = 0.16, LOOPV = 0.55, SETTLE_FILL = 4 * S * 1.5;   // fill length of the settle cue before its held note
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  // ---------- channel voices ----------
  function Chip(ctx) {
    this.ctx = ctx; this.waves = {};
    var self = this;
    [0.125, 0.25, 0.5].forEach(function (d) { var n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (var k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * d);
      self.waves[d] = ctx.createPeriodicWave(re, im); });
    // NES triangle: 32-step, 4-bit quantised; build from sampled shape via DFT
    var N = 32, sh = [], re = new Float32Array(24), im = new Float32Array(24);
    for (var i = 0; i < N; i++) { var v = i < 16 ? 15 - i : i - 16; sh.push((v / 7.5) - 1); }
    for (var k = 1; k < 24; k++) { var r = 0, m = 0; for (i = 0; i < N; i++) { r += sh[i] * Math.cos(2 * Math.PI * k * i / N); m += sh[i] * Math.sin(2 * Math.PI * k * i / N); } re[k] = r / N * 2; im[k] = m / N * 2; }
    this.tri = ctx.createPeriodicWave(re, im);
    // noise: 15-bit LFSR, long mode and short (metallic) mode
    function lfsr(len, shortMode) { var b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), reg = 1, step = Math.max(1, Math.round(ctx.sampleRate / 22000)), v = 0;
      for (var i = 0; i < len; i++) { if (i % step === 0) { var fb = (reg & 1) ^ ((reg >> (shortMode ? 6 : 1)) & 1); reg = (reg >> 1) | (fb << 14); v = (reg & 1) ? 1 : -1; } d[i] = v; } return b; }
    this.nLong = lfsr(ctx.sampleRate, false); this.nShort = lfsr(ctx.sampleRate >> 3, true);
  }
  // e: {ch:'p1'|'p2'|'tri'|'noise', t (sec, absolute), m (midi) | nk (noise kind), d (sec), v, duty, vib, slide}
  Chip.prototype.play = function (e, out) {
    var c = this.ctx, g = c.createGain(), t = e.t, d = e.d, v = e.v == null ? 0.5 : e.v;
    if (e.ch === 'noise') {
      var src = c.createBufferSource(), f = c.createBiquadFilter(); src.buffer = e.nk === 'hat' || e.nk === 'chh' ? this.nShort : this.nLong; src.loop = true;
      var kind = e.nk, dec = { kick: .09, snare: .16, hat: .035, chh: .02, crash: 1.1, roll: .06 }[kind] || .1;
      f.type = kind === 'kick' ? 'lowpass' : 'highpass'; f.frequency.value = { kick: 380, snare: 1200, hat: 6000, chh: 7500, crash: 2500, roll: 1500 }[kind] || 1000;
      if (kind === 'kick') src.playbackRate.setValueAtTime(0.5, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .002); g.gain.setTargetAtTime(0, t + .004, dec / 3);
      src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dec * 2.5 + .05);
      if (kind === 'kick') { // the classic NES kick borrows a fast triangle pitch-drop; done on the noise bus here to keep the triangle free
        var o = c.createOscillator(), og = c.createGain(); o.setPeriodicWave(this.tri); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .08);
        og.gain.setValueAtTime(v * 1.1, t); og.gain.setTargetAtTime(0, t + .01, .03); o.connect(og); og.connect(out); o.start(t); o.stop(t + .2); }
      return;
    }
    var o = c.createOscillator(); if (e.ch === 'tri') o.setPeriodicWave(this.tri); else o.setPeriodicWave(this.waves[e.duty || .5]);
    o.frequency.setValueAtTime(hz(e.m), t); if (e.slide) o.frequency.exponentialRampToValueAtTime(hz(e.m + e.slide), t + d);
    if (e.vib) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz(e.m) * .012 * e.vib, t + Math.min(d, .35)); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + .1); }
    var a = e.a || .004, rel = e.r || .03;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (e.decay) g.gain.setTargetAtTime(v * e.decay, t + a, d / 3);
    g.gain.setValueAtTime(e.decay ? v * e.decay : v, t + Math.max(a, d - rel)); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .02);
  };
  // ---------- compositions (times in 16ths) ----------
  function N(ch, s, m, len, v, x) { var e = { ch: ch, s: s, m: m, len: len, v: v }; if (x) for (var k in x) e[k] = x[k]; return e; }
  function Z(s, nk, v) { return { ch: 'noise', s: s, nk: nk, len: 1, v: v }; }
  var CUES = {};
  // 1) RUSH: rapid 16th hits around one pitch, then a big held note. Key of A minor; lands on the 5th (E) for lift.
  CUES.rush = (function () { var ev = [], hits = [64, 64, 64, 64, 64, 64, 66, 67];
    hits.forEach(function (m, i) { ev.push(N('p1', i, m + 12, 1, .5, { duty: .25, r: .02 })); ev.push(N('p2', i, m + 7, 1, .32, { duty: .125, r: .02 })); ev.push(Z(i, i % 2 ? 'chh' : 'hat', .3)); });
    ev.push(N('p1', 8, 76, 14, .55, { duty: .5, vib: 1, decay: .7 })); ev.push(N('p2', 8, 71, 14, .38, { duty: .25, vib: .6, decay: .6 }));
    ev.push(N('tri', 0, 45, 2, .7)); ev.push(N('tri', 4, 45, 2, .7)); ev.push(N('tri', 8, 40, 14, .8, { slide: 0 }));
    ev.push(Z(8, 'crash', .45)); ev.push(Z(8, 'kick', .6));
    return { ev: ev, len: 22, loop: false }; })();
  // 2) LOOP: 8-bar soft chiptune techno. Bar 1 = intro (busy hat fill + crash), bars 2-8 steady four-on-the-floor.
  // Progression Am - F - C - G - Am - F - Dm - E (A minor). Pulse2 = low 12.5% drone pad, pulse1 = sparse soft arp.
  CUES.loop = (function () { var ev = [], roots = [45, 41, 48, 43, 45, 41, 38, 40], pads = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62], [57, 60, 64], [57, 60, 65], [57, 62, 65], [56, 59, 64]];
    for (var b = 0; b < 8; b++) { var o = b * 16, r = roots[b], P = pads[b];
      for (var s = 0; s < 16; s += 2) ev.push(N('tri', o + s, s % 4 ? r + 12 : r, 2, .55, { r: .02 }));
      ev.push(N('p2', o, P[0] - 12, 16, .14, { duty: .125, a: .25, r: .2 }));
      var arp = [P[0], P[1], P[2], P[1] + 12]; [2, 6, 10, 14].forEach(function (st, j) { if ((b + j) % 3 !== 2) ev.push(N('p1', o + st, arp[(j + b) % 4] + 12, 1, .12, { duty: .25, decay: .4 })); });
      for (s = 0; s < 16; s++) {
        if (b === 0) { ev.push(Z(o + s, s % 4 === 0 ? 'kick' : (s >= 12 ? 'roll' : 'hat'), s % 4 === 0 ? .5 : .16 + s * .012)); continue; }
        if (b === 1 && s === 0) { ev.push(Z(o, 'crash', .32)); continue; }
        if (s % 4 === 0) ev.push(Z(o + s, 'kick', .5)); else if (s === 4 + 2 || s === 12 + 2) ev.push(Z(o + s, 'hat', .2)); else if (s === 4 || s === 12) ev.push(Z(o + s, 'snare', .3)); else ev.push(Z(o + s, 'chh', s % 2 ? .07 : .11));
      } }
    return { ev: ev, len: 128, loop: true }; })();
  // 3) GOAL: half-time triumph, brass-like pulse blasts on downbeats in thirds, snare-roll fills. 4 bars, loops through the replay.
  CUES.goal = (function () { var ev = [], bl = [[72, 76, 48], [74, 77, 50], [76, 79, 52], [77, 81, 53]];
    var pick = [[67, 69, 71], [69, 71, 72], [71, 72, 74], [72, 74, 76]];
    for (var b = 0; b < 4; b++) { var o = b * 16, x = bl[b];
      ev.push(N('p1', o, x[1], 6, .5, { duty: .5, a: .01, vib: .8, decay: .65 })); ev.push(N('p2', o, x[0], 6, .36, { duty: .25, a: .01, decay: .6 }));
      ev.push(N('p1', o + 8, x[1] - 2, 2, .38, { duty: .5 })); ev.push(N('p2', o + 8, x[0] - 3, 2, .26, { duty: .25 }));
      pick[b].forEach(function (m, j) { ev.push(N('p1', o + 12 + j, m + 12, 1, .32, { duty: .25 })); });
      ev.push(N('tri', o, x[2], 6, .75)); ev.push(N('tri', o + 8, x[2] - 5, 4, .6)); ev.push(N('tri', o + 12, x[2] + 7, 4, .55));
      ev.push(Z(o, b === 0 ? 'crash' : 'kick', .5)); ev.push(Z(o + 8, 'snare', .4)); for (var s = 12; s < 16; s++) ev.push(Z(o + s, 'roll', .12 + (s - 12) * .06)); }
    return { ev: ev, len: 64, loop: true }; })();
  // 4) SETTLE: "ra-pa-tu-pa-paaah" - 4 dotted-16th pickups stepping home, then a resolving held tonic, fading.
  CUES.settle = (function () { var ev = [], L = 1.5, pk = [76, 74, 72, 71];
    pk.forEach(function (m, i) { ev.push(N('p1', i * L, m, L, .4, { duty: .25 })); ev.push(N('p2', i * L, m - 4, L, .24, { duty: .125 })); ev.push(Z(i * L, 'roll', .1 + i * .05)); });
    var h = 4 * L; ev.push(N('p1', h, 69, 16, .42, { duty: .5, vib: .7, decay: .5, r: .5 })); ev.push(N('p2', h, 64, 16, .26, { duty: .25, decay: .4, r: .5 }));
    ev.push(N('tri', h, 45, 16, .7, { r: .5 })); ev.push(Z(h, 'crash', .25));
    return { ev: ev, len: h + 16, loop: false, hold: h }; })();
  // schedule one pass of a cue at absolute time t0 into out; returns its end time
  function schedule(chip, name, t0, out) { var c = CUES[name]; c.ev.forEach(function (e) { var x = {}; for (var k in e) x[k] = e[k]; x.t = t0 + e.s * S; x.d = e.len * S; chip.play(x, out); }); return t0 + c.len * S; }
  var core = { CUES: CUES, Chip: Chip, schedule: schedule, S: S, BPM: BPM, SETTLE_FILL: SETTLE_FILL, MASTER: MASTER };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  root.BHMUSIC_CORE = core; if (root.BHMUSIC_CORE_ONLY) return;   // v0.9.31: music_v02.js reuses this core and supplies the live player

  // ---------- live player ----------
  var LS = 'bh_music_mute', muted = false; try { muted = localStorage.getItem(LS) === '1'; } catch (e) {}
  var ctx = null, chip = null, master = null, cur = null, loopNext = 0, st = 'off', pv = { pause: 0, msg: '', rep: false, demo: true, over: -1 }, wantRush = false, log = [];
  function note(x) { log.push([Math.round(performance.now()), x]); if (log.length > 60) log.shift(); }
  function bus(v, fade) { var g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(v, ctx.currentTime + (fade || .02)); g.connect(master); return g; }
  function drop(b, fade) { if (!b) return; var t = ctx.currentTime; try { b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + (fade || .4)); } catch (e) {} setTimeout(function () { try { b.disconnect(); } catch (e) {} }, ((fade || .4) + .2) * 1000); }
  function go(name, opt) { opt = opt || {}; note(name); API.fired[name] = (API.fired[name] || 0) + 1; if (!ctx) return;
    if (cur) drop(cur.bus, opt.fade); var t0 = Math.max(ctx.currentTime + .03, opt.at || 0), b = bus(name === 'loop' ? LOOPV : 1, opt.fadeIn);
    cur = { name: name, bus: b, t0: t0 }; loopNext = schedule(chip, name, t0, b);
    if (name === 'rush') { var rb = b; setTimeout(function () { if (cur && cur.bus === rb) go('loop', { fade: .3, at: loopNext - S * 6, fadeIn: .3 }); }, Math.max(0, (loopNext - ctx.currentTime - .5) * 1000)); } }
  function pump() { if (!ctx || !cur || !CUES[cur.name].loop) return; while (loopNext < ctx.currentTime + 1.2) loopNext = schedule(chip, cur.name, loopNext, cur.bus); }
  function stopAll(f) { if (cur && ctx) drop(cur.bus, f || .8); cur = null; st = 'off'; }
  function unlock() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); chip = new Chip(ctx); master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER; master.connect(ctx.destination); setInterval(pump, 50); note('unlock'); } catch (e) { ctx = null; } }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (k) { window.addEventListener(k, unlock, { capture: true, passive: true }); });
  function setMute(m) { muted = m; try { localStorage.setItem(LS, m ? '1' : '0'); } catch (e) {} if (master) master.gain.setTargetAtTime(m ? 0 : MASTER, ctx.currentTime, .05); if (btn) { btn.textContent = m ? '♪̸' : '♪'; btn.style.opacity = m ? .45 : .85; btn.title = m ? 'Music off (M)' : 'Music on (M)'; } }
  var btn = null; function mkBtn() { btn = document.createElement('button'); btn.id = 'bhMusic'; btn.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:60;width:40px;height:40px;border-radius:20px;border:1px solid #fff4;background:#0008;color:#ffd24a;font:20px sans-serif;cursor:pointer';
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); unlock(); setMute(!muted); }); document.body.appendChild(btn); setMute(muted); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mkBtn); else mkBtn();
  window.addEventListener('keydown', function (e) { if ((e.key === 'm' || e.key === 'M') && !e.repeat) setMute(!muted); });
  // called once per frame from the game loop: s = sim, rep = 3D replay running, demo/attract = no human game
  function tick(s, rep, demo, attract) { var on = !demo && !attract, goalNow = s.msg === 'GOAL!';
    if (!on) { if (st !== 'off') stopAll(1.2); pv = { pause: s.pause, msg: s.msg, rep: rep, demo: demo || attract, over: s.over }; return; }
    if (pv.demo) { st = 'rush'; go('rush'); }   // a human game just began
    else if (s.over >= 0 && pv.over < 0) { st = 'end'; go('goal', { fade: .15 }); setTimeout(function () { if (st === 'end') stopAll(2.5); }, 8000); }
    else if (goalNow && pv.msg !== 'GOAL!') { st = 'goal'; go('goal', { fade: .2 }); }
    else if (st === 'goal' && !rep && (pv.rep || s.pause <= SETTLE_FILL + .6 || !goalNow)) {   // replay ended or was skipped: taper into settle
      st = 'settle'; var lead = Math.max(0, s.pause - .45 - SETTLE_FILL); go('settle', { fade: .5 + lead, at: ctx ? ctx.currentTime + lead : 0 }); API.lastSettleLead = lead; wantRush = true; }
    if (pv.pause > 0 && s.pause <= 0 && s.over < 0 && (st === 'settle' || st === 'goal')) { st = 'loop'; note('drop'); go('loop', { fade: .35 }); wantRush = false; }
    pv = { pause: s.pause, msg: s.msg, rep: rep, demo: false, over: s.over }; }
  var API = root.BHMUSIC = { tick: tick, go: go, setMute: setMute, unlock: unlock, fired: {}, log: log, state: function () { return st; }, core: core };
  // dev: ?music=rush|loop|goal|settle plays that cue on first tap (loops loop/goal)
  var q = new URLSearchParams(location.search).get('music'); if (q && CUES[q]) window.addEventListener('pointerdown', function f() { window.removeEventListener('pointerdown', f, true); setTimeout(function () { st = 'preview'; go(q); }, 50); }, true);
})(typeof window !== 'undefined' ? window : this);
