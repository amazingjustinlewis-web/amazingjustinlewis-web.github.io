/* RED DEER RICH - procedural sound (WebAudio only, no audio files, nothing copyrighted).
   RDRSfx.play(name) for effects; RDRSfx.band(vol) drives the Upper Level Youth Centre punk loop
   (an original 4-bar pattern generated live: drums, bass, distorted power chords), muffled when far away. */
(function (root) {
  'use strict';
  var AC = null, out = null, comp = null, noiseBuf = null, distCurve = null;
  var S = { muted: false, unlocked: false };
  function live() {
    if (!AC) {
      var Ctx = root.AudioContext || root.webkitAudioContext; if (!Ctx) return null;
      try { AC = new Ctx(); } catch (e) { return null; }
      comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
      out = AC.createGain(); out.gain.value = S.muted ? 0 : 0.85; out.connect(comp); comp.connect(AC.destination);
    }
    if (AC.state === 'suspended' && AC.resume) { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function ready() { var A = live(); return A && A.state === 'running' ? A : null; }
  function noise(A) {
    if (!noiseBuf) { var n = A.sampleRate, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
    var s = A.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function env(A, dest, t, a, peak, d) { var g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest); return g; }
  function tone(A, dest, type, f0, f1, t, dur, vol, a) {
    var o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(env(A, dest, t, a || 0.005, vol, dur)); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function hiss(A, dest, t, dur, vol, ftype, freq, q) {
    var s = noise(A), f = A.createBiquadFilter(); f.type = ftype || 'highpass'; f.frequency.value = freq || 3000; if (q) f.Q.value = q;
    s.connect(f); f.connect(env(A, dest, t, 0.003, vol, dur)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  var NOTE = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  var SOUNDS = {
    click: function (A, t) { tone(A, out, 'square', 900, 700, t, 0.04, 0.08); },
    step: function (A, t) { tone(A, out, 'triangle', 520 + Math.random() * 80, 0, t, 0.06, 0.12); },
    dice: function (A, t) { for (var i = 0; i < 7; i++) { var tt = t + i * 0.07 + Math.random() * 0.03; hiss(A, out, tt, 0.04, 0.25, 'bandpass', 1800 + Math.random() * 1600, 4); tone(A, out, 'square', 200 + Math.random() * 300, 0, tt, 0.02, 0.05); } },
    turn: function (A, t) { tone(A, out, 'sine', NOTE(76), 0, t, 0.18, 0.18); tone(A, out, 'sine', NOTE(83), 0, t + 0.12, 0.3, 0.16); },
    cash: function (A, t) {      // cha-ching
      hiss(A, out, t, 0.08, 0.3, 'bandpass', 4000, 3);
      tone(A, out, 'square', NOTE(88), 0, t + 0.06, 0.12, 0.12); tone(A, out, 'square', NOTE(93), 0, t + 0.16, 0.35, 0.12);
      tone(A, out, 'sine', NOTE(100), 0, t + 0.16, 0.5, 0.08);
    },
    buy: function (A, t) { [72, 76, 79, 84].forEach(function (n, i) { tone(A, out, 'triangle', NOTE(n), 0, t + i * 0.07, 0.25, 0.18); }); },
    build: function (A, t) { hiss(A, out, t, 0.05, 0.4, 'lowpass', 900); tone(A, out, 'square', 140, 90, t, 0.08, 0.2); hiss(A, out, t + 0.16, 0.05, 0.4, 'lowpass', 900); tone(A, out, 'square', 150, 90, t + 0.16, 0.08, 0.2); tone(A, out, 'sine', NOTE(84), 0, t + 0.34, 0.4, 0.16); tone(A, out, 'sine', NOTE(91), 0, t + 0.42, 0.5, 0.12); },
    card: function (A, t) { hiss(A, out, t, 0.12, 0.25, 'bandpass', 2500, 1.5); tone(A, out, 'sine', NOTE(79), NOTE(86), t + 0.05, 0.15, 0.1); },
    whiteout: function (A, t) { var s = noise(A), f = A.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6); f.frequency.exponentialRampToValueAtTime(300, t + 1.4); s.connect(f); f.connect(env(A, out, t, 0.2, 0.45, 1.3)); s.start(t); s.stop(t + 1.6); },
    whistle: function (A, t) { [0, 0.45].forEach(function (d) { var o1 = tone(A, out, 'sawtooth', NOTE(74), 0, t + d, 0.35, 0.07, 0.03); var o2 = tone(A, out, 'sawtooth', NOTE(78), 0, t + d, 0.35, 0.06, 0.03); }); },
    pop: function (A, t) { tone(A, out, 'sine', 260, 50, t, 0.3, 0.35); hiss(A, out, t, 0.25, 0.35, 'lowpass', 1500); for (var i = 0; i < 6; i++) hiss(A, out, t + 0.25 + Math.random() * 0.5, 0.03, 0.12, 'highpass', 4000); },
    boom: function (A, t) { tone(A, out, 'sine', 120, 30, t, 0.7, 0.9); hiss(A, out, t, 0.6, 0.7, 'lowpass', 1200); tone(A, out, 'square', 60, 30, t, 0.3, 0.3); },
    caught: function (A, t) { SOUNDS.cash(A, t); tone(A, out, 'sawtooth', NOTE(64), 0, t, 0.12, 0.15); tone(A, out, 'sawtooth', NOTE(71), 0, t + 0.1, 0.25, 0.15); },
    tiptoe: function (A, t) { [0, 0.22, 0.44, 0.66].forEach(function (d, i) { tone(A, out, 'triangle', NOTE(i % 2 ? 79 : 76), 0, t + d, 0.08, 0.12); }); },
    trombone: function (A, t) { [67, 66, 65, 62].forEach(function (n, i) { var o = tone(A, out, 'sawtooth', NOTE(n), i === 3 ? NOTE(n) * 0.97 : 0, t + i * 0.32, i === 3 ? 0.8 : 0.3, 0.12, 0.03); }); },
    payupAlarm: function (A, t) { tone(A, out, 'square', NOTE(84), 0, t, 0.07, 0.14); tone(A, out, 'square', NOTE(88), 0, t + 0.09, 0.09, 0.14); hiss(A, out, t + 0.05, 0.05, 0.15, 'bandpass', 5000, 3); },
    fanfare: function (A, t) { [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.75], [72, 0.9]].forEach(function (x) { tone(A, out, 'sawtooth', NOTE(x[0]), 0, t + x[1], x[1] > 0.8 ? 0.8 : 0.2, 0.12); tone(A, out, 'square', NOTE(x[0] + 12), 0, t + x[1], 0.15, 0.05); }); },
    gold: function (A, t) { for (var i = 0; i < 8; i++) tone(A, out, 'sine', NOTE(84 + [0, 4, 7, 12, 16, 19, 24, 28][i]), 0, t + i * 0.06, 0.3, 0.09); },
    tarnish: function (A, t) { tone(A, out, 'sawtooth', NOTE(72), NOTE(60), t, 0.8, 0.1); },
    crunch: function (A, t) { hiss(A, out, t, 0.35, 0.7, 'lowpass', 700); tone(A, out, 'square', 90, 40, t, 0.4, 0.4); },
    jackpot: function (A, t) { SOUNDS.fanfare(A, t); for (var i = 0; i < 6; i++) SOUNDS.cash(A, t + 0.3 + i * 0.18); },
    deal: function (A, t) { hiss(A, out, t, 0.18, 0.5, 'lowpass', 300); tone(A, out, 'sine', 90, 50, t, 0.25, 0.6); },   // CEMENT thunk
    buzz: function (A, t) { tone(A, out, 'square', 180, 0, t, 0.12, 0.1); }
  };
  function play(name) {
    if (S.muted) return; var A = ready(); if (!A || !SOUNDS[name]) return;
    try { SOUNDS[name](A, A.currentTime + 0.01); } catch (e) {}
  }

  // ------------------------------------------------------------------ the band (Upper Level Youth Centre)
  var band = { vol: 0, target: 0, gain: null, filt: null, nextT: 0, step: 0, timer: null, bpm: 176, lite: false, t0: 0 };
  var PROG = [40, 36, 43, 38];          // E C G D (MIDI roots, low): an original punk-style 4-bar loop
  function dist(A) {
    if (distCurve) return distCurve;
    var n = 2048, c = new Float32Array(n), k = 40;
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x)); }
    return (distCurve = c);
  }
  function bandNodes(A) {
    if (band.gain) return;
    band.gain = A.createGain(); band.gain.gain.value = 0;
    band.filt = A.createBiquadFilter(); band.filt.type = 'lowpass'; band.filt.frequency.value = 700; band.filt.Q.value = 0.7;
    band.gtr = A.createWaveShaper(); band.gtr.curve = dist(A); band.gtrF = A.createBiquadFilter(); band.gtrF.type = 'lowpass'; band.gtrF.frequency.value = 3200;
    band.gtrG = A.createGain(); band.gtrG.gain.value = 0.18;
    band.gtr.connect(band.gtrF); band.gtrF.connect(band.gtrG); band.gtrG.connect(band.filt);
    band.filt.connect(band.gain); band.gain.connect(out);
  }
  function schedStep(A, t, step) {
    var bar = Math.floor(step / 8) % 4, s8 = step % 8, root = PROG[bar], dst = band.filt, e8 = 60 / band.bpm / 2;
    // drums
    if (s8 === 0 || s8 === 3 || s8 === 4) { tone(A, dst, 'sine', 150, 45, t, 0.16, 0.9); }
    if (s8 === 2 || s8 === 6) { hiss(A, dst, t, 0.13, 0.55, 'bandpass', 1800, 0.8); tone(A, dst, 'triangle', 220, 160, t, 0.07, 0.3); }
    hiss(A, dst, t, s8 % 2 ? 0.03 : 0.05, step % 32 === 0 ? 0.35 : 0.12, 'highpass', 7000);
    if (step % 32 === 0) hiss(A, dst, t, 0.9, 0.25, 'highpass', 5000);     // crash at the top of the loop
    // bass: driving 8ths on the root
    tone(A, dst, 'sawtooth', NOTE(root), 0, t, e8 * 0.9, 0.22, 0.004);
    // guitar: palm-muted power-chord 8ths, open chord on the downbeat of each bar
    var open = s8 === 0, dur = open ? e8 * 1.9 : e8 * 0.55;
    [0, 7, 12].forEach(function (iv, k) { if (band.lite && k === 2) return; tone(A, band.gtr, 'sawtooth', NOTE(root + 12 + iv) * (1 + (Math.random() - 0.5) * 0.004), 0, t, dur, open ? 0.5 : 0.3, 0.004); });
  }
  function bandPump() {
    var A = ready(); if (!A || !band.gain) return;
    if (band.target <= 0.002 && band.vol <= 0.002) { band.running = false; return; }
    var e8 = 60 / band.bpm / 2;
    if (band.nextT < A.currentTime) { band.nextT = A.currentTime + 0.05; }
    while (band.nextT < A.currentTime + 0.25) { schedStep(A, band.nextT, band.step); if (band.step === 0) band.t0 = band.nextT; band.step = (band.step + 1) % 32; band.nextT += e8; }
  }
  // vol 0..1 (proximity); near 0..1 opens the muffling filter
  function setBand(vol, near) {
    band.target = S.muted ? 0 : Math.max(0, Math.min(1, vol));
    var A = ready(); if (!A) return;
    bandNodes(A);
    var now = A.currentTime;
    band.vol += (band.target - band.vol) * 0.25;
    band.gain.gain.setTargetAtTime(band.vol, now, 0.25);
    band.filt.frequency.setTargetAtTime(500 + 5500 * Math.max(0, Math.min(1, near == null ? vol : near)), now, 0.3);
    if (band.target > 0.002 && !band.timer) band.timer = setInterval(bandPump, 60);
    if (band.target <= 0.002 && band.vol <= 0.002 && band.timer) { clearInterval(band.timer); band.timer = null; }
  }
  function beat() {     // beat phase (0..1 within a beat) and beat count, for the silhouettes on the TV
    var spb = 60 / band.bpm, t = AC && AC.state === 'running' && band.timer ? AC.currentTime : (Date.now() / 1000);
    var b = t / spb; return { phase: b - Math.floor(b), n: Math.floor(b) };
  }
  function unlock() { var A = live(); if (A && A.state === 'running') S.unlocked = true; return S.unlocked; }
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) { if (root.addEventListener) root.addEventListener(ev, unlock, { passive: true }); });

  root.RDRSfx = {
    play: play, band: setBand, beat: beat, unlock: unlock,
    setMuted: function (m) { S.muted = !!m; if (out) out.gain.value = S.muted ? 0 : 0.85; if (S.muted) setBand(0, 0); },
    muted: function () { return S.muted; },
    state: function () { return AC ? AC.state : 'none'; },
    bandLevel: function () { return band.vol; },
    setLite: function (v) { band.lite = !!v; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
