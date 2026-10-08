/* RED DEER RICH - procedural sound (WebAudio only, no audio files, nothing copyrighted).
   RDRSfx.play(name) for effects; RDRSfx.band(vol) drives the Upper Level Youth Centre punk loop
   (an original 4-bar pattern generated live: drums, bass, distorted power chords), muffled when far away. */
(function (root) {
  'use strict';
  /* v0.1.2 audio audit (Chromecast "chunky blips"): the old punk loop built ~7 fresh oscillator/noise voices every
     8th note for the whole game (it never really stopped: far away it idled at 3% volume), and the proximity volume
     rewrote two AudioParams every animation frame. On a slow device that piles up until the audio thread underruns.
     Now: the band is one fixed set of nodes driven by automation, a lookahead scheduler, throttled param writes,
     a voice cap and per-sound rate limits for one-shots, every finished voice is disconnected, a brick-wall limiter,
     a larger 'playback' buffer, and the context suspends itself when nothing has played for a while. */
  var AC = null, out = null, lim = null, noiseBuf = null, distCurve = null;
  var S = { muted: false, unlocked: false, lite: false, voices: 0, peakVoices: 0, created: 0, dropped: 0, lastSound: 0, last: {}, counts: {}, autoSuspended: false };
  var SLOW_UA = /CrKey|Tizen|Web0S|webOS|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|Android TV/i.test((root.navigator && root.navigator.userAgent) || '');
  if (SLOW_UA) S.lite = true;
  var MAX_VOICES = function () { return S.lite ? 16 : 32; };   // checked before each sound starts (a sound adds 1-12 voices), so peaks stay near 40
  var MASTER = 0.7;
  function live() {
    if (!AC) {
      var Ctx = root.AudioContext || root.webkitAudioContext; if (!Ctx) return null;
      var opts = { latencyHint: 'playback' }; if (SLOW_UA) opts.sampleRate = 24000;   // bigger buffer = no underruns; fewer samples on TV sticks
      try { AC = new Ctx(opts); } catch (e) { try { AC = new Ctx(); } catch (e2) { return null; } }
      lim = AC.createDynamicsCompressor();              // used as a limiter: nothing ever clips the speaker
      lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
      out = AC.createGain(); out.gain.value = S.muted ? 0 : MASTER; out.connect(lim); lim.connect(AC.destination);
    }
    if (AC.state === 'suspended' && AC.resume) { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function ready() { var A = live(); return A && A.state === 'running' ? A : null; }
  function noise(A) {
    if (!noiseBuf || noiseBuf.sampleRate !== A.sampleRate) { var n = A.sampleRate, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
    var s = A.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  // every one-shot voice is counted, and its nodes are disconnected the moment it ends
  function track(src, nodes) {
    S.voices++; S.created++; if (S.voices > S.peakVoices) S.peakVoices = S.voices;
    src.onended = function () { S.voices--; src.onended = null; try { src.disconnect(); } catch (e) {} for (var i = 0; i < nodes.length; i++) try { nodes[i].disconnect(); } catch (e) {} };
  }
  function env(A, dest, t, a, peak, d) { var g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest); return g; }
  function tone(A, dest, type, f0, f1, t, dur, vol, a) {
    var o = A.createOscillator(), g = env(A, dest, t, a || 0.005, vol, dur); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(g); track(o, [g]); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function hiss(A, dest, t, dur, vol, ftype, freq, q) {
    var s = noise(A), f = A.createBiquadFilter(), g = env(A, dest, t, 0.003, vol, dur); f.type = ftype || 'highpass'; f.frequency.value = freq || 3000; if (q) f.Q.value = q;
    s.connect(f); f.connect(g); track(s, [f, g]); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
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
    whiteout: function (A, t) { var s = noise(A), f = A.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6); f.frequency.exponentialRampToValueAtTime(300, t + 1.4); var g = env(A, out, t, 0.2, 0.45, 1.3); s.connect(f); f.connect(g); track(s, [f, g]); s.start(t); s.stop(t + 1.6); },
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
  // identical sounds closer together than this are skipped (AI turns at speed fire a lot of them)
  var MIN_GAP = { step: 70, click: 40, dice: 150, cash: 90, buy: 120, card: 120, build: 90, deal: 150, turn: 200, pop: 120, boom: 200, caught: 150, tiptoe: 300, payupAlarm: 300, tarnish: 300, gold: 300 };
  function play(name) {
    if (S.muted || !SOUNDS[name]) return;
    var A = live(); if (!A) return;
    var now = Date.now(), gap = (MIN_GAP[name] || 0) * (S.lite ? 1.6 : 1);
    if (gap && now - (S.last[name] || 0) < gap) { S.dropped++; return; }
    if (S.voices >= MAX_VOICES()) { S.dropped++; return; }      // already busy: a dropped blip beats a stuttering speaker
    S.last[name] = now; S.lastSound = now; S.counts[name] = (S.counts[name] || 0) + 1;
    var go = function () { try { SOUNDS[name](A, A.currentTime + 0.02); } catch (e) {} };
    if (A.state === 'running') go();
    else if (S.autoSuspended && A.resume) { try { A.resume().then(function () { S.autoSuspended = false; go(); }); } catch (e) {} }
  }
  // nothing playing for a while (lobby, results, a paused game): let the audio device sleep
  setInterval(function () {
    if (!AC || AC.state !== 'running' || band.nodes || !AC.suspend) return;
    if (Date.now() - S.lastSound > 30000 && S.voices <= 0) { S.autoSuspended = true; try { AC.suspend(); } catch (e) {} }
  }, 5000);

  // ------------------------------------------------------------------ the band (Upper Level Youth Centre)
  // One fixed set of nodes for the whole loop (built when the band starts, torn down when it stops); every 8th note
  // only schedules automation on them, a short lookahead ahead of the audio clock.
  var band = { vol: 0, target: 0, nodes: null, nextT: 0, step: 0, timer: null, bpm: 176, t0: 0, lastWrite: 0, wVol: -1, wCut: -1, stopAt: 0 };
  var PROG = [40, 36, 43, 38];          // E C G D (MIDI roots, low): an original punk-style 4-bar loop
  var LOOKAHEAD = 0.5, PUMP_MS = 100;
  function dist() {
    if (distCurve) return distCurve;
    var n = 1024, c = new Float32Array(n), k = 40;
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x)); }
    return (distCurve = c);
  }
  function bandBuild(A) {
    if (band.nodes) return band.nodes;
    var n = { all: [], srcs: [] }, G = function (v, to) { var g = A.createGain(); g.gain.value = v; if (to) g.connect(to); n.all.push(g); return g; };
    var F = function (type, f, q, to) { var b = A.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; if (to) b.connect(to); n.all.push(b); return b; };
    var O = function (type, to) { var o = A.createOscillator(); o.type = type; o.connect(to); n.srcs.push(o); return o; };
    n.gain = G(0, out); n.filt = F('lowpass', 700, 0.7, n.gain);
    n.kickG = G(0, n.filt); n.kick = O('sine', n.kickG);
    n.snG = G(0, n.filt); n.snF = F('bandpass', 1800, 0.8, n.snG); n.snTG = G(0, n.filt); n.snT = O('triangle', n.snTG);
    n.hatG = G(0, n.filt); n.hatF = F('highpass', 7000, 0, n.hatG); n.crG = G(0, n.filt); n.crF = F('highpass', 5000, 0, n.crG);
    n.noise = noise(A); n.noise.loop = true; n.noise.connect(n.snF); n.noise.connect(n.hatF); n.noise.connect(n.crF); n.srcs.push(n.noise);
    n.bassG = G(0, n.filt); n.bass = O('sawtooth', n.bassG);
    n.gtrG = G(0.18, n.filt); n.gtrF = F('lowpass', 3200, 0, n.gtrG);
    n.shaper = A.createWaveShaper(); n.shaper.curve = dist(); n.shaper.connect(n.gtrF); n.all.push(n.shaper);
    n.gEnv = G(0, n.shaper); n.g3 = G(S.lite ? 0 : 1, n.gEnv);
    n.gtr = [O('sawtooth', n.gEnv), O('sawtooth', n.gEnv), O('sawtooth', n.g3)];
    var t = A.currentTime + 0.01; n.srcs.forEach(function (o) { o.start(t); });
    band.nodes = n; band.wVol = band.wCut = -1;
    return n;
  }
  function bandTear() {
    var n = band.nodes; if (!n) return; band.nodes = null;
    n.srcs.forEach(function (o) { try { o.stop(); } catch (e) {} try { o.disconnect(); } catch (e) {} });
    n.all.forEach(function (x) { try { x.disconnect(); } catch (e) {} });
  }
  function hit(param, t, peak, a, d) { param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function schedStep(t, step) {
    var n = band.nodes, bar = Math.floor(step / 8) % 4, s8 = step % 8, root = PROG[bar], e8 = 60 / band.bpm / 2;
    if (s8 === 0 || s8 === 3 || s8 === 4) { n.kick.frequency.setValueAtTime(150, t); n.kick.frequency.exponentialRampToValueAtTime(45, t + 0.15); hit(n.kickG.gain, t, 0.9, 0.004, 0.15); }
    if (s8 === 2 || s8 === 6) { hit(n.snG.gain, t, 0.55, 0.003, 0.13); n.snT.frequency.setValueAtTime(220, t); n.snT.frequency.exponentialRampToValueAtTime(160, t + 0.07); hit(n.snTG.gain, t, 0.3, 0.003, 0.07); }
    hit(n.hatG.gain, t, step % 32 === 0 ? 0.35 : 0.12, 0.002, s8 % 2 ? 0.03 : 0.05);
    if (step % 32 === 0) hit(n.crG.gain, t, 0.25, 0.003, 0.9);     // crash at the top of the loop
    n.bass.frequency.setValueAtTime(NOTE(root), t); hit(n.bassG.gain, t, 0.22, 0.004, e8 * 0.85);
    if (s8 === 1) return;                                            // let the open chord on the downbeat ring
    var open = s8 === 0, dur = open ? e8 * 1.85 : e8 * 0.5;
    [0, 7, 12].forEach(function (iv, k) { n.gtr[k].frequency.setValueAtTime(NOTE(root + 12 + iv) * (1 + (Math.random() - 0.5) * 0.004), t); });
    hit(n.gEnv.gain, t, open ? 0.5 : 0.3, 0.004, dur);
  }
  function bandPump() {
    var A = AC; if (!A || A.state !== 'running' || !band.nodes) return;
    var e8 = 60 / band.bpm / 2;
    if (band.nextT < A.currentTime) band.nextT = A.currentTime + 0.05;    // fell behind (slow device / hidden tab): resync, never burst
    while (band.nextT < A.currentTime + LOOKAHEAD) { schedStep(band.nextT, band.step); if (band.step === 0) band.t0 = band.nextT; band.step = (band.step + 1) % 32; band.nextT += e8; }
  }
  function bandStop() {
    if (band.stopping) return; band.stopping = true;            // called every frame while quiet: only the first call counts
    if (band.timer) { clearInterval(band.timer); band.timer = null; }
    if (band.nodes && AC) { band.nodes.gain.gain.cancelScheduledValues(AC.currentTime); band.nodes.gain.gain.setTargetAtTime(0, AC.currentTime, 0.1); }
    clearTimeout(band.stopAt); band.stopAt = setTimeout(function () { band.stopping = false; if (!band.timer) bandTear(); }, 800);
  }
  // vol 0..1 (proximity); near 0..1 opens the muffling filter. Called every frame, writes the audio graph at most ~8x a second.
  function setBand(vol, near) {
    band.target = S.muted ? 0 : Math.max(0, Math.min(1, vol));
    if (S.lite && band.target <= 0.035) band.target = 0;          // slow devices: no faint far-away loop at all
    band.vol += (band.target - band.vol) * 0.25;
    if (band.target <= 0.002 && band.vol <= 0.004) { band.vol = 0; if (band.timer || band.nodes) bandStop(); return; }
    var A = ready(); if (!A) return;
    if (!band.timer) { clearTimeout(band.stopAt); band.stopping = false; bandBuild(A); band.wVol = band.wCut = -1; band.lastWrite = 0; band.nextT = 0; band.timer = setInterval(bandPump, PUMP_MS); bandPump(); }
    S.lastSound = Date.now();
    var now = A.currentTime, cut = 500 + 5500 * Math.max(0, Math.min(1, near == null ? vol : near));
    if (now - band.lastWrite < 0.12) return;
    if (Math.abs(band.vol - band.wVol) > 0.004) { band.nodes.gain.gain.setTargetAtTime(band.vol, now, 0.25); band.wVol = band.vol; band.lastWrite = now; }
    if (Math.abs(cut - band.wCut) > 40) { band.nodes.filt.frequency.setTargetAtTime(cut, now, 0.3); band.wCut = cut; band.lastWrite = now; }
  }
  function beat() {     // beat phase (0..1 within a beat) and beat count, for the silhouettes on the TV
    var spb = 60 / band.bpm, t = AC && AC.state === 'running' && band.timer ? AC.currentTime : (Date.now() / 1000);
    var b = t / spb; return { phase: b - Math.floor(b), n: Math.floor(b) };
  }
  function unlock() { var A = live(); if (A && A.state === 'running') S.unlocked = true; return S.unlocked; }
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) { if (root.addEventListener) root.addEventListener(ev, unlock, { passive: true }); });

  root.RDRSfx = {
    play: play, band: setBand, beat: beat, unlock: unlock,
    setMuted: function (m) { S.muted = !!m; if (out) out.gain.value = S.muted ? 0 : MASTER; if (S.muted) setBand(0, 0); },
    muted: function () { return S.muted; },
    state: function () { return AC ? AC.state : 'none'; },
    bandLevel: function () { return band.vol; },
    setLite: function (v) { S.lite = !!v || SLOW_UA; if (band.nodes) band.nodes.g3.gain.value = S.lite ? 0 : 1; },
    meter: function () {     // test helper: peak level at the speaker over the last ~40 ms
      if (!AC) return null; if (!S.an) { S.an = AC.createAnalyser(); S.an.fftSize = 2048; lim.connect(S.an); }
      var d = new Float32Array(S.an.fftSize), pk = 0; S.an.getFloatTimeDomainData(d); for (var i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); return pk;
    },
    stats: function () { return { voices: S.voices, peakVoices: S.peakVoices, created: S.created, dropped: S.dropped, bandOn: !!band.nodes, state: AC ? AC.state : 'none', rate: AC ? AC.sampleRate : 0, lite: S.lite, counts: S.counts }; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
