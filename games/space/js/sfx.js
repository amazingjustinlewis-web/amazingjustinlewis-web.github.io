/* DRIFT SIGNAL - procedural sound (WebAudio, no files; same engine pattern as Iron Stride / Laser Range):
   one-shot SFX on small self-freeing buses, a limiter, a cap on overlapping sounds, plus two looping beds:
   the ship hum (always) and the optional 'cosmic frequency' drone. SSFX.play(name), SSFX.bed(name, on), SSFX.say(text, tone). */
(function (root) {
  'use strict';
  var AC = null, out = null, sfxBus = null, noiseBuf = null, cur = null;
  var S = { muted: false, buses: 0, last: {}, beds: {}, humOn: true, droneOn: false, warp: 0 };
  var SLOW_UA = /CrKey|Tizen|Web0S|webOS|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|Android TV/i.test((root.navigator && root.navigator.userAgent) || '');
  function live() {
    if (!AC) {
      var Ctx = root.AudioContext || root.webkitAudioContext; if (!Ctx) return null;
      var opts = { latencyHint: 'playback' }; if (SLOW_UA) opts.sampleRate = 24000;
      try { AC = new Ctx(opts); } catch (e) { try { AC = new Ctx(); } catch (e2) { return null; } }
      var lim = AC.createDynamicsCompressor(); lim.threshold.value = -4; lim.ratio.value = 16; lim.attack.value = 0.003; lim.release.value = 0.2;
      out = AC.createGain(); out.gain.value = S.muted ? 0 : 0.75; out.connect(lim); lim.connect(AC.destination);
      sfxBus = AC.createGain(); sfxBus.gain.value = 1; sfxBus.connect(out);
    }
    if (AC.state === 'suspended' && AC.resume) try { AC.resume().then(function () { syncBeds(); }, function () {}); } catch (e) {}
    return AC;
  }
  function ready() { var A = live(); return A && A.state === 'running' ? A : null; }
  function noise(A) {
    if (!noiseBuf) { var n = A.sampleRate * 2, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
    var s = A.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function env(A, t, a, peak, d) { var g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(cur || sfxBus); return g; }
  function tone(A, type, f0, f1, t, dur, vol, a) { var o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(env(A, t, a || 0.005, vol, dur)); o.start(t); o.stop(t + dur + a + 0.1); }
  function hiss(A, t, dur, vol, ft, f0, q, f1, a) { var s = noise(A), f = A.createBiquadFilter(); f.type = ft || 'lowpass'; f.frequency.setValueAtTime(f0 || 1000, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); if (q) f.Q.value = q; s.connect(f); f.connect(env(A, t, a || 0.005, vol, dur)); s.start(t, Math.random()); s.stop(t + dur + (a || 0) + 0.1); }
  var N = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  var SOUNDS = {
    blip: function (A, t) { tone(A, 'sine', N(88), 0, t, 0.09, 0.06); },
    chirp: function (A, t) { tone(A, 'sine', N(81), 0, t, 0.07, 0.05); tone(A, 'sine', N(88), 0, t + 0.08, 0.1, 0.05); },
    join: function (A, t) { tone(A, 'sine', N(72), 0, t, 0.2, 0.06); tone(A, 'sine', N(79), 0, t + 0.12, 0.25, 0.06); tone(A, 'sine', N(84), 0, t + 0.24, 0.4, 0.05); },
    leave: function (A, t) { tone(A, 'sine', N(79), 0, t, 0.2, 0.05); tone(A, 'sine', N(72), 0, t + 0.14, 0.35, 0.05); },
    course: function (A, t) { tone(A, 'triangle', N(76), 0, t, 0.12, 0.07); tone(A, 'triangle', N(83), 0, t + 0.1, 0.3, 0.06); },
    warpIn: function (A, t) { tone(A, 'sawtooth', 50, 900, t, 2.4, 0.07, 1.2); hiss(A, t, 2.6, 0.25, 'bandpass', 200, 2, 5000, 1.4); tone(A, 'sine', 40, 25, t + 2.4, 1.2, 0.5); },
    warpOut: function (A, t) { hiss(A, t, 1.2, 0.3, 'bandpass', 4000, 1.5, 150, 0.02); tone(A, 'sine', 300, 45, t, 1.0, 0.25); },
    impact: function (A, t) { hiss(A, t, 0.35, 0.22, 'bandpass', 2400 + Math.random() * 1500, 3, 600); tone(A, 'sine', 180, 70, t, 0.2, 0.08); },
    shieldHit: function (A, t) { tone(A, 'sine', 1400, 300, t, 0.4, 0.05); hiss(A, t, 0.25, 0.12, 'highpass', 3000, 0, 1500); },
    alarm: function (A, t) { for (var i = 0; i < 3; i++) tone(A, 'sawtooth', 520, 780, t + i * 0.55, 0.4, 0.06, 0.03); },
    yellow: function (A, t) { tone(A, 'square', N(76), 0, t, 0.15, 0.04); tone(A, 'square', N(76), 0, t + 0.3, 0.15, 0.04); },
    probe: function (A, t) { tone(A, 'sine', 120, 50, t, 0.4, 0.4); hiss(A, t, 0.9, 0.3, 'bandpass', 1200, 1.5, 300); tone(A, 'sine', N(93), 0, t + 0.5, 0.1, 0.04); },
    reading: function (A, t) { tone(A, 'sine', N(96), 0, t, 0.05, 0.03); tone(A, 'sine', N(91), 0, t + 0.06, 0.05, 0.03); },
    static: function (A, t, o) { hiss(A, t, (o && o.d) || 1.2, (o && o.v) || 0.12, 'bandpass', 2200, 0.7); },
    gear: function (A, t) { tone(A, 'sawtooth', 70, 95, t, 1.6, 0.05, 0.2); hiss(A, t, 1.5, 0.06, 'bandpass', 800, 3); tone(A, 'square', 110, 60, t + 1.7, 0.12, 0.2); hiss(A, t + 1.7, 0.3, 0.3, 'lowpass', 900, 0, 120); },
    thud: function (A, t) { tone(A, 'sine', 70, 28, t, 0.7, 0.7); hiss(A, t, 0.6, 0.5, 'lowpass', 600, 0, 80); tone(A, 'square', 160, 90, t + 0.03, 0.08, 0.08); },
    splash: function (A, t) { hiss(A, t, 1.8, 0.35, 'lowpass', 3000, 0, 250, 0.05); hiss(A, t + 0.2, 1.2, 0.1, 'highpass', 4000, 0, 2000); },
    creature: function (A, t) { tone(A, 'sine', 62, 55, t, 3.5, 0.2, 1.2); tone(A, 'triangle', 93, 88, t + 0.3, 3, 0.05, 1.2); hiss(A, t, 3, 0.05, 'bandpass', 300, 8, 0, 1); },
    tap: function (A, t) { tone(A, 'sine', 900, 400, t, 0.05, 0.12); hiss(A, t, 0.05, 0.15, 'bandpass', 2500, 2); },
    burn: function (A, t) { hiss(A, t, 3.5, 0.3, 'lowpass', 300, 0, 1400, 0.8); tone(A, 'sawtooth', 45, 70, t, 3.5, 0.06, 0.8); },
    deflector: function (A, t) { tone(A, 'sine', 200, 1600, t, 0.6, 0.12); hiss(A, t, 0.8, 0.2, 'bandpass', 600, 1, 6000); },
    raider: function (A, t) { tone(A, 'sawtooth', 58, 52, t, 2.5, 0.08, 0.6); tone(A, 'sawtooth', 87, 80, t, 2.5, 0.05, 0.6); }
  };
  var LIMIT = { impact: 70, shieldHit: 80, reading: 120, static: 300, blip: 50 };
  function play(name, o) {
    var A = ready(); if (!A || S.muted || !SOUNDS[name]) return;
    var now = performance.now(); if (LIMIT[name] && now - (S.last[name] || 0) < LIMIT[name]) return; S.last[name] = now;
    if (S.buses > (SLOW_UA ? 6 : 14)) return;
    var bus = A.createGain(); bus.connect(sfxBus); cur = bus; S.buses++;
    try { SOUNDS[name](A, A.currentTime + 0.01, o); } catch (e) {}
    cur = null; setTimeout(function () { try { bus.disconnect(); } catch (e) {} S.buses--; }, 5000);
  }
  // ---------------- looping beds
  function makeHum(A) {
    var g = A.createGain(); g.gain.value = 0; g.connect(out);
    var lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(g);
    var o1 = A.createOscillator(), o2 = A.createOscillator(), o3 = A.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 41; o2.type = 'sawtooth'; o2.frequency.value = 41.6; o3.type = 'sine'; o3.frequency.value = 82;
    var g3 = A.createGain(); g3.gain.value = 0.4; o3.connect(g3); g3.connect(lp); o1.connect(lp); o2.connect(lp);
    var n = noise(A); n.loop = true; var nf = A.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 400; var ng = A.createGain(); ng.gain.value = 0.25; n.connect(nf); nf.connect(ng); ng.connect(g);
    [o1, o2, o3, n].forEach(function (x) { x.start(); });
    return { g: g, lp: lp, level: 0.09, o1: o1, o2: o2 };
  }
  function makeDrone(A) {
    var g = A.createGain(); g.gain.value = 0; g.connect(out);
    var lfo = A.createOscillator(); lfo.frequency.value = 0.05; var lg = A.createGain(); lg.gain.value = 3; lfo.connect(lg);
    [55, 82.4, 110.3, 164.8, 247.1].forEach(function (f, i) {
      var o = A.createOscillator(); o.type = 'sine'; o.frequency.value = f; lg.connect(o.detune);
      var og = A.createGain(); og.gain.value = 0.25 / (i + 1); o.connect(og); og.connect(g); o.start();
      var tr = A.createOscillator(); tr.frequency.value = 0.03 + i * 0.017; var tg = A.createGain(); tg.gain.value = 0.12 / (i + 1); tr.connect(tg); tg.connect(og.gain); tr.start();
    });
    var n = noise(A); n.loop = true; var bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 12; var ng = A.createGain(); ng.gain.value = 0.3; n.connect(bp); bp.connect(ng); ng.connect(g); n.start();
    var sw = A.createOscillator(); sw.frequency.value = 0.021; var sg = A.createGain(); sg.gain.value = 600; sw.connect(sg); sg.connect(bp.frequency); sw.start();
    lfo.start(); return { g: g, level: 0.16 };
  }
  function syncBeds() {
    var A = ready(); if (!A) return;
    if (!S.beds.hum) S.beds.hum = makeHum(A);
    if (S.droneOn && !S.beds.drone) S.beds.drone = makeDrone(A);
    var t = A.currentTime;
    S.beds.hum.g.gain.setTargetAtTime(S.humOn && !S.muted ? S.beds.hum.level : 0, t, 0.8);
    if (S.beds.drone) S.beds.drone.g.gain.setTargetAtTime(S.droneOn && !S.muted ? S.beds.drone.level : 0, t, 2.5);
  }
  function setWarp(w) {     // the hum rises with engine load
    S.warp = w; var h = S.beds.hum; if (!h || !AC) return;
    var t = AC.currentTime; h.lp.frequency.setTargetAtTime(180 + w * 70, t, 0.6); h.o1.frequency.setTargetAtTime(41 + w * 2.2, t, 0.8); h.o2.frequency.setTargetAtTime(41.6 + w * 2.3, t, 0.8);
  }
  // ---------------- ship computer voice (browser speechSynthesis; three urgency tones)
  var VOICE = { mode: 'occasional', voice: null, lastAt: 0, queue: 0 };
  function pickVoice() {
    var ss = root.speechSynthesis; if (!ss) return null; var vs = ss.getVoices() || []; if (!vs.length) return null;
    var pref = [/Google UK English Female/i, /Samantha/i, /Zira/i, /Serena|Karen|Moira/i, /en-GB/i, /^en/i];
    for (var i = 0; i < pref.length; i++) for (var j = 0; j < vs.length; j++) if (pref[i].test(vs[j].name) || pref[i].test(vs[j].lang)) return vs[j];
    return vs[0];
  }
  var TONES = { calm: { pitch: 0.78, rate: 0.9, vol: 0.85 }, alert: { pitch: 0.88, rate: 1.0, vol: 0.95 }, urgent: { pitch: 1.0, rate: 1.14, vol: 1 } };
  function say(text, tone, detail) {
    // detail = true: only spoken in Detailed mode. Urgent lines always speak unless the voice is Off.
    var ss = root.speechSynthesis; if (!ss || VOICE.mode === 'off' || S.muted) return false;
    if (detail && VOICE.mode !== 'detailed') return false;
    tone = TONES[tone] ? tone : 'calm';
    if (tone !== 'urgent' && performance.now() - VOICE.lastAt < 2500 && ss.speaking) return false;
    if (tone === 'urgent') try { ss.cancel(); } catch (e) {}
    try {
      var u = new root.SpeechSynthesisUtterance(text), p = TONES[tone];
      VOICE.voice = VOICE.voice || pickVoice(); if (VOICE.voice) u.voice = VOICE.voice;
      u.pitch = p.pitch; u.rate = p.rate; u.volume = p.vol;
      if (tone !== 'calm') play(tone === 'urgent' ? 'yellow' : 'chirp'); else play('blip');
      ss.speak(u); VOICE.lastAt = performance.now(); VOICE.lastText = text; return true;
    } catch (e) { return false; }
  }
  if (root.speechSynthesis && root.speechSynthesis.addEventListener) root.speechSynthesis.addEventListener('voiceschanged', function () { VOICE.voice = pickVoice(); });
  root.SSFX = {
    play: play, say: say, setWarp: setWarp, S: S, VOICE: VOICE,
    unlock: function () { live(); syncBeds(); },
    bed: function (name, on) { if (name === 'drone') S.droneOn = !!on; else S.humOn = !!on; syncBeds(); },
    mute: function (m) { S.muted = m == null ? !S.muted : !!m; if (out) out.gain.value = S.muted ? 0 : 0.75; syncBeds(); if (S.muted && root.speechSynthesis) try { root.speechSynthesis.cancel(); } catch (e) {} return S.muted; },
    lastText: function () { return VOICE.lastText || ''; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
