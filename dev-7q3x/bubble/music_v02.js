// Bubble Hockey music v02 (dev, v0.9.31) - ADAPTIVE score on top of v01's NES-style chip (2 pulse, triangle, noise).
// Vertical layering: the in-play music is a set of stems on one 16th grid, each on its own gain bus; stems fade in/out
//   with game state. Pulse channels stay honest: the DRIVE stem takes over pulse 1 from the soft ARP, and the TENSE stem
//   takes over pulse 2 from the PAD (complementary crossfades), so at most 2 pulse voices ever sound.
// Horizontal re-sequencing: the loop is cut into 2-bar sections (A, B, C, Br, OT) chosen at section ends from a per-mode
//   order; a mode change jumps on the NEXT BAR via a 1-bar fill (F). One-shots (rush, goal, settle from v01; save/check
//   stingers, winner fanfare new here) sit on the same grid. Everything tweakable lives in MAP below.
(function (root) {
  var core = root.BHMUSIC_CORE || (typeof require !== 'undefined' ? require('./music_v01.js') : null);
  var Chip = core.Chip, S = core.S, BAR = 16 * S, SETTLE_FILL = core.SETTLE_FILL;
  // ======================= STATE -> MUSIC MAP (tweak here) =======================
  var MAP = {
    master: 0.16, loopVol: 0.55,
    // modes, picked in this priority order from game state each frame
    modes: [
      { id: 'ot',    when: function (g) { return g.sudden; } },                         // sudden death / overtime
      { id: 'final', when: function (g) { return g.time < 60; } },                      // final minute
      { id: 'late',  when: function (g) { return g.time < 90 && g.diff <= 1; } },       // close game, second half
      { id: 'norm',  when: function () { return true; } } ],
    // section order per mode (2 bars each); the transport walks the list and wraps
    seq: { norm: ['A', 'A', 'B', 'A', 'C', 'B', 'A', 'Br'], late: ['A', 'C', 'B', 'C'], final: ['B', 'C', 'B', 'OT'], ot: ['OT', 'OT', 'C', 'OT'] },
    // stem levels (0..1) as functions of game state g; base stems sit at 1
    layers: {
      drive:   function (g) { return g.heat; },                                          // puck near a net / on a rush
      tension: function (g) { return g.mode === 'ot' || g.mode === 'final' ? .9 : g.mode === 'late' ? .65 : 0; } },
    heat: { netDist: .42, rushSpeed: 1.15, rise: .25, fall: 1.6 },   // seconds-ish smoothing (rise fast, fall slow)
    stingers: { save: ['save', 'glove'], check: ['bigcheck', 'knockdown'], cooldown: 1.6, vol: .8 },
    fadeIn: .5, fadeOut: .9
  };
  // chords per section: [bass root, pad triad]  (A minor family, same as v01)
  var CH = { Am: [45, [57, 60, 64]], F: [41, [57, 60, 65]], C: [48, [55, 60, 64]], G: [43, [55, 59, 62]], Dm: [38, [57, 62, 65]], E: [40, [56, 59, 64]] };
  var SEC = { A: ['Am', 'F'], B: ['C', 'G'], C: ['Dm', 'E'], Br: ['F', 'E'], OT: ['Am', 'E'], F: ['E'], I: ['Am'] };
  // ======================= stems for one bar =======================
  function N(ch, s, m, len, v, x) { var e = { ch: ch, s: s, m: m, len: len, v: v }; if (x) for (var k in x) e[k] = x[k]; return e; }
  function Z(s, nk, v) { return { ch: 'noise', s: s, nk: nk, len: 1, v: v }; }
  function barStems(sec, bi, chord) { var r = CH[chord][0], P = CH[chord][1], st = { bass: [], drums: [], pad: [], arp: [], drive: [], dhat: [], tense: [] }, s;
    var ot = sec === 'OT', br = sec === 'Br', fill = sec === 'F', intro = sec === 'I';
    // bass (triangle): octave pump 8ths; OT pumps 16ths; bridge holds
    if (br) { st.bass.push(N('tri', 0, r, 8, .55)); st.bass.push(N('tri', 8, r + 7, 8, .5)); }
    else for (s = 0; s < 16; s += ot ? 1 : 2) st.bass.push(N('tri', s, (s / (ot ? 1 : 2)) % 2 ? r + 12 : r, ot ? 1 : 2, ot ? .5 : .55, { r: .02 }));
    // drums (noise)
    for (s = 0; s < 16; s++) {
      if (intro) { st.drums.push(Z(s, s % 4 === 0 ? 'kick' : s >= 12 ? 'roll' : 'hat', s % 4 === 0 ? .5 : .16 + s * .012)); continue; }
      if (fill) { st.drums.push(Z(s, s < 8 ? (s % 4 === 0 ? 'kick' : 'chh') : 'roll', s < 8 ? (s % 4 ? .08 : .5) : .12 + (s - 8) * .035)); continue; }
      if (s === 0 && bi === 0 && (ot || sec === 'B')) { st.drums.push(Z(0, 'crash', .3)); continue; }
      if (br && s % 8 !== 0 && s !== 12) { if (s % 2 === 0) st.drums.push(Z(s, 'chh', .07)); continue; }
      if (s % 4 === 0) st.drums.push(Z(s, 'kick', .5)); else if (s === 4 || s === 12) st.drums.push(Z(s, 'snare', ot ? .36 : .3));
      else if (s === 6 || s === 14) st.drums.push(Z(s, 'hat', .2)); else st.drums.push(Z(s, 'chh', s % 2 ? .07 : .11)); }
    // pad (pulse 2, 12.5%): low drone, swells in
    st.pad.push(N('p2', 0, P[0] - 12, 16, .14, { duty: .125, a: .25, r: .2 }));
    // arp (pulse 1, 25%): sparse soft 8th-offbeats
    var arp = [P[0], P[1], P[2], P[1] + 12]; [2, 6, 10, 14].forEach(function (x, j) { if ((bi + j) % 3 !== 2) st.arp.push(N('p1', x, arp[(j + bi) % 4] + 12, 1, .12, { duty: .25, decay: .4 })); });
    // DRIVE (pulse 1, 12.5%): rolling 16th arpeggio up/down the chord, an octave up, accents on beats
    var up = [P[0] + 12, P[1] + 12, P[2] + 12, P[0] + 24, P[2] + 12, P[1] + 12]; for (s = 0; s < 16; s++) st.drive.push(N('p1', s, up[s % 6], 1, s % 4 ? .1 : .16, { duty: .125, decay: .5, r: .01 }));
    // DRIVE hats (noise accents on the off-16ths; sits between base drum hits)
    for (s = 1; s < 16; s += 2) st.dhat.push(Z(s, s % 4 === 3 ? 'hat' : 'chh', .09));
    // TENSE (pulse 2, 50%): low semitone-neighbour 8th ostinato on the chord 5th, the "clock is ticking" pulse
    var f = P[2] - 12; for (s = 0; s < 16; s += 2) st.tense.push(N('p2', s, (s % 8 === 6) ? f + 1 : f, 1.6, .1, { duty: .5, decay: .6 }));
    return st; }
  var STEMS = ['bass', 'drums', 'pad', 'arp', 'drive', 'dhat', 'tense'];
  // ======================= new one-shots =======================
  var ONE = {
    save:  { ev: [N('p1', 0, 76, 1, .32, { duty: .25 }), N('p1', 1, 81, 1, .32, { duty: .25 }), N('p1', 2, 88, 3, .3, { duty: .125, decay: .3 }), Z(0, 'hat', .25), Z(2, 'chh', .2)], len: 5, steal: 'p1' },
    check: { ev: [N('p2', 0, 52, 2, .34, { duty: .5, slide: -12 }), N('p2', 3, 45, 2, .3, { duty: .25, slide: -7 }), Z(0, 'kick', .55), Z(1, 'snare', .3)], len: 5, steal: 'p2' },
    // winner fanfare (C major, the relative major): rising pickups, I-IV-I-V-I, held tonic with vibrato. Distinct from the goal theme.
    win: (function () { var e = [], seq = [[0, 67, 72, 1], [1, 72, 76, 1], [2, 76, 79, 2], [4, 77, 81, 3], [7, 76, 79, 1], [8, 79, 84, 4], [12, 74, 79, 2], [14, 71, 74, 2], [16, 76, 84, 14]];
      seq.forEach(function (x) { e.push(N('p1', x[0], x[2], x[3], x[3] > 4 ? .5 : .42, { duty: .5, vib: x[3] > 4 ? 1 : 0, decay: x[3] > 4 ? .6 : 0 })); e.push(N('p2', x[0], x[1], x[3], .3, { duty: .25 })); });
      [[0, 48, 4], [4, 41, 4], [8, 48, 4], [12, 43, 4], [16, 36, 14]].forEach(function (x) { e.push(N('tri', x[0], x[1], x[2], .75)); });
      [0, 4, 8, 12].forEach(function (s) { e.push(Z(s, 'kick', .5)); e.push(Z(s + 2, 'snare', .3)); }); e.push(Z(16, 'crash', .5));
      for (var s = 13; s < 16; s++) e.push(Z(s, 'roll', .15 + (s - 13) * .07)); return { ev: e, len: 30 }; })() };
  function sched(chip, ev, t0, out) { ev.forEach(function (e) { var x = {}; for (var k in e) x[k] = e[k]; x.t = t0 + e.s * S; x.d = e.len * S; chip.play(x, out); }); }
  // ======================= transport (vertical + horizontal) =======================
  function Transport(ctx, chip, out) { this.ctx = ctx; this.chip = chip; this.out = out; this.on = false; this.bus = {}; this.mode = 'norm'; this.log = [];
    var self = this; this.main = ctx.createGain(); this.main.gain.value = 0; this.main.connect(out);
    STEMS.forEach(function (k) { var g = ctx.createGain(); g.gain.value = (k === 'drive' || k === 'dhat' || k === 'tense') ? 0 : 1; g.connect(self.main); self.bus[k] = g; });
    this.sting = ctx.createGain(); this.sting.gain.value = MAP.stingers.vol; this.sting.connect(this.main); }
  Transport.prototype.start = function (t0, intro) { this.on = true; this.t = t0; this.q = intro ? ['I'] : []; this.si = 0; this.sec = null; this.bi = 0; this.pend = null;
    var g = this.main.gain; g.cancelScheduledValues(t0); g.setValueAtTime(g.value, Math.max(this.ctx.currentTime, t0 - .3)); g.linearRampToValueAtTime(MAP.loopVol, t0 + MAP.fadeIn); };
  Transport.prototype.stop = function (f) { this.on = false; var t = this.ctx.currentTime, g = this.main.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + (f || MAP.fadeOut)); };
  Transport.prototype.setMode = function (m) { if (m !== this.mode) { this.mode = m; this.pend = m; this.si = 0; } };   // jump at next bar via fill
  Transport.prototype.levels = function (drive, tension, at) { var B = this.bus, k = .35;
    var self = this, R = this.ramps = this.ramps || {};
    function set(n, v) { if (self.stol === n && at < self.stolT) return; var r = R[n] || { a: B[n].gain.value, b: B[n].gain.value, t0: 0, t1: 0 }, now = r.t1 <= r.t0 || at >= r.t1 ? r.b : r.a + (r.b - r.a) * (at - r.t0) / (r.t1 - r.t0);
      if (Math.abs(v - r.b) < .02) return; var g = B[n].gain, dur = k * 2; g.cancelScheduledValues(at); g.setValueAtTime(now, at); g.linearRampToValueAtTime(v, at + dur); R[n] = { a: now, b: v, t0: at, t1: at + dur }; }
    set('drive', drive); set('dhat', drive * .8); set('arp', 1 - drive); set('tense', tension); set('pad', 1 - tension * .85); };
  Transport.prototype.nextSection = function () { var q = MAP.seq[this.mode]; var s = q[this.si % q.length]; this.si++; return s; };
  Transport.prototype.pump = function (now) { if (!this.on) return; while (this.t < now + 1.0) {
      if (this.pend && this.sec && this.sec !== 'F' && this.sec !== 'I') { this.sec = 'F'; this.bi = 0; this.pend = null; }   // urgent jump: 1-bar fill then new mode's order
      else if (!this.sec || this.bi >= SEC[this.sec].length) { this.sec = this.q.length ? this.q.shift() : this.nextSection(); this.bi = 0; this.pend = null; }
      var chord = SEC[this.sec][this.bi], st = barStems(this.sec, this.bi, chord), self = this;
      STEMS.forEach(function (k) { sched(self.chip, st[k], self.t, self.bus[k]); });
      this.log.push([+this.t.toFixed(2), this.sec + this.bi, this.mode]); if (this.log.length > 40) this.log.shift();
      this.t += BAR; this.bi++; } };
  Transport.prototype.grid = function (now, step) { if (!this.on) return now + .02; var d = now + .02 - this.t + 64 * BAR, q = step * S; return this.t - 64 * BAR + Math.ceil(d / q) * q; };   // next grid point
  Transport.prototype.stinger = function (name, now) { var o = ONE[name], t = this.grid(now, 1), b = this.bus[o.steal === 'p1' ? (this.bus.drive.gain.value > .5 ? 'drive' : 'arp') : (this.bus.tense.gain.value > .5 ? 'tense' : 'pad')];
    var bn = b === this.bus.drive ? 'drive' : b === this.bus.arp ? 'arp' : b === this.bus.tense ? 'tense' : 'pad'; this.stol = bn; this.stolT = t + o.len * S; var R = this.ramps = this.ramps || {}, lv = R[bn] ? R[bn].b : b.gain.value;
    b.gain.cancelScheduledValues(t - .02); b.gain.setValueAtTime(lv, t - .02); b.gain.linearRampToValueAtTime(0, t); b.gain.setValueAtTime(0, this.stolT); b.gain.linearRampToValueAtTime(lv, this.stolT + .15); R[bn] = { a: lv, b: lv, t0: this.stolT, t1: this.stolT + .15 };   // free that pulse channel for the stinger; levels() restores it after stolT
    sched(this.chip, o.ev, t, this.sting); return t; };
  var api = { MAP: MAP, Transport: Transport, ONE: ONE, barStems: barStems, sched: sched, core: core, BAR: BAR };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ======================= live player =======================
  var LS = 'bh_music_mute', muted = false; try { muted = localStorage.getItem(LS) === '1'; } catch (e) {}
  var ctx = null, chip = null, master = null, tp = null, cur = null, st = 'off', heat = 0, lastSt = 0, pv = { pause: 0, msg: '', rep: false, demo: true, over: -1 }, log = [], fired = {};
  function note(x) { fired[x] = (fired[x] || 0) + 1; log.push([Math.round(performance.now()), x]); if (log.length > 80) log.shift(); }
  function bus(v, fade) { var g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(v, ctx.currentTime + (fade || .02)); g.connect(master); return g; }
  function drop(b, fade) { if (!b) return; var t = ctx.currentTime; b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + (fade || .4)); setTimeout(function () { try { b.disconnect(); } catch (e) {} }, ((fade || .4) + .3) * 1000); }
  // one-shot or v01 loop cue (rush/goal/settle) on its own bus; 'play' = adaptive transport
  function go(name, opt) { opt = opt || {}; note(name); if (!ctx) return; var at = Math.max(ctx.currentTime + .03, opt.at || 0);
    if (name === 'play') { if (cur) drop(cur.bus, opt.fade || .35); cur = null; if (!tp.on) tp.start(at, opt.intro !== false); return; }
    if (tp.on && name !== 'save' && name !== 'check') tp.stop(opt.fade || .3);
    if (name === 'save' || name === 'check') { tp.stinger(name, ctx.currentTime); return; }
    if (cur) drop(cur.bus, opt.fade); var b = bus(1, opt.fadeIn), end;
    if (ONE[name]) { sched(chip, ONE[name].ev, at, b); end = at + ONE[name].len * S; } else end = core.schedule(chip, name, at, b);
    cur = { name: name, bus: b, t0: at, end: end, loop: !!(core.CUES[name] && core.CUES[name].loop) };
    if (name === 'rush') { var rb = b; setTimeout(function () { if (cur && cur.bus === rb) { tp.start(end - S * 6, false); var x = cur.bus; cur = null; setTimeout(function () { drop(x, .3); }, 600); } }, Math.max(0, (end - ctx.currentTime - .6) * 1000)); } }
  function pump() { if (!ctx) return; tp.pump(ctx.currentTime); if (cur && cur.loop) while (cur.end < ctx.currentTime + 1.2) cur.end = core.schedule(chip, cur.name, cur.end, cur.bus); }
  function stopAll(f) { if (!ctx) { st = 'off'; return; } if (cur) drop(cur.bus, f || .8); cur = null; tp.stop(f || .8); st = 'off'; }
  function unlock() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); chip = new Chip(ctx); master = ctx.createGain(); master.gain.value = muted ? 0 : MAP.master; master.connect(ctx.destination); tp = new Transport(ctx, chip, master); setInterval(pump, 50); note('unlock'); } catch (e) { ctx = null; } }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (k) { window.addEventListener(k, unlock, { capture: true, passive: true }); });
  var btn = null;
  function setMute(m) { muted = m; try { localStorage.setItem(LS, m ? '1' : '0'); } catch (e) {} if (master) master.gain.setTargetAtTime(m ? 0 : MAP.master, ctx.currentTime, .05); if (btn) { btn.textContent = m ? '♪̸' : '♪'; btn.style.opacity = m ? .45 : .85; btn.title = m ? 'Music off (M)' : 'Music on (M)'; } }
  function mkBtn() { btn = document.createElement('button'); btn.id = 'bhMusic'; btn.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:60;width:40px;height:40px;border-radius:20px;border:1px solid #fff4;background:#0008;color:#ffd24a;font:20px sans-serif;cursor:pointer';
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); unlock(); setMute(!muted); }); document.body.appendChild(btn); setMute(muted); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mkBtn); else mkBtn();
  window.addEventListener('keydown', function (e) { if ((e.key === 'm' || e.key === 'M') && !e.repeat) setMute(!muted); });
  var L = 2.0, GY = .128;
  function gameInfo(s, dt) { var sc = s.sc || [0, 0], p = s.p || [.5, 1], v = s.v || [0, 0], near = Math.min(Math.abs(p[1] - GY), Math.abs(p[1] - (L - GY))) < MAP.heat.netDist, rush = s.c >= 0 && Math.hypot(v[0], v[1]) > MAP.heat.rushSpeed;
    var tgt = (near || rush) && !(s.pause > 0) ? 1 : 0, k = tgt > heat ? MAP.heat.rise : MAP.heat.fall; heat += (tgt - heat) * Math.min(1, dt / k);
    var g = { time: s.time == null ? 180 : s.time, diff: Math.abs(sc[0] - sc[1]), sudden: s.msg === 'SUDDEN DEATH' || (s.time <= 0 && sc[0] === sc[1]), heat: heat };
    for (var i = 0; i < MAP.modes.length; i++) if (MAP.modes[i].when(g)) { g.mode = MAP.modes[i].id; break; } return g; }
  // once per frame from the game loop
  var lastT = 0;
  function tick(s, rep, demo, attract) { var now = performance.now() / 1000, dt = Math.min(.1, now - lastT || .016); lastT = now; var on = !demo && !attract, goalNow = s.msg === 'GOAL!';
    if (!on) { if (st !== 'off') stopAll(1.2); pv = { pause: s.pause, msg: s.msg, rep: rep, demo: true, over: s.over }; return; }
    var g = gameInfo(s, dt); API.g = g;
    if (pv.demo) { st = 'play'; go('rush'); }
    else if (s.over >= 0 && pv.over < 0) { st = 'end'; go('win', { fade: .2 }); setTimeout(function () { if (st === 'end') stopAll(2.5); }, 5000); }
    else if (goalNow && pv.msg !== 'GOAL!') { st = 'goal'; go('goal', { fade: .2 }); }
    else if (st === 'goal' && !rep && (pv.rep || s.pause <= SETTLE_FILL + .6 || !goalNow)) { st = 'settle'; var lead = Math.max(0, s.pause - .45 - SETTLE_FILL); API.lastSettleLead = lead; go('settle', { fade: .5 + lead, at: ctx ? ctx.currentTime + lead : 0 }); }
    if (pv.pause > 0 && s.pause <= 0 && s.over < 0 && (st === 'settle' || st === 'goal')) { st = 'play'; note('drop'); go('play', { fade: .35 }); }
    if (st === 'play' && ctx && tp) { tp.setMode(g.mode); tp.levels(g.heat, MAP.layers.tension(g), ctx.currentTime);
      var ev = s.ev || ''; if (now - lastSt > MAP.stingers.cooldown) { if (MAP.stingers.save.indexOf(ev) >= 0) { lastSt = now; go('save'); } else if (MAP.stingers.check.indexOf(ev) >= 0) { lastSt = now; go('check'); } } }
    pv = { pause: s.pause, msg: s.msg, rep: rep, demo: false, over: s.over }; }
  var API = root.BHMUSIC = { tick: tick, go: go, setMute: setMute, unlock: unlock, fired: fired, log: log, MAP: MAP, state: function () { return st; }, tp: function () { return tp; }, ver: 'v02' };
  // dev preview: ?music=rush|goal|settle|win|save|check|play  plus &mode=norm|late|final|ot &drive=0..1 &tension=0..1 (play = adaptive loop)
  var Q = new URLSearchParams(location.search), q = Q.get('music');
  if (q) window.addEventListener('pointerdown', function f() { window.removeEventListener('pointerdown', f, true); setTimeout(function () { st = 'preview'; if (q === 'play') { go('play'); var m = Q.get('mode'), d = +Q.get('drive') || 0, te = +Q.get('tension') || 0; setInterval(function () { if (m) tp.setMode(m); tp.levels(d, te, ctx.currentTime); }, 200); } else go(q); }, 60); }, true);
})(typeof window !== 'undefined' ? window : this);
