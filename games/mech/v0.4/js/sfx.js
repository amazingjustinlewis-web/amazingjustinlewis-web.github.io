/* IRON STRIDE - procedural sound (built on the Laser Range engine) (WebAudio only, no audio files). LRSfx.play(name, opts). */
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
  var SOUNDS = {
    stomp: function (A, t, o) { var k = (o && o.k) || 1; tone(A, 'sine', 90 * k, 32, t, 0.42, 0.75); hiss(A, t, 0.3, 0.35, 'lowpass', 700, 0, 120); tone(A, 'square', 55, 40, t, 0.12, 0.12); hiss(A, t + 0.05, 0.12, 0.06, 'bandpass', 2400, 6); },
    servo: function (A, t) { tone(A, 'sawtooth', 140, 210, t, 0.28, 0.035); tone(A, 'square', 280, 330, t, 0.22, 0.015); },
    cannon: function (A, t) { tone(A, 'square', 260, 70, t, 0.07, 0.22); hiss(A, t, 0.08, 0.4, 'bandpass', 1600, 1.2, 500); tone(A, 'sine', 120, 50, t, 0.12, 0.3); },
    rocket: function (A, t) { hiss(A, t, 0.7, 0.45, 'bandpass', 900, 1.5, 2600); tone(A, 'sawtooth', 220, 600, t, 0.5, 0.06); tone(A, 'sine', 90, 40, t, 0.2, 0.35); },
    charge: function (A, t, o) { var d = (o && o.d) || 1.1; tone(A, 'sawtooth', 180, 1500, t, d, 0.07, 0.05); tone(A, 'sine', 360, 3000, t, d, 0.06, 0.05); },
    rail: function (A, t, o) { var p = (o && o.p) || 1; tone(A, 'sawtooth', 2400, 80, t, 0.5 + 0.3 * p, 0.25); tone(A, 'square', 1200, 60, t, 0.35, 0.12); hiss(A, t, 0.5, 0.45 * p, 'highpass', 2000, 0, 300); tone(A, 'sine', 70, 30, t, 0.6, 0.6 * p); },
    boom: function (A, t, o) { var s = (o && o.s) || 1; tone(A, 'sine', 120, 26, t, 0.9 * s, 0.9); hiss(A, t, 1.0 * s, 0.75, 'lowpass', 2200, 0, 140); tone(A, 'square', 64, 28, t, 0.35, 0.25); },
    hit: function (A, t) { tone(A, 'square', 900, 400, t, 0.05, 0.08); hiss(A, t, 0.04, 0.12, 'bandpass', 3500, 5); },
    clang: function (A, t) { tone(A, 'square', 330, 300, t, 0.12, 0.1); tone(A, 'sine', 1210, 1150, t, 0.25, 0.07); hiss(A, t, 0.04, 0.15, 'bandpass', 3000, 4); },
    hurt: function (A, t) { tone(A, 'sawtooth', 160, 60, t, 0.35, 0.35); hiss(A, t, 0.3, 0.4, 'lowpass', 1200, 0, 200); tone(A, 'square', NOTE(70), 0, t + 0.05, 0.08, 0.06); },
    reload: function (A, t) { tone(A, 'square', 500, 300, t, 0.05, 0.1); hiss(A, t + 0.12, 0.08, 0.2, 'bandpass', 1800, 3); tone(A, 'square', 180, 120, t + 0.28, 0.08, 0.18); tone(A, 'sine', 900, 1100, t + 0.4, 0.06, 0.06); },
    loaded: function (A, t) { tone(A, 'square', 220, 160, t, 0.06, 0.2); hiss(A, t, 0.05, 0.2, 'bandpass', 2500, 4); tone(A, 'triangle', NOTE(84), 0, t + 0.08, 0.1, 0.07); },
    dry: function (A, t) { tone(A, 'square', 1300, 1200, t, 0.025, 0.06); },
    beep: function (A, t) { tone(A, 'square', NOTE(84), 0, t, 0.07, 0.07); },
    beep2: function (A, t) { tone(A, 'square', NOTE(79), 0, t, 0.06, 0.06); tone(A, 'square', NOTE(86), 0, t + 0.08, 0.08, 0.06); },
    lock: function (A, t) { tone(A, 'square', NOTE(88), 0, t, 0.05, 0.05); },
    lockon: function (A, t) { tone(A, 'square', NOTE(93), 0, t, 0.09, 0.09); tone(A, 'square', NOTE(100), 0, t + 0.09, 0.16, 0.09); },
    warn: function (A, t) { tone(A, 'square', NOTE(76), 0, t, 0.12, 0.08); tone(A, 'square', NOTE(76), 0, t + 0.18, 0.12, 0.08); },
    alarm: function (A, t) { tone(A, 'sawtooth', 600, 900, t, 0.25, 0.1); tone(A, 'sawtooth', 600, 900, t + 0.3, 0.25, 0.1); },
    select: function (A, t) { tone(A, 'square', 700, 900, t, 0.04, 0.08); tone(A, 'square', 400, 300, t + 0.06, 0.06, 0.1); },
    eject: function (A, t) { hiss(A, t, 1.4, 0.6, 'bandpass', 500, 1, 3000); tone(A, 'sine', 80, 300, t, 1.2, 0.35); tone(A, 'square', 300, 120, t, 0.15, 0.2); },
    brace: function (A, t) { tone(A, 'sawtooth', 300, 90, t, 0.4, 0.12); tone(A, 'sine', 70, 40, t + 0.3, 0.3, 0.5); hiss(A, t + 0.3, 0.2, 0.3, 'lowpass', 800); },
    bay: function (A, t) { [72, 76, 79, 84].forEach(function (n, i) { tone(A, 'triangle', NOTE(n), 0, t + i * 0.08, 0.18, 0.09); }); },
    join: function (A, t) { tone(A, 'triangle', NOTE(76), 0, t, 0.12, 0.12); tone(A, 'triangle', NOTE(83), 0, t + 0.1, 0.2, 0.12); },
    go: function (A, t) { tone(A, 'square', NOTE(72), 0, t, 0.2, 0.1); tone(A, 'square', NOTE(79), 0, t + 0.15, 0.4, 0.12); },
    click: function (A, t) { tone(A, 'square', 900, 700, t, 0.03, 0.06); }
  };
  var MIN_GAP = { cannon: 45, boom: 70, hit: 40, clang: 40, stomp: 120, servo: 300, lock: 140, lockon: 60, hurt: 120, beep: 60 };   // do not stack identical sounds (Chromecast CPU)
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
  root.MechSfx = { play: play, unlock: unlock,
    setMuted: function (m) { S.muted = !!m; if (out) out.gain.value = S.muted ? 0 : 0.7; }, muted: function () { return S.muted; },
    setLite: function (v) { S.lite = !!v || SLOW_UA; }, stats: function () { return { buses: S.buses, peakBuses: S.peakBuses, dropped: S.dropped, state: AC ? AC.state : 'none', rate: AC ? AC.sampleRate : 0 }; }, state: function () { return AC ? AC.state : 'none'; } };
})(typeof window !== 'undefined' ? window : globalThis);
