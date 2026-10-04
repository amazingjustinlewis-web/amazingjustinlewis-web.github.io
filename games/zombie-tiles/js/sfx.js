/* ZOMBIE TILES - procedural sound effects (v0.3). WebAudio only, no audio files: short, punchy, kid-friendly.
   ZTSfx.play(name, {pitch}) ; names: crunch, victory, charge, scream, ouch, rotor, pop, fanfare, fuse, snare, boom, plus tone() for the small UI blips. */
(function (root) {
  'use strict';
  var AC = null, out = null, noiseBuf = null;
  var S = { muted: false, buses: 0, peakBuses: 0, dropped: 0, last: {}, lastSound: 0 };
  /* audio audit, Oct 2026 (same fix as Red Deer Rich v0.1.2, for slow TV sticks): bigger 'playback' buffer, a limiter,
     every sound plays into its own small bus that is disconnected once the sound is over (so finished nodes are
     freed), a cap on overlapping sounds, per-sound rate limits, and the context sleeps when nothing has played. */
  var SLOW_UA = /CrKey|Tizen|Web0S|webOS|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|Android TV/i.test((root.navigator && root.navigator.userAgent) || '');
  var MAX_BUSES = SLOW_UA ? 8 : 16;
  var MIN_GAP = { pop: 60, ouch: 60, crunch: 80, victory: 120, charge: 120, scream: 120, boom: 150, tone: 35 };
  function live() {
    if (!AC) {
      var Ctx = root.AudioContext || root.webkitAudioContext, opts = { latencyHint: 'playback' }; if (SLOW_UA) opts.sampleRate = 24000;
      try { AC = new Ctx(opts); } catch (e) { AC = new Ctx(); }
      var lim = AC.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
      out = AC.createGain(); out.gain.value = 0.8; out.connect(lim); lim.connect(AC.destination);
    }
    if (AC.state === 'suspended' && AC.resume) try { AC.resume().then(function () { S.autoSusp = false; }, function () {}); } catch (e) {}
    return AC;
  }
  function bus(A, name, life) {      // null = skip this sound (too many at once, or the same sound just played)
    var now = Date.now(), gap = MIN_GAP[name] || 0;
    if (gap && now - (S.last[name] || 0) < gap) { S.dropped++; return null; }
    if (S.buses >= MAX_BUSES) { S.dropped++; return null; }
    S.last[name] = now; S.lastSound = now;
    var g = A.createGain(); g.connect(out); S.buses++; if (S.buses > S.peakBuses) S.peakBuses = S.buses;
    setTimeout(function () { try { g.disconnect(); } catch (e) {} S.buses--; }, life * 1000);
    return g;
  }
  setInterval(function () {        // nothing for 30 s: let the audio device sleep (live() wakes it on the next sound)
    if (AC && AC.state === 'running' && AC.suspend && S.buses <= 0 && Date.now() - S.lastSound > 30000) try { S.autoSusp = true; AC.suspend().then(null, function () {}); } catch (e) {}
  }, 5000);
  function noise(A) {
    if (!noiseBuf || noiseBuf.sampleRate !== A.sampleRate) {
      var n = A.sampleRate, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = b;
    }
    var s = A.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function gainEnv(A, t, attack, peak, decay) {
    var g = A.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }
  function osc(A, dest, type, f0, f1, t, dur, vol, attack) {
    var o = A.createOscillator(), g = gainEnv(A, t, attack || 0.005, vol, dur);
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function vibrato(A, o, t, dur, rate, depth) {
    var l = A.createOscillator(), lg = A.createGain(); l.frequency.value = rate; lg.gain.value = depth;
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  var SOUNDS = {
    // lost a fight: a crunchy thud
    crunch: function (A, dest, t) {
      var n = noise(A), f = A.createBiquadFilter(), g = gainEnv(A, t, 0.004, 0.55, 0.28);
      f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.28);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.35);
      osc(A, dest, 'sawtooth', 150, 38, t, 0.32, 0.32);
      for (var i = 0; i < 3; i++) { var c = noise(A), cf = A.createBiquadFilter(), cg = gainEnv(A, t + 0.03 + i * 0.045, 0.002, 0.3, 0.03); cf.type = 'bandpass'; cf.frequency.value = 1800 - i * 400; cf.Q.value = 3; c.connect(cf); cf.connect(cg); cg.connect(dest); c.start(t + 0.03 + i * 0.045); c.stop(t + 0.12 + i * 0.045); }
    },
    // killed a zombie: happy rising arpeggio + sparkle
    victory: function (A, dest, t) {
      [523, 659, 784, 1047].forEach(function (f, i) { osc(A, dest, 'square', f, 0, t + i * 0.07, 0.12, 0.12); osc(A, dest, 'triangle', f * 2, 0, t + i * 0.07, 0.1, 0.06); });
      for (var i = 0; i < 5; i++) osc(A, dest, 'sine', 2000 + Math.random() * 1600, 0, t + 0.3 + i * 0.045, 0.08, 0.05);
    },
    // charging into a fight: "hup-hup-HYAAA!" + a drum hit
    charge: function (A, dest, t, o) {
      var p = o.pitch || 1;
      osc(A, dest, 'square', 330 * p, 300 * p, t, 0.06, 0.12); osc(A, dest, 'square', 370 * p, 330 * p, t + 0.1, 0.06, 0.12);
      var f = A.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(700, t + 0.2); f.frequency.exponentialRampToValueAtTime(1500, t + 0.55); f.connect(dest);
      var v = osc(A, f, 'sawtooth', 240 * p, 480 * p, t + 0.2, 0.4, 0.5, 0.03); vibrato(A, v, t + 0.2, 0.4, 9, 18 * p);
      var n = noise(A), nf = A.createBiquadFilter(), ng = gainEnv(A, t + 0.2, 0.003, 0.5, 0.12); nf.type = 'lowpass'; nf.frequency.value = 500;
      n.connect(nf); nf.connect(ng); ng.connect(dest); n.start(t + 0.2); n.stop(t + 0.36);
      osc(A, dest, 'sine', 120, 50, t + 0.2, 0.18, 0.35);
    },
    // cornered / grabbed: a little cartoon "eek!"
    scream: function (A, dest, t, o) {
      var p = o.pitch || 1, f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400 * p; f.Q.value = 1.2; f.connect(dest);
      var a = A.createOscillator(), g = gainEnv(A, t, 0.02, 0.5, 0.38);
      a.type = 'triangle'; a.frequency.setValueAtTime(820 * p, t); a.frequency.exponentialRampToValueAtTime(1500 * p, t + 0.1); a.frequency.exponentialRampToValueAtTime(1050 * p, t + 0.4);
      a.connect(g); g.connect(f); a.start(t); a.stop(t + 0.45); vibrato(A, a, t, 0.42, 28, 45 * p);
      osc(A, f, 'sine', 1640 * p, 2100 * p, t, 0.3, 0.12, 0.02);
    },
    // a small "oof" when a fight hurts
    ouch: function (A, dest, t, o) { var p = o.pitch || 1; osc(A, dest, 'square', 420 * p, 210 * p, t, 0.14, 0.14); },
    // escape cinematic: helicopter rotor "whop-whop" (swells in, fades out as it flies away)
    rotor: function (A, dest, t, o) {
      var dur = o.dur || 2.6, rate = 11, n = Math.floor(dur * rate);
      var f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3; f.connect(dest);
      for (var i = 0; i < n; i++) {
        var tt = t + i / rate, x = i / n, vol = 0.55 * Math.min(1, x * 4) * Math.min(1, (1 - x) * 2.2) + 0.02;
        var b = noise(A), g = gainEnv(A, tt, 0.006, vol, 0.07); b.connect(g); g.connect(f); b.start(tt); b.stop(tt + 0.09);
        osc(A, dest, 'sine', 70, 55, tt, 0.06, vol * 0.35);
      }
    },
    // escape cinematic: one firework (thump, pop, crackle)
    pop: function (A, dest, t, o) {
      var p = o.pitch || 1;
      osc(A, dest, 'sine', 220 * p, 80, t, 0.12, 0.3);
      var n = noise(A), f = A.createBiquadFilter(), g = gainEnv(A, t, 0.002, 0.5, 0.16); f.type = 'highpass'; f.frequency.value = 900;
      n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.2);
      for (var i = 0; i < 7; i++) { var tt = t + 0.12 + Math.random() * 0.4, c = noise(A), cf = A.createBiquadFilter(), cg = gainEnv(A, tt, 0.001, 0.18, 0.025); cf.type = 'bandpass'; cf.frequency.value = 2500 + Math.random() * 3000; cf.Q.value = 4; c.connect(cf); cf.connect(cg); cg.connect(dest); c.start(tt); c.stop(tt + 0.04); }
    },
    // v0.4 dynamite lit: a short sizzle
    fuse: function (A, dest, t) {
      var n = noise(A), f = A.createBiquadFilter(), g = A.createGain(); f.type = 'highpass'; f.frequency.value = 3500;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.05); g.gain.setValueAtTime(0.22, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      var l = A.createOscillator(), lg = A.createGain(); l.frequency.value = 23; lg.gain.value = 0.12; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + 0.8);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.85);
    },
    // v0.4 trap: SNAP + rope whoosh upward + cartoon boing
    snare: function (A, dest, t) {
      var c = noise(A), cf = A.createBiquadFilter(), cg = gainEnv(A, t, 0.002, 0.5, 0.05); cf.type = 'bandpass'; cf.frequency.value = 2400; cf.Q.value = 2;
      c.connect(cf); cf.connect(cg); cg.connect(dest); c.start(t); c.stop(t + 0.08);
      var n = noise(A), f = A.createBiquadFilter(), g = gainEnv(A, t + 0.04, 0.05, 0.3, 0.3); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(400, t + 0.04); f.frequency.exponentialRampToValueAtTime(3000, t + 0.38); n.connect(f); f.connect(g); g.connect(dest); n.start(t + 0.04); n.stop(t + 0.45);
      var o = osc(A, dest, 'sine', 180, 520, t + 0.3, 0.35, 0.3, 0.01); vibrato(A, o, t + 0.3, 0.35, 14, 60);
    },
    // v0.4 dynamite: big (but not scary) KA-BOOM
    boom: function (A, dest, t) {
      var n = noise(A), f = A.createBiquadFilter(), g = gainEnv(A, t, 0.004, 0.9, 1.1); f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(120, t + 1.0); n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 1.2);
      osc(A, dest, 'sine', 110, 30, t, 0.9, 0.8, 0.005); osc(A, dest, 'triangle', 70, 24, t + 0.02, 0.7, 0.45);
      for (var i = 0; i < 6; i++) { var tt = t + 0.25 + Math.random() * 0.6, d = noise(A), df = A.createBiquadFilter(), dg = gainEnv(A, tt, 0.002, 0.15, 0.04); df.type = 'bandpass'; df.frequency.value = 900 + Math.random() * 1500; d.connect(df); df.connect(dg); dg.connect(dest); d.start(tt); d.stop(tt + 0.06); }
    },
    // escape cinematic: ta-da fanfare with a little crowd cheer
    fanfare: function (A, dest, t) {
      [[523, 0, 0.12], [659, 0.13, 0.12], [784, 0.26, 0.12], [1047, 0.39, 0.5]].forEach(function (n) {
        osc(A, dest, 'square', n[0], 0, t + n[1], n[2], 0.11); osc(A, dest, 'triangle', n[0] / 2, 0, t + n[1], n[2], 0.12);
      });
      [523, 659, 784].forEach(function (f) { var v = osc(A, dest, 'sawtooth', f, 0, t + 0.39, 0.55, 0.05, 0.02); vibrato(A, v, t + 0.39, 0.55, 6, 5); });
      var c = noise(A), cf = A.createBiquadFilter(), cg = A.createGain(); cf.type = 'bandpass'; cf.frequency.value = 1300; cf.Q.value = 0.8;
      cg.gain.setValueAtTime(0.0001, t + 0.3); cg.gain.exponentialRampToValueAtTime(0.16, t + 0.6); cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      c.connect(cf); cf.connect(cg); cg.connect(dest); c.start(t + 0.3); c.stop(t + 1.55);
    }
  };
  S.play = function (name, o) {
    if (S.muted || !SOUNDS[name]) return;
    try { var A = live(), b = bus(A, name, 2.5 + ((o && o.dur) || 0)); if (b) SOUNDS[name](A, b, A.currentTime + 0.02, o || {}); } catch (e) {}
  };
  S.tone = function (f, d, type, vol, slide) {
    if (S.muted) return;
    try { var A = live(), b = bus(A, 'tone', d + 0.5); if (b) osc(A, b, type || 'square', f, slide || 0, A.currentTime + 0.01, d, vol || 0.06, 0.002); } catch (e) {}
  };
  S.stats = function () { return { buses: S.buses, peakBuses: S.peakBuses, dropped: S.dropped, state: AC ? AC.state : 'none', rate: AC ? AC.sampleRate : 0 }; };
  // test helper: render a sound offline and return its peak and length (seconds above -40 dB)
  S.render = function (name, o) {
    var Off = root.OfflineAudioContext || root.webkitOfflineAudioContext, A = new Off(1, 44100 * 3, 44100);
    SOUNDS[name](A, A.destination, 0.01, o || {});
    return A.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), peak = 0, lastLoud = 0;
      for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.01) lastLoud = i; }
      return { peak: peak, secs: lastLoud / 44100 };
    });
  };
  S.names = Object.keys(SOUNDS);
  root.ZTSfx = S;
})(typeof window !== 'undefined' ? window : globalThis);
