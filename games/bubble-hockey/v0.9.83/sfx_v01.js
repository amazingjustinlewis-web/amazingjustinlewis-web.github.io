/* Bubble Hockey SFX v01 — original synthesized Web Audio (no samples).
   Sounds:
     shot     — wooden stick crack, volume/brightness scaled by shot power
     onetimer — bigger, sharper crack plus a short ice-echo tail
     pass     — soft tape-on-puck slip/slap
     ting     — puck-on-post/crossbar metal ring (also hooked from ev post/bar)
   Hooked from BHSFX.tick(sim, replaying, demo, attract) after sim.step, same
   place as BHMUSIC.tick. Human flicks are read from sim.iev (serial); AI shots,
   one-timers, passes and post/bar hits are read from sim.ev after the step
   (step clears ev at the start, so a pre-step ev would otherwise be missed).
   One-timer detection (sim): after a flick, a tap before contact arms
   this.ot[team] (ev 'arm', OT.arm = 2.5 s). On the next friendly touch,
   Sim.onCatch fires a shot at the net (OT.sp = 3.3) and sets ev = 'onetimer',
   unless a finger is already holding that receiver (then ev = 'catch').
   Mute: silent when window.BH_MUTE is set (attract/demo), when demo/attract
   is passed to tick, during replay, or when the existing music toggle
   (localStorage bh_music_mute, the ♪ button / M key) is on.
   Light pitch/volume randomization on every play. */
