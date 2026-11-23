/* Zero to Phi · 0-Phi Room venue v0.1 — original procedural band (Web Audio).
   Five short original tunes, no copyrighted material. Techno-ish and rock-ish, simple and catchy. */
(function (root) {
  'use strict';
  var ctx, master, comp, toneFilter, muteNode, out;
  var playing = false, muted = true, volume = 0.42, energy = 0.6;
  var trackId = 'phipulse', timer = 0, nextT = 0, step = 0, beatFns = [];
  var LOOKAHEAD = 0.1, INTERVAL = 40;

  var TRACKS = [
    { id: 'goldhour', title: 'Gold Hour', kind: 'lounge rock', bpm: 96, swing: 0.08,
      scale: [0, 2, 4, 5, 7, 9, 11], root: 50, wave: 'triangle', lead: 'sine',
      kick: 'x---x---x---x---', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-',
      bass: [0, , , 0, 7, , 4, , 0, , , 0, 5, , 7, ],
      leadPat: [4, , 7, 9, , 7, 4, , 5, 7, , 9, 7, , 4, ],
      chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
    { id: 'alley', title: 'Back Alley Hum', kind: 'dive rock', bpm: 112, swing: 0.04,
      scale: [0, 3, 5, 7, 10], root: 40, wave: 'sawtooth', lead: 'square',
      kick: 'x--x--x--x--x-x-', snare: '----x-------x---', hat: 'x-xxx-x-x-xxx-x-',
      bass: [0, 0, , 0, 3, , 0, , 5, 5, , 3, 0, , 7, ],
      leadPat: [7, , 5, 7, , 10, 7, , 5, , 3, 5, , 0, 3, ],
      chords: [[0, 7], [3, 10], [5, 12], [0, 7]] },
    { id: 'phipulse', title: 'Phi Pulse', kind: 'arcade techno', bpm: 128, swing: 0,
      scale: [0, 2, 3, 5, 7, 8, 10], root: 45, wave: 'sawtooth', lead: 'square',
      kick: 'x---x---x---x---', snare: '----x-------x---', hat: 'xxxxxxxxxxxxxxxx',
      bass: [0, , 0, , 3, , 0, 7, 0, , 0, , 5, , 3, 7],
      leadPat: [12, 10, 12, 7, 10, , 8, 7, 12, 15, 12, 10, 8, 7, 5, 7],
      chords: [[0, 3, 7], [5, 8, 12], [7, 10, 14], [3, 7, 10]] },
    { id: 'stomp', title: 'Last Call Stomp', kind: 'bar rock', bpm: 118, swing: 0.03,
      scale: [0, 3, 5, 6, 7, 10], root: 38, wave: 'sawtooth', lead: 'triangle',
      kick: 'x--x-x--x--x-x--', snare: '----x-------x---', hat: '--x---x---x---x-',
      bass: [0, , 0, 0, 7, , 0, , 5, , 5, 3, 0, , 10, ],
      leadPat: [7, 7, , 10, 7, , 5, 3, 7, , 10, 12, , 10, 7, ],
      chords: [[0, 7], [5, 12], [3, 10], [0, 7]] },
    { id: 'neon', title: 'Neon Roof', kind: 'concert techno-rock', bpm: 132, swing: 0,
      scale: [0, 2, 3, 5, 7, 8, 10], root: 42, wave: 'sawtooth', lead: 'sawtooth',
      kick: 'x---x---x---x-x-', snare: '----x--x----x---', hat: 'x-x-x-x-x-x-x-xx',
      bass: [0, 0, 7, 0, 3, 3, 0, 7, 0, 0, 8, 7, 5, 3, 0, 7],
      leadPat: [12, , 15, 12, 10, 12, , 7, 8, 10, 12, 15, 12, 10, 8, 7],
      chords: [[0, 3, 7, 12], [8, 12, 15], [5, 8, 12], [7, 10, 14]] }
  ];

  function tr(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return TRACKS[2]; }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = 1;
    muteNode = ctx.createGain(); muteNode.gain.value = muted ? 0 : 1;
    master = ctx.createGain(); master.gain.value = volume;
    toneFilter = ctx.createBiquadFilter(); toneFilter.type = 'lowpass';
    applyEnergy();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 4;
    comp.attack.value = 0.01; comp.release.value = 0.18;
    out.connect(toneFilter); toneFilter.connect(comp); comp.connect(master);
    master.connect(muteNode); muteNode.connect(ctx.destination);
    return ctx;
  }
  function applyEnergy() {
    if (!toneFilter) return;
    var e = energy;
    toneFilter.frequency.value = 1400 + e * 8600;
    toneFilter.Q.value = 0.5 + (1 - e) * 0.4;
    if (master) master.gain.value = volume * (0.72 + e * 0.45);
  }
  function env(g, t, a, d, s, r, peak) {
    peak = peak == null ? 1 : peak;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }
  function noise(t, dur) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = buf; s.start(t); return s;
  }
  function kick(t, acc) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150 + energy * 30, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    env(g, t, 0.002, 0.08, 0.3, 0.16, (acc ? 1 : 0.78) * 0.95);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35);
  }
  function snare(t, acc) {
    var o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    env(og, t, 0.001, 0.04, 0.2, 0.1, 0.18);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.2);
    var n = noise(t, 0.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 900;
    env(g, t, 0.001, 0.05, 0.25, 0.12, (acc ? 0.5 : 0.36));
    n.connect(f); f.connect(g); g.connect(out);
  }
  function hat(t, open, acc) {
    var n = noise(t, open ? 0.16 : 0.05), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7000 + energy * 2500;
    env(g, t, 0.001, open ? 0.06 : 0.015, 0.15, open ? 0.1 : 0.03, (acc ? 0.16 : 0.09) * (0.6 + energy * 0.5));
    n.connect(f); f.connect(g); g.connect(out);
  }
  function bass(t, midiN, dur, type) {
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type || 'sawtooth'; o.frequency.value = midi(midiN);
    f.type = 'lowpass'; f.frequency.value = 280 + energy * 900;
    env(g, t, 0.01, 0.06, 0.55, Math.max(0.08, dur - 0.08), 0.28 + energy * 0.1);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function lead(t, midiN, dur, type) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o2.type = type || 'square';
    o.frequency.value = midi(midiN); o2.frequency.value = midi(midiN) * 1.005;
    env(g, t, 0.012, 0.05, 0.4, Math.max(0.06, dur * 0.5), 0.12 + energy * 0.08);
    o.connect(g); o2.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function pad(t, midis, dur) {
    var g = ctx.createGain();
    env(g, t, 0.04, 0.2, 0.5, dur * 0.8, 0.05 + energy * 0.03);
    midis.forEach(function (m) {
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(m);
      o.connect(g); o.start(t); o.stop(t + dur + 0.1);
    });
    g.connect(out);
  }
  function ch(pat, i) { return pat.charAt(i % pat.length); }

  function schedule(t, st) {
    var trk = tr(trackId), acc = st % 4 === 0;
    var k = ch(trk.kick, st), s = ch(trk.snare, st), h = ch(trk.hat, st);
    if (k === 'x' || k === 'X') kick(t, k === 'X' || acc);
    if (s === 'x' || s === 'X') snare(t, s === 'X');
    if (h === 'x' || h === 'X') hat(t, false, acc);
    if (h === 'o') hat(t, true, acc);
    var b = trk.bass[st % 16];
    if (b != null) bass(t, trk.root + b, stepDur() * 0.9, trk.wave);
    var l = trk.leadPat[st % 16];
    if (l != null) lead(t, trk.root + 12 + l, stepDur() * 0.85, trk.lead);
    if (st % 16 === 0) {
      var c = trk.chords[(st / 16 | 0) % trk.chords.length];
      pad(t, c.map(function (d) { return trk.root + 12 + d; }), stepDur() * 16 * 0.95);
    }
    if (st % 4 === 0) {
      var when = t;
      beatFns.slice().forEach(function (fn) { try { fn(when, (st / 4) | 0); } catch (e) {} });
    }
  }
  function stepDur() { return 60 / tr(trackId).bpm / 4; }
  function swung(st, dur) {
    var sw = tr(trackId).swing || 0;
    return st % 2 === 1 ? dur * (1 + sw) : dur * (1 - sw);
  }
  function tick() {
    if (!playing || !ctx) return;
    var horizon = ctx.currentTime + LOOKAHEAD;
    while (nextT < horizon) {
      schedule(nextT, step);
      nextT += swung(step, stepDur());
      step++;
    }
  }
  function resume() { if (ensure() && ctx.state === 'suspended') return ctx.resume(); return Promise.resolve(); }

  var api = {
    tracks: TRACKS.map(function (t) { return { id: t.id, title: t.title, kind: t.kind, bpm: t.bpm }; }),
    play: function (id) {
      if (id) trackId = id;
      ensure();
      resume();
      if (!ctx) return;
      if (!playing) { playing = true; step = 0; nextT = ctx.currentTime + 0.06; }
      else { step = 0; nextT = ctx.currentTime + 0.04; }
      clearInterval(timer); timer = setInterval(tick, INTERVAL); tick();
    },
    stop: function () { playing = false; clearInterval(timer); },
    setTrack: function (id) { trackId = id; if (playing) api.play(id); },
    setVolume: function (v) { volume = Math.max(0, Math.min(1, +v || 0)); applyEnergy(); },
    mute: function (on) {
      muted = !!on;
      if (muteNode && ctx) {
        muteNode.gain.cancelScheduledValues(ctx.currentTime);
        muteNode.gain.linearRampToValueAtTime(muted ? 0 : 1, ctx.currentTime + 0.05);
      }
    },
    toggleMute: function () { api.mute(!muted); return muted; },
    setEnergy: function (e) { energy = Math.max(0, Math.min(1, +e || 0)); applyEnergy(); },
    onBeat: function (fn) { beatFns.push(fn); return function () { beatFns = beatFns.filter(function (f) { return f !== fn; }); }; },
    resume: resume,
    state: function () { return { playing: playing, muted: muted, volume: volume, energy: energy, track: trackId, title: tr(trackId).title, kind: tr(trackId).kind, bpm: tr(trackId).bpm }; }
  };
  root.ZTPVenueMusic = api;
})(window);
