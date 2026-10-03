/* =====================================================================
   audio.js - tiny WebAudio synth. No sound files needed.
   Sfx.play('hop') etc. Charge hum is a continuous voice per player.
   To use real sound files later, swap the bodies of the functions in SOUNDS.
   ===================================================================== */
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null, muted = false, silentDone = false;
  const hums = [null, null];

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ac = new AC(); } catch (e) { return null; }
      master = ac.createGain();
      master.gain.value = muted ? 0 : CONFIG.audio.volume;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended' || ac.state === 'interrupted') ac.resume().catch(() => {});   // (iOS: 'interrupted')
    return ac;
  }

  // ---- building blocks ----
  function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, delay = 0, attack = 0.005 }) {
    if (!ensure()) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise({ dur = 0.2, vol = 0.3, type = 'lowpass', f0 = 2000, f1 = f0, q = 1, delay = 0 }) {
    if (!ensure()) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    hop:      () => tone({ type: 'square', f0: 380, f1: 760, dur: 0.09, vol: 0.12 }),
    bigjump:  () => { tone({ type: 'square', f0: 220, f1: 990, dur: 0.22, vol: 0.14 }); tone({ type: 'triangle', f0: 110, f1: 440, dur: 0.25, vol: 0.2 }); },
    hugejump: () => { tone({ type: 'sawtooth', f0: 160, f1: 1200, dur: 0.32, vol: 0.12 }); tone({ type: 'triangle', f0: 80, f1: 600, dur: 0.35, vol: 0.22 }); noise({ dur: 0.3, vol: 0.12, type: 'highpass', f0: 800, f1: 4000 }); },
    land:     () => { tone({ type: 'sine', f0: 160, f1: 60, dur: 0.1, vol: 0.3 }); noise({ dur: 0.06, vol: 0.08, f0: 900, f1: 200 }); },
    logland:  () => { tone({ type: 'triangle', f0: 200, f1: 90, dur: 0.12, vol: 0.25 }); noise({ dur: 0.1, vol: 0.06, f0: 1500, f1: 300 }); },
    splash:   () => { noise({ dur: 0.5, vol: 0.35, type: 'bandpass', f0: 2500, f1: 300, q: 0.8 }); tone({ type: 'sine', f0: 600, f1: 120, dur: 0.25, vol: 0.12 }); },
    splat:    () => { noise({ dur: 0.25, vol: 0.45, f0: 1800, f1: 100 }); tone({ type: 'square', f0: 140, f1: 40, dur: 0.25, vol: 0.2 }); tone({ type: 'sine', f0: 900, f1: 200, dur: 0.12, vol: 0.1, delay: 0.03 }); },
    overload: () => { noise({ dur: 0.45, vol: 0.5, f0: 5000, f1: 120 }); tone({ type: 'sawtooth', f0: 600, f1: 50, dur: 0.45, vol: 0.18 }); },
    powerup:  () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, f1: f * 1.01, dur: 0.14, vol: 0.18, delay: i * 0.06 })),
    level:    () => tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.08, vol: 0.12 }),
    bump:     () => { tone({ type: 'sine', f0: 120, f1: 70, dur: 0.12, vol: 0.18 }); noise({ dur: 0.05, vol: 0.05, f0: 600, f1: 200 }); },
    teeter:   () => tone({ type: 'triangle', f0: 700, f1: 500, dur: 0.12, vol: 0.08 }),
    join:     () => { tone({ type: 'square', f0: 440, f1: 880, dur: 0.1, vol: 0.12 }); tone({ type: 'square', f0: 660, f1: 1320, dur: 0.1, vol: 0.1, delay: 0.08 }); },
    beep:     () => tone({ type: 'square', f0: 520, f1: 520, dur: 0.12, vol: 0.12 }),
    go:       () => tone({ type: 'square', f0: 1040, f1: 1040, dur: 0.3, vol: 0.14 }),
    win:      () => [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, f1: f, dur: 0.16, vol: 0.12, delay: i * 0.1 })),
    click:    () => { const f = 1800 + Math.random() * 1400; tone({ type: 'square', f0: f, f1: f * 0.7, dur: 0.025, vol: 0.05 }); noise({ dur: 0.02, vol: 0.05, type: 'highpass', f0: 3000 }); },
    thud:     () => { tone({ type: 'sine', f0: 180, f1: 70, dur: 0.12, vol: 0.28 }); noise({ dur: 0.06, vol: 0.08, f0: 700, f1: 150 }); },
    checkpoint: () => [660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', f0: f, f1: f, dur: 0.12, vol: 0.14, delay: i * 0.07 })),
    catchup:  () => tone({ type: 'sine', f0: 400, f1: 1200, dur: 0.3, vol: 0.12 }),
    respawn:  () => tone({ type: 'sine', f0: 300, f1: 900, dur: 0.18, vol: 0.12 }),
    // robots (characters.js) and the water dunk
    clank:    () => { tone({ type: 'square', f0: 900, f1: 300, dur: 0.12, vol: 0.12 }); tone({ type: 'triangle', f0: 1700, f1: 1500, dur: 0.25, vol: 0.08 }); noise({ dur: 0.15, vol: 0.2, type: 'highpass', f0: 2500, f1: 1200 }); },
    clatter:  (k = 1) => { const n = 1 + Math.round(k * 2); for (let i = 0; i < n; i++) { const f = 1500 + Math.random() * 2500; tone({ type: 'square', f0: f, f1: f * 0.8, dur: 0.035, vol: 0.06, delay: i * 0.03 }); } },
    reassemble: () => [600, 800, 1000, 1300].forEach((f, i) => { tone({ type: 'square', f0: f, f1: f * 1.05, dur: 0.04, vol: 0.07, delay: i * 0.06 }); }),
    bigsplash: () => { noise({ dur: 0.6, vol: 0.45, type: 'bandpass', f0: 2200, f1: 250, q: 0.7 }); tone({ type: 'sine', f0: 500, f1: 90, dur: 0.3, vol: 0.18 }); },
    bloop:    () => { tone({ type: 'sine', f0: 300, f1: 700, dur: 0.12, vol: 0.14 }); tone({ type: 'sine', f0: 450, f1: 900, dur: 0.1, vol: 0.1, delay: 0.12 }); },
    popout:   () => { tone({ type: 'sine', f0: 400, f1: 1300, dur: 0.16, vol: 0.16 }); noise({ dur: 0.2, vol: 0.15, type: 'bandpass', f0: 3000, f1: 800 }); },
    sitout:   () => tone({ type: 'triangle', f0: 700, f1: 350, dur: 0.25, vol: 0.1 }),
    // v3: lava chutes & open straights
    sizzle:   () => { noise({ dur: 0.7, vol: 0.32, type: 'highpass', f0: 2500, f1: 5000 }); noise({ dur: 0.35, vol: 0.2, type: 'bandpass', f0: 900, f1: 300 }); tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.3, vol: 0.08 }); },
    launch:   () => { noise({ dur: 0.35, vol: 0.25, type: 'bandpass', f0: 500, f1: 2500, q: 1.2 }); tone({ type: 'triangle', f0: 200, f1: 700, dur: 0.25, vol: 0.12 }); },
    patter:   () => { const f = 500 + Math.random() * 200; tone({ type: 'triangle', f0: f, f1: f * 0.6, dur: 0.03, vol: 0.06 }); },
    rockland: () => { tone({ type: 'sine', f0: 140, f1: 60, dur: 0.12, vol: 0.2 }); noise({ dur: 0.08, vol: 0.1, type: 'lowpass', f0: 900, f1: 200 }); },
    // fireworks (fireworks.js): rising whistle, a boom-pop, and a sparkly crackle
    whistle:  (dur = 1) => { const f = 900 + Math.random() * 500; tone({ type: 'sine', f0: f, f1: f * 2.1, dur, vol: 0.035, attack: 0.05 }); noise({ dur, vol: 0.02, type: 'bandpass', f0: 2500, f1: 5000, q: 6 }); },
    pop:      (big = 1) => { noise({ dur: 0.35 + 0.25 * big, vol: 0.22 * big, f0: 1600, f1: 90 }); tone({ type: 'sine', f0: 120, f1: 40, dur: 0.3, vol: 0.25 * big }); tone({ type: 'square', f0: 1400, f1: 300, dur: 0.05, vol: 0.05 }); },
    crackle:  () => { for (let i = 0; i < 9; i++) noise({ dur: 0.025, vol: 0.06, type: 'highpass', f0: 3000 + Math.random() * 3000, delay: 0.35 + Math.random() * 0.5 }); }
  };

  return {
    unlock() {
      if (!ensure()) return;
      if (!silentDone) {   // iOS: start a silent buffer inside the first gesture to fully unlock Web Audio
        silentDone = true;
        try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); } catch (e) { /* optional */ }
      }
    },
    play(name, a, b) { if (!muted && SOUNDS[name]) try { SOUNDS[name](a, b); } catch (e) { /* audio is optional */ } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : CONFIG.audio.volume;
      return muted;
    },
    get muted() { return muted; },

    /** Rising charge hum. amount 0..1 (full charge), overload 0..1 (warning phase). */
    hum(i, amount, overload) {
      if (muted || !ensure()) return;
      let h = hums[i];
      if (!h) {
        const o1 = ac.createOscillator(), o2 = ac.createOscillator();
        const f = ac.createBiquadFilter(), g = ac.createGain();
        o1.type = 'sawtooth'; o2.type = 'square';
        f.type = 'lowpass'; f.Q.value = 6;
        g.gain.value = 0;
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
        o1.start(); o2.start();
        h = hums[i] = { o1, o2, f, g };
      }
      const t = ac.currentTime;
      const base = (i === 0 ? 90 : 120) + amount * 260 + overload * 180;
      const wob = overload > 0 ? Math.sin(t * 60) * 25 * overload : 0;
      h.o1.frequency.setTargetAtTime(base + wob, t, 0.02);
      h.o2.frequency.setTargetAtTime(base * 1.505, t, 0.02);
      h.f.frequency.setTargetAtTime(400 + amount * 2200 + overload * 2000, t, 0.03);
      h.g.gain.setTargetAtTime(0.05 + amount * 0.06 + overload * 0.05, t, 0.02);
    },
    stopHum(i) {
      const h = hums[i];
      if (!h || !ac) return;
      h.g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
      const hh = h; hums[i] = null;
      setTimeout(() => { try { hh.o1.stop(); hh.o2.stop(); } catch (e) {} }, 200);
    }
  };
})();