(function (root) {
  var ctx = null, master = null, noiseBuf = null;
  var LS = 'bh_music_mute';
  var lastIev = -1, lastEv = '', lastClk = -1, lastSht = -1;
  var log = [];

  function muted() {
    if (root.BH_MUTE) return true;
    try { if (root.localStorage && root.localStorage.getItem(LS) === '1') return true; } catch (e) {}
    return false;
  }

  function ac() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      var n = Math.floor(ctx.sampleRate * .4);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; master = null; noiseBuf = null; }
    return ctx;
  }

  function unlock() {
    var c = ac();
    if (c && c.state === 'suspended' && c.resume) c.resume();
  }

  function jit(amt) { return 1 + (Math.random() * 2 - 1) * amt; }

  function rec(kind, power) {
    log.push({ kind: kind, power: power, t: (root.performance && performance.now) ? performance.now() : Date.now() });
    if (log.length > 48) log.shift();
  }

  function noise(loop) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    if (loop) s.loop = true;
    return s;
  }

  function filt(type, freq, q) {
    var f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }

  function gainAt(t0, peak, attack, decay) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t0 + Math.max(.001, attack));
    g.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(.001, attack) + decay);
    return g;
  }

  function tone(type, freq0, freq1, t0, peak, attack, decay) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq0, t0);
    if (freq1 != null && freq1 !== freq0) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t0 + attack + decay);
    var g = gainAt(t0, peak, attack, decay);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + attack + decay + .02);
    return o;
  }

  function burst(t0, hp, peak, attack, decay, q) {
    var s = noise(true), f = filt('highpass', hp, q || .7), g = gainAt(t0, peak, attack, decay);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + attack + decay + .02);
  }

  function band(t0, freq, q, peak, attack, decay) {
    var s = noise(true), f = filt('bandpass', freq, q), g = gainAt(t0, peak, attack, decay);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + attack + decay + .02);
  }

  // Wooden stick crack. Power 0..1 from puck speed after release.
  function shot(power) {
    var t0 = ctx.currentTime, p = .35 + Math.max(0, Math.min(1, power)) * .65, j = jit(.07), v = jit(.1);
    burst(t0, 800 * j, .32 * p * v, .002, .03);
    band(t0, 2400 * j, 4.2, .5 * p * v, .001, .014);
    tone('square', 230 * j, 88, t0, .16 * p * v, .002, .09);
    tone('triangle', 360 * j, 140, t0, .11 * p * v, .002, .055);
    if (p > .7) tone('sine', 110 * j, 55, t0, .07 * p * v, .003, .08);
  }

  // Bigger, sharper crack + ice-rink echo tail.
  function onetimer(power) {
    var t0 = ctx.currentTime, p = .75 + Math.max(0, Math.min(1, power)) * .25, j = jit(.05), v = jit(.08);
    burst(t0, 1100 * j, .55 * p * v, .0015, .04);
    band(t0, 3300 * j, 5, .72 * p * v, .001, .018);
    tone('square', 190 * j, 70, t0, .28 * p * v, .002, .13);
    tone('sine', 92 * j, 48, t0, .16 * p * v, .003, .16);
    tone('triangle', 420 * j, 160, t0, .12 * p * v, .002, .06);
    // ice echo: quieter, duller copies a beat later
    var e1 = t0 + .1 * jit(.12), e2 = t0 + .22 * jit(.1);
    burst(e1, 700, .16 * p * v, .004, .08);
    band(e1, 1800 * j, 2.4, .18 * p * v, .003, .07);
    tone('triangle', 280 * j, 120, e1, .06 * p * v, .004, .14);
    burst(e2, 500, .07 * p * v, .006, .12);
    tone('sine', 200 * j, 90, e2, .03 * p * v, .008, .18);
  }

  // Soft tape-on-puck slip / slap. No hard crack.
  function pass(power) {
    var t0 = ctx.currentTime, p = .4 + Math.max(0, Math.min(1, power)) * .6, j = jit(.08), v = jit(.12);
    band(t0, 680 * j, 1.15, .14 * p * v, .004, .07);
    burst(t0, 400 * j, .06 * p * v, .006, .05);
    tone('sine', 430 * j, 170, t0, .05 * p * v, .006, .08);
    tone('sine', 170 * j, 90, t0, .045 * p * v, .004, .045);
  }

  // Metal post / crossbar ting, with a faint ice ring. Designed to sit
  // on top of the existing short view3d ping rather than replace it.
  function ting(power) {
    var t0 = ctx.currentTime, p = .45 + Math.max(0, Math.min(1, power)) * .55, j = jit(.05), v = jit(.1);
    tone('triangle', 2150 * j, 1720, t0, .13 * p * v, .002, .42);
    tone('sine', 3220 * j, 2600, t0, .055 * p * v, .002, .22);
    tone('sine', 1080 * j, 820, t0, .04 * p * v, .003, .28);
    var e1 = t0 + .13 * jit(.1);
    tone('triangle', 1900 * j, 1500, e1, .04 * p * v, .006, .32);
  }

  function ready() {
    if (muted()) return false;
    if (!ac()) return false;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return !!ctx && !!master && !!noiseBuf;
  }

  function play(kind, power) {
    rec(kind, power);
    if (!ready()) return false;
    power = power == null ? .7 : power;
    if (kind === 'shot') shot(power);
    else if (kind === 'onetimer') onetimer(power);
    else if (kind === 'pass') pass(power);
    else if (kind === 'ting' || kind === 'post' || kind === 'bar') ting(power);
    else return false;
    return true;
  }

  function powerOf(s) {
    var v = s && s.v, sp = v ? Math.hypot(v[0] || 0, v[1] || 0) : 0;
    if (!sp && s && s.pv) sp = Math.hypot(s.pv[0] || 0, s.pv[1] || 0);
    return Math.max(0, Math.min(1, (sp - .6) / 3));
  }

  function pushKind(kinds, k) {
    if (!k) return;
    if (kinds.indexOf(k) < 0) kinds.push(k);
  }

  // Map sim event names to a sound. Unknown events are ignored.
  function tick(s, rep, demo, attract) {
    if (!s || rep || demo || attract) return;
    var kinds = [];
    var iev = s.iev;
    if (iev && iev[0] !== lastIev) { lastIev = iev[0]; pushKind(kinds, iev[2]); }
    var sht = s.sht;
    if (sht && sht[0] !== lastSht) { lastSht = sht[0]; pushKind(kinds, sht[2]); }
    if (s.ev && (s.ev !== lastEv || s.clk !== lastClk)) {
      lastEv = s.ev; lastClk = s.clk; pushKind(kinds, s.ev);
    }
    var pow = powerOf(s);
    for (var i = 0; i < kinds.length; i++) {
      var k = kinds[i];
      if (k === 'shot') play('shot', pow);
      else if (k === 'onetimer') play('onetimer', pow > .25 ? pow : .95);
      else if (k === 'pass') play('pass', pow);
      else if (k === 'post' || k === 'bar') play('ting', pow > .2 ? pow : .7);
    }
  }

  function reset() { lastIev = -1; lastEv = ''; lastClk = -1; lastSht = -1; log.length = 0; }

  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (k) {
    if (root.addEventListener) root.addEventListener(k, unlock, { capture: true, passive: true });
  });

  root.BHSFX = {
    ver: 'v01',
    tick: tick,
    play: play,
    shot: function (p) { return play('shot', p); },
    onetimer: function (p) { return play('onetimer', p == null ? .95 : p); },
    pass: function (p) { return play('pass', p); },
    ting: function (p) { return play('ting', p); },
    unlock: unlock,
    muted: muted,
    fired: function () { return log.slice(); },
    reset: reset,
    _ac: function () { return ctx; }
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
