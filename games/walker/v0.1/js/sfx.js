/* WALKER sound: all synthesized, all soft. Ambience beds fade with distance; footsteps are deliberately quiet. */
(function (root) {
  var A = null, master, noiseBuf, beds = {}, muted = /[?&]mute/.test(location.search);
  function ctx() { return A; }
  function init() {
    if (A) { if (A.state === 'suspended') A.resume(); return; }
    try { A = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return; }
    master = A.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(A.destination);
    noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate);
    var d = noiseBuf.getChannelData(0), b = 0; for (var i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }
    bed('breeze', 'lowpass', 500, 0.6); bed('water', 'bandpass', 2400, 3); bed('crowd', 'bandpass', 900, 1.2); bed('wind', 'lowpass', 220, 0.3);
  }
  function bed(name, type, f, Q) {
    var s = A.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = Q;
    var g = A.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start();
    var lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.07 + Math.random() * 0.1; lg.gain.value = f * 0.3; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
    beds[name] = g;
  }
  function setBeds(o) { if (!A) return; for (var k in o) if (beds[k]) beds[k].gain.setTargetAtTime(o[k], A.currentTime, 1.2); }
  function env(node, t, a, peak, dec) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, dur, vol, when) {
    if (!A) return; var t = A.currentTime + (when || 0), o = A.createOscillator(), g = A.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(f, Q, dur, vol, when, type) {
    if (!A) return; var t = A.currentTime + (when || 0), s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = 1 + Math.random() * 0.3; fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = Q; env(g, t, 0.005, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  var S = {
    init: init, setBeds: setBeds, ctx: ctx,
    step: function (surface, vol) {   // grass / pave / dirt / soft
      var v = (vol || 1) * 0.05;
      if (surface === 'grass') noise(2600, 0.8, 0.09, v * 0.7);
      else if (surface === 'pave') noise(1300, 2, 0.05, v);
      else if (surface === 'dirt') noise(700, 1.2, 0.08, v * 1.2);
      else if (surface === 'puddle') { noise(1800, 3, 0.12, v * 1.5); tone('sine', 900, 1400, 0.06, v * 0.4); }
      else noise(300, 1, 0.12, v * 0.8, 0, 'lowpass');
    },
    bird: function (vol) { var v = 0.035 * (vol || 1), f = 2600 + Math.random() * 1600, n = 2 + (Math.random() * 3 | 0); for (var i = 0; i < n; i++) tone('sine', f, f * (1.15 + Math.random() * 0.3), 0.07, v, i * 0.11); },
    drip: function (vol) { tone('sine', 700 + Math.random() * 600, 1800, 0.05, 0.03 * (vol || 1)); },
    boing: function (h) { tone('sine', 140 + h * 30, 90, 0.25, 0.08); noise(180, 1, 0.15, 0.05, 0, 'lowpass'); },
    whee: function () { tone('triangle', 500, 900, 0.5, 0.03); },
    swish: function () { noise(4200, 1, 0.25, 0.05); tone('sine', 1320, 1760, 0.3, 0.03, 0.1); },
    whoosh: function (d) { noise(600, 0.6, d || 0.8, 0.07, 0, 'lowpass'); },
    pop: function () { tone('sine', 600, 1200, 0.08, 0.04); },
    giggle: function (vol) { var v = 0.03 * (vol || 1), f = 520 + Math.random() * 200; for (var i = 0; i < 4; i++) tone('triangle', f * (1 - i * 0.04), f * 0.8, 0.08, v, i * 0.13); },
    pluck: function (f, vol) { tone('triangle', f, f * 0.995, 0.9, 0.05 * (vol || 1)); tone('sine', f * 2, f * 2, 0.4, 0.015 * (vol || 1)); },
    rumble: function (d) { noise(90, 0.7, d || 2, 0.14, 0, 'lowpass'); },
    quack: function () { tone('sawtooth', 300, 220, 0.12, 0.02); },
    car: function () { noise(140, 1, 2.5, 0.025, 0, 'lowpass'); },
    speak: function (text, pitch, rate) {
      if (muted || !root.speechSynthesis) return;
      try { var u = new SpeechSynthesisUtterance(text); u.pitch = pitch || 1.4; u.rate = rate || 0.92; u.volume = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
    }
  };
  root.WSFX = S;
})(window);
