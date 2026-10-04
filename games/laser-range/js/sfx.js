/* LASER RANGE - procedural sound (WebAudio only, no audio files). LRSfx.play(name, opts). */
(function (root) {
  'use strict';
  var AC = null, out = null, noiseBuf = null, cur = null;
  var S = { muted: false, lite: false, last: {}, buses: 0, peakBuses: 0, dropped: 0, lastSound: 0 };
  /* audio audit (same fix as Red Deer Rich v0.1.2, for slow TV sticks): bigger 'playback' buffer, a limiter, each
     sound plays into its own small bus that is disconnected when the sound is over (finished nodes get freed), a cap
     on overlapping sounds on top of the per-sound rate limits, and the context sleeps when nothing has played. */
  var SLOW_UA = /CrKey|Tizen|Web0S|webOS|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|Android TV/i.test((root.navigator && root.navigator.userAgent) || '');
  if (SLOW_UA) S.lite = true;
  function live() {
    if (!AC) {
      var Ctx = root.AudioContext || root.webkitAudioContext; if (!Ctx) return null;
      var opts = { latencyHint: 'playback' }; if (SLOW_UA) opts.sampleRate = 24000;
      try { AC = new Ctx(opts); } catch (e) { try { AC = new Ctx(); } catch (e2) { return null; } }
      var lim = AC.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
      out = AC.createGain(); out.gain.value = S.muted ? 0 : 0.7; out.connect(lim); lim.connect(AC.destination);
    }
    if (AC.state === 'suspended' && AC.resume) { try { AC.resume().then(function () { S.autoSusp = false; }, function () {}); } catch (e) {} }
    return AC;
  }
  setInterval(function () {
    if (AC && AC.state === 'running' && AC.suspend && S.buses <= 0 && Date.now() - S.lastSound > 30000) try { S.autoSusp = true; AC.suspend().then(null, function () {}); } catch (e) {}
  }, 5000);
  function ready() { var A = live(); return A && A.state === 'running' ? A : null; }
  function noise(A) {
    if (!noiseBuf) { var n = A.sampleRate, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
    var s = A.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function env(A, t, a, peak, d) { var g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(cur || out); return g; }
  function tone(A, type, f0, f1, t, dur, vol, a) {
    var o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(env(A, t, a || 0.004, vol, dur)); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(A, t, dur, vol, ftype, freq, q, f1) {
    var s = noise(A), f = A.createBiquadFilter(); f.type = ftype || 'highpass'; f.frequency.setValueAtTime(freq || 3000, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); if (q) f.Q.value = q;
    s.connect(f); f.connect(env(A, t, 0.003, vol, dur)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  var NOTE = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  var SEAT_PITCH = [1, 1.19, 0.84, 1.41];          // each player's laser sounds a little different
  var SOUNDS = {
    zap: function (A, t, o) { var k = SEAT_PITCH[(o && o.seat) || 0] || 1; tone(A, 'sawtooth', 1900 * k, 240 * k, t, 0.13, 0.13); tone(A, 'square', 2600 * k, 500 * k, t, 0.06, 0.05); },
    bigzap: function (A, t, o) { var k = SEAT_PITCH[(o && o.seat) || 0] || 1, p = (o && o.power) || 1; tone(A, 'sawtooth', 900 * k, 90 * k, t, 0.35 + 0.2 * p, 0.22); tone(A, 'square', 1500 * k, 120, t, 0.25, 0.08); if (!S.lite) hiss(A, t, 0.3, 0.2, 'bandpass', 2500, 2, 400); },
    pop: function (A, t) { tone(A, 'square', 620, 1240, t, 0.07, 0.12); tone(A, 'triangle', 1240, 1900, t + 0.05, 0.1, 0.12); },
    gold: function (A, t) { [84, 88, 91, 96].forEach(function (n, i) { tone(A, 'triangle', NOTE(n), 0, t + i * 0.05, 0.16, 0.12); }); },
    oops: function (A, t) { tone(A, 'sawtooth', NOTE(62), NOTE(55), t, 0.45, 0.12, 0.03); },
    thunk: function (A, t) { tone(A, 'sine', 180, 70, t, 0.1, 0.25); hiss(A, t, 0.05, 0.18, 'lowpass', 900); },
    clang: function (A, t) { tone(A, 'square', 330, 300, t, 0.12, 0.1); tone(A, 'sine', 1210, 1150, t, 0.25, 0.07); hiss(A, t, 0.04, 0.15, 'bandpass', 3000, 4); },
    boom: function (A, t) { tone(A, 'sine', 140, 28, t, 0.8, 0.9); hiss(A, t, 0.9, 0.75, 'lowpass', 2400, 0, 160); tone(A, 'square', 70, 30, t, 0.35, 0.25); },
    swoosh: function (A, t) { hiss(A, t, 0.35, 0.35, 'bandpass', 600, 3, 4200); tone(A, 'sine', 300, 1200, t, 0.3, 0.08); },
    up: function (A, t) { tone(A, 'triangle', 300, 520, t, 0.08, 0.035); },       // a target popping up (very quiet)
    powerup: function (A, t) { [72, 76, 79, 84, 88].forEach(function (n, i) { tone(A, 'square', NOTE(n), 0, t + i * 0.06, 0.12, 0.08); }); },
    balloon: function (A, t) { hiss(A, t, 0.12, 0.5, 'highpass', 1500); tone(A, 'sine', 900, 200, t, 0.1, 0.12); },
    beep: function (A, t) { tone(A, 'square', NOTE(72), 0, t, 0.14, 0.12); },
    go: function (A, t) { tone(A, 'square', NOTE(84), 0, t, 0.4, 0.14); tone(A, 'sawtooth', NOTE(72), 0, t, 0.4, 0.06); },
    tick: function (A, t) { tone(A, 'square', NOTE(96), 0, t, 0.03, 0.06); },
    buzzer: function (A, t) { tone(A, 'sawtooth', 160, 150, t, 0.9, 0.2, 0.02); tone(A, 'square', 80, 78, t, 0.9, 0.1, 0.02); },
    fanfare: function (A, t) { [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.75], [72, 0.9]].forEach(function (x) { tone(A, 'sawtooth', NOTE(x[0]), 0, t + x[1], x[1] > 0.8 ? 0.8 : 0.2, 0.11); tone(A, 'square', NOTE(x[0] + 12), 0, t + x[1], 0.15, 0.05); }); },
    calok: function (A, t) { tone(A, 'sine', NOTE(81), 0, t, 0.12, 0.15); tone(A, 'sine', NOTE(88), 0, t + 0.08, 0.2, 0.13); },
    caldone: function (A, t) { [76, 81, 85, 88].forEach(function (n, i) { tone(A, 'triangle', NOTE(n), 0, t + i * 0.07, 0.22, 0.13); }); },
    join: function (A, t) { tone(A, 'triangle', NOTE(76), 0, t, 0.12, 0.12); tone(A, 'triangle', NOTE(83), 0, t + 0.1, 0.2, 0.12); },
    click: function (A, t) { tone(A, 'square', 900, 700, t, 0.03, 0.06); }
  };
  var MIN_GAP = { up: 90, zap: 25, pop: 30, clang: 40, boom: 70, thunk: 40 };   // do not stack identical sounds (Chromecast CPU)
  function play(name, o) {
    if (S.muted || !SOUNDS[name]) return; var A = live(); if (!A || (A.state !== 'running' && !S.autoSusp)) return;   // asleep on purpose: it wakes and plays
    var now = Date.now(), gap = MIN_GAP[name] || 0; if (S.lite) gap *= 2;
    if (gap && now - (S.last[name] || 0) < gap) { S.dropped++; return; }
    if (S.buses >= (S.lite ? 8 : 16)) { S.dropped++; return; }
    S.last[name] = now; S.lastSound = now;
    var b = A.createGain(); b.connect(out); S.buses++; if (S.buses > S.peakBuses) S.peakBuses = S.buses;
    setTimeout(function () { try { b.disconnect(); } catch (e) {} S.buses--; }, 2500);
    cur = b; try { SOUNDS[name](A, A.currentTime + 0.02, o); } catch (e) {} cur = null;
  }
  function unlock() { var A = live(); return !!(A && A.state === 'running'); }
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) { if (root.addEventListener) root.addEventListener(ev, unlock, { passive: true }); });
  root.LRSfx = { play: play, unlock: unlock,
    setMuted: function (m) { S.muted = !!m; if (out) out.gain.value = S.muted ? 0 : 0.7; }, muted: function () { return S.muted; },
    setLite: function (v) { S.lite = !!v || SLOW_UA; }, stats: function () { return { buses: S.buses, peakBuses: S.peakBuses, dropped: S.dropped, state: AC ? AC.state : 'none', rate: AC ? AC.sampleRate : 0 }; }, state: function () { return AC ? AC.state : 'none'; } };
})(typeof window !== 'undefined' ? window : globalThis);
