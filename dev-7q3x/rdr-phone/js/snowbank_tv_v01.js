/* TV v0.7.10: a real little snow-pile on the Snowbank tile, a soft "slip slip slip"
   slush loop instead of the intense stuck-in-the-ditch hum, and snow splash / slosh
   bursts when a pawn is poofed in, fails to get out, or pops free. */
(function (w) {
  'use strict';
  var flakes = [], slush = null, hookedDraw = false, hookedGame = false;

  function liveAudio() {
    var S = w.RDRSfx || w.SFX; if (!S) return null;
    try { if (S.live) return S.live(); } catch (e) {}
    try { if (S.ctx) return S.ctx; } catch (e2) {}
    return null;
  }
  function startLoop() {
    if (slush) return;
    var AC = null;
    try { AC = liveAudio() || new (w.AudioContext || w.webkitAudioContext)(); } catch (e) { return; }
    if (AC.state === 'suspended' && AC.resume) try { AC.resume(); } catch (e2) {}
    var noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    var src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 720; bp.Q.value = 0.7;
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    var g = AC.createGain(); g.gain.value = 0.0001;
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(AC.destination);
    src.start();
    var tickT = AC.currentTime + 0.2;
    function schedule() {
      if (!slush) return;
      /* soft footstep / slush ticks: "slip slip slip" */
      for (var k = 0; k < 3; k++) {
        var t0 = tickT + k * 0.28;
        var o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(190 + k * 18, t0);
        o.frequency.exponentialRampToValueAtTime(90, t0 + 0.09);
        var ng = AC.createGain(); ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.exponentialRampToValueAtTime(0.035, t0 + 0.012);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
        var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        o.connect(f); f.connect(ng); ng.connect(AC.destination);
        o.start(t0); o.stop(t0 + 0.12);
      }
      tickT += 0.92;
      slush.timer = setTimeout(schedule, 900);
    }
    slush = { src: src, gain: g, ac: AC, timer: 0 };
    g.gain.linearRampToValueAtTime(0.045, AC.currentTime + 0.4);
    schedule();
  }
  function stopLoop() {
    if (!slush) return;
    try { slush.gain.gain.linearRampToValueAtTime(0.0001, slush.ac.currentTime + 0.3); } catch (e) {}
    var L = slush; slush = null;
    clearTimeout(L.timer);
    setTimeout(function () { try { L.src.stop(); } catch (e2) {} }, 400);
  }
  function anyoneSnow(g) {
    return !!(g && g.players && g.players.some(function (p) { return p.snow && !p.bankrupt; }));
  }

  function burst(rnd, x, y, n, power) {
    n = n || 18; power = power || 1;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random() * 1.4) * power;
      flakes.push({
        x: x, y: y, vx: Math.cos(a) * sp * 18, vy: Math.sin(a) * sp * 12 - 20 * power,
        life: 1, sz: 2 + Math.random() * 3.5 * power, rot: Math.random() * 6
      });
    }
  }
  function stepFlakes(dt) {
    var out = [];
    flakes.forEach(function (f) {
      f.vy += 48 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.98; f.life -= dt / (0.55 + 0.25);
      if (f.life > 0) out.push(f);
    });
    flakes = out;
  }
  function drawFlakes(c) {
    flakes.forEach(function (f) {
      c.save(); c.globalAlpha = Math.max(0, f.life);
      c.fillStyle = '#fff'; c.beginPath();
      c.ellipse(f.x, f.y, f.sz, f.sz * 0.7, f.rot, 0, 7); c.fill();
      c.restore();
    });
  }

  function drawPile(c, w, st) {
    /* A little snowbank mound in the inner square, labels tucked onto the snow. */
    var ix = st, iy = 0, iw = w - st, ih = w - st;
    c.fillStyle = '#d7e8f8'; c.fillRect(ix, iy, iw, ih);
    function mound(cx, cy, rx, ry, col) {
      c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy, rx, ry, -0.15, 0, 7); c.fill();
    }
    mound(ix + iw * 0.52, iy + ih * 0.72, iw * 0.46, ih * 0.28, '#ffffff');
    mound(ix + iw * 0.32, iy + ih * 0.68, iw * 0.28, ih * 0.18, '#f4fbff');
    mound(ix + iw * 0.72, iy + ih * 0.66, iw * 0.26, ih * 0.16, '#eef7ff');
    mound(ix + iw * 0.5, iy + ih * 0.58, iw * 0.22, ih * 0.12, '#ffffff');
    /* soft sparkle dots */
    c.fillStyle = 'rgba(180,210,255,0.7)';
    [[0.3, 0.62], [0.58, 0.55], [0.74, 0.7], [0.42, 0.78], [0.62, 0.8]].forEach(function (p) {
      c.beginPath(); c.arc(ix + iw * p[0], iy + ih * p[1], iw * 0.018, 0, 7); c.fill();
    });
    c.fillStyle = '#103a6a';
    var fs = Math.max(10, Math.round(w * 0.075));
    c.font = '800 ' + fs + 'px Fredoka, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SNOWBANK', ix + iw / 2, iy + ih * 0.16, iw * 0.92);
  }

  function hookCorner() {
    var rnd = w.RDR && RDR.render;
    if (!rnd || rnd._tv0710Snow || typeof rnd.drawCorner !== 'function') return !!rnd;
    rnd._tv0710Snow = true;
    var orig = rnd.drawCorner.bind(rnd);
    rnd.drawCorner = function (c, i, r, flat) {
      var ret = orig(c, i, r, flat);
      if (i === 10 && c) {
        var w = r.w, st = w * 0.27;
        try { drawPile(c, w, st); } catch (e) {}
      }
      return ret;
    };
    try { if (typeof rnd.drawStatic === 'function') rnd.drawStatic(); } catch (e2) {}
    return true;
  }

  function hookGame() {
    var g = w.RDR && RDR.game;
    if (!g || hookedGame) return !!g;
    hookedGame = true;
    if (typeof g.on === 'function') {
      g.on(function (type, d) {
        var rnd = w.RDR && RDR.render, p = d && g.byId && g.byId(d.pid);
        var pos = null;
        if (rnd && p) {
          try {
            var W = w.RDRWalkers, v = W && W.visOf && W.visOf(p);
            if (v) pos = { x: v.x, y: v.y };
            else if (rnd.vis && rnd.vis[p.id]) pos = rnd.vis[p.id];
          } catch (e) {}
        }
        if (type === 'whiteout' && pos) burst(rnd, pos.x, pos.y, 28, 1.15);
        if (type === 'stuck' && pos) burst(rnd, pos.x, pos.y, 14, 0.7);
        if (type === 'free' && pos) burst(rnd, pos.x, pos.y, 36, 1.6);
      });
    }
    return true;
  }

  function hookWalkers() {
    var W = w.RDRWalkers; if (!W || W._tv0710Snow || typeof W.draw !== 'function') return !!W;
    W._tv0710Snow = true;
    var orig = W.draw.bind(W);
    W.draw = function (rnd, now) {
      var g = w.RDR && RDR.game;
      if (g && W.visOf) {
        g.players.forEach(function (p) {
          if (!p.snow) return;
          var v = W.visOf(p); if (!v) return;
          /* poofed / sunk into the pile */
          v.lift = (v.lift || 0) * 0.5 - (W.heightOf ? W.heightOf(rnd) * 0.18 : 10);
        });
      }
      var ret = orig(rnd, now);
      return ret;
    };
    return true;
  }

  function hookFrame() {
    if (hookedDraw) return;
    /* snow particles are drawn from the existing boot overlay if we hook requestAnimationFrame ourselves */
    hookedDraw = true;
    var last = performance.now();
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var g = w.RDR && RDR.game, rnd = w.RDR && RDR.render;
      if (g && g.phase === 'play' && anyoneSnow(g) && !g.paused) startLoop();
      else stopLoop();
      stepFlakes(dt);
      if (rnd && rnd.ctx && flakes.length) {
        try { drawFlakes(rnd.ctx); } catch (e) {}
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* Also draw flakes inside the board clip by wrapping RDRFxTune-less overlay:
     hook RDR render.frame if present. */
  function hookRender() {
    var rnd = w.RDR && RDR.render;
    if (!rnd || rnd._tv0710SnowFx || typeof rnd.frame !== 'function') return !!rnd;
    rnd._tv0710SnowFx = true;
    var orig = rnd.frame.bind(rnd);
    rnd.frame = function (now, dt, opts) {
      var ret = orig(now, dt, opts);
      if (flakes.length && this.ctx) {
        try { drawFlakes(this.ctx); } catch (e) {}
      }
      return ret;
    };
    return true;
  }

  
  function hookSfx() {
    var S = w.RDRSfx || w.SFX;
    if (!S || S._tv0710Snow || typeof S.play !== 'function') return !!S;
    S._tv0710Snow = true;
    var orig = S.play.bind(S);
    S.play = function (name) {
      if (name === 'whiteout') {
        /* softer landing splash instead of the intense ditch hum */
        try {
          var AC = liveAudio();
          if (AC) {
            var t0 = AC.currentTime;
            for (var i = 0; i < 3; i++) {
              var o = AC.createOscillator(); o.type = 'sine';
              o.frequency.setValueAtTime(240 - i * 40, t0 + i * 0.06);
              o.frequency.exponentialRampToValueAtTime(80, t0 + i * 0.06 + 0.18);
              var g = AC.createGain(); g.gain.setValueAtTime(0.0001, t0 + i * 0.06);
              g.gain.exponentialRampToValueAtTime(0.05, t0 + i * 0.06 + 0.02);
              g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.06 + 0.2);
              o.connect(g); g.connect(AC.destination);
              o.start(t0 + i * 0.06); o.stop(t0 + i * 0.06 + 0.22);
            }
          }
        } catch (e) {}
        return;
      }
      return orig(name);
    };
    return true;
  }

  function boot() {
    try { hookCorner(); hookGame(); hookWalkers(); hookFrame(); hookRender(); hookSfx(); }
    catch (e) { if (w.console) console.warn('snowbank boot', e); }
  }
  w.RDRSnowbank = { burst: burst, startLoop: startLoop, stopLoop: stopLoop, drawPile: drawPile };
  function loop() { boot(); setTimeout(loop, 400); }
  loop();
})(window);
