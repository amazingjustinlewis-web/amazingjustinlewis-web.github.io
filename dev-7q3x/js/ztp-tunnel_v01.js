/* ztp-tunnel_v01.js
   Zero to Phi digital tunnel. Gold-on-black, original art only.
   ZTPTunnel.enter(targetUrl|callback|opts, opts)
     Eager, accelerating rush/roll: the field comes at and around the camera
     (ease-in, slight roll), then the destination rezzes in from the gold grid.
   ZTPTunnel.exit(opts)
     Firm hard snap: the screen breaks, the tunnel yanks back, pure black,
     then the gold threads of the logo draw themselves last.
   ZTPTunnel.qrBurst(opts)
     The QR tumbles down to a point, then gold threads explode outward.
   ZTPTunnel.skip()  jumps to the end of the current move.
   ~1.5–2.5 s, skippable on tap. prefers-reduced-motion (or ?still=1 / opts.reducedMotion)
   is a simple fade. ?tunnel=0 skips the effect. */
(function (root) {
  'use strict';
  var PHI = (1 + Math.sqrt(5)) / 2;
  var GOLD = [226, 184, 74], PALE = [251, 231, 161], DEEP = [192, 138, 34];
  var mode = null, raf = 0, start = 0, dur = 0, cfg = {}, roll = 0, scroll = 0;
  var cv, ctx, snap = null, bits = null, dots = null, spokes = 16, done = false;
  var reduce = false, onSkip = null;

  function qoff(n) { try { return new RegExp('[?&]' + n + '=0').test(location.search); } catch (e) { return false; } }
  function prefersReduce(opts) {
    if (opts && opts.reducedMotion) return true;
    try {
      if (new URLSearchParams(location.search).get('still') === '1') return true;
      return !!(root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeIn(t) { t = clamp(t, 0, 1); return 0.5 * t + 0.5 * t * t * t; } // eager: already moving, then a steep lunge
  function easeInCubic(t) { t = clamp(t, 0, 1); return t * t * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function hardOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 5); } // firm snap

  function ensure() {
    if (cv && cv.parentNode) return;
    cv = document.createElement('canvas');
    cv.id = 'ztp-tunnel';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;z-index:80;pointer-events:none;background:transparent';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d', { alpha: true });
    size();
  }
  function size() {
    if (!cv) return;
    var d = Math.min(root.devicePixelRatio || 1, 1.5), w = innerWidth, h = innerHeight;
    cv.width = Math.max(1, Math.floor(w * d));
    cv.height = Math.max(1, Math.floor(h * d));
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function origin() {
    var o = cfg.origin;
    if (typeof o === 'function') o = o();
    if (o && o.x != null) return o;
    return { x: innerWidth / 2, y: innerHeight * 0.43 };
  }
  function grab() {
    var src = cfg.snapshot;
    if (typeof src === 'function') src = src();
    if (src && src.tagName === 'CANVAS' && src.width) {
      try {
        var s = document.createElement('canvas');
        s.width = src.width; s.height = src.height;
        s.getContext('2d').drawImage(src, 0, 0);
        return s;
      } catch (e) {}
    }
    return null;
  }

  function seedDots(n) {
    var i, a, z, arr = new Array(n);
    for (i = 0; i < n; i++) {
      a = Math.random() * Math.PI * 2;
      z = 0.08 + Math.random() * 0.92;
      arr[i] = { a: a, z: z, s: 1.2 + Math.random() * 2.4, w: (Math.random() < 0.2 ? 2 : 1) };
    }
    return arr;
  }

  // Logarithmic spiral, same family as the front-page thread (r = a·φ^(2θ/π)).
  function spiralPts(turns, n) {
    var th = turns * 2 * Math.PI, a = 1 / Math.pow(PHI, 2 * th / Math.PI), i, t, q, r, out = [];
    for (i = 0; i <= n; i++) { t = i / n; q = t * th; r = a * Math.pow(PHI, 2 * q / Math.PI); out.push([q, r, t]); }
    return out;
  }
  var SP = spiralPts(4.25, 280);

  function live() { return !!(cv && cv.style.pointerEvents === 'auto'); }
  function armSkip() {
    cv.style.pointerEvents = 'auto';
    onSkip = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      skip();
    };
    cv.addEventListener('pointerdown', onSkip, { capture: true });
    cv.addEventListener('click', onSkip, { capture: true });
  }
  function disarm() {
    if (cv) {
      cv.style.pointerEvents = 'none';
      if (onSkip) {
        cv.removeEventListener('pointerdown', onSkip, { capture: true });
        cv.removeEventListener('click', onSkip, { capture: true });
      }
    }
    onSkip = null;
  }

  function finish(fn) {
    cancelAnimationFrame(raf); raf = 0;
    mode = null; done = true; disarm();
    if (cv) { ctx && ctx.clearRect(0, 0, innerWidth, innerHeight); cv.style.opacity = '0'; }
    if (typeof fn === 'function') try { fn(); } catch (e) {}
    if (cfg && typeof cfg.onDone === 'function') try { cfg.onDone(); } catch (e2) {}
  }

  function fadeTo(drawEnd, ms, then) {
    ensure(); size();
    cv.style.opacity = '1';
    var t0 = performance.now(), d = ms || 420;
    function tick(now) {
      var u = clamp((now - t0) / d, 0, 1);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = '#000';
      ctx.globalAlpha = drawEnd ? u : (1 - u);
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = 1;
      if (u < 1) raf = requestAnimationFrame(tick);
      else { if (drawEnd && then) then(); else finish(then); }
    }
    raf = requestAnimationFrame(tick);
  }

  // —— enter: accelerating rush / roll that comes at the viewer ——
  function paintEnter(u, raw) {
    var W = innerWidth, H = innerHeight, o = origin(), rush = easeIn(u);
    var cx = o.x, cy = o.y;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Camera: brief hold, then a hard accelerating scale into the hollow, with a slight roll.
    // Whole mark rushes at the camera first, then a steep lunge through the hollow.
    var sc = 1 + 2.4 * rush + 30 * Math.pow(rush, 2.45);
    roll = rush * 0.42; // ~24°
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    if (snap) {
      // The still field breaks into a gold grid as we go through it.
      var brk = clamp((rush - 0.08) / 0.35, 0, 1);
      if (brk <= 0) {
        ctx.drawImage(snap, 0, 0, W, H);
      } else {
        var cell = Math.max(2, Math.round(3 + brk * 18));
        var sw = Math.max(8, Math.floor(W / cell)), sh = Math.max(8, Math.floor(H / cell));
        if (!bits) { bits = document.createElement('canvas'); }
        bits.width = sw; bits.height = sh;
        var bx = bits.getContext('2d');
        bx.imageSmoothingEnabled = false;
        bx.drawImage(snap, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1 - brk * 0.85;
        ctx.drawImage(bits, 0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1;
        // gold scanline grid over the breaking field
        var i, y;
        ctx.strokeStyle = rgba(GOLD, 0.15 + 0.45 * brk);
        ctx.lineWidth = 1;
        for (i = 0; i < sh; i++) {
          y = (i + 0.5) * (H / sh);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        ctx.strokeStyle = rgba(PALE, 0.08 + 0.18 * brk);
        for (i = 0; i < sw; i += 2) {
          var x = (i + 0.5) * (W / sw);
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Tunnel takes over as the rush peaks: rings and motes stream past, rolled around the camera.
    var tun = clamp((rush - 0.04) / 0.38, 0, 1);
    if (tun > 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(roll);
      ctx.globalAlpha = tun;
      paintTunnel(ctx, W, H, rush, 1); // 1 = coming at the camera
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Destination rezzes in from the grid near the end.
    var rez = clamp((raw - 0.62) / 0.32, 0, 1);
    if (rez > 0 && cfg.reveal) reveal(cfg.reveal, rez);
    // a gold scan wipe as it lands
    if (rez > 0 && rez < 1) {
      var wipe = easeOut(rez), H2 = H;
      ctx.fillStyle = rgba(GOLD, 0.18 * (1 - wipe));
      var yh = wipe * H2;
      ctx.fillRect(0, yh, W, Math.max(2, 10 * (1 - wipe)));
    }
    // fade the overlay off as the destination holds
    if (raw > 0.68) cv.style.opacity = String(1 - clamp((raw - 0.68) / 0.26, 0, 1));
    else cv.style.opacity = '1';
  }

  function paintTunnel(c, W, H, rush, dir) {
    // dir +1 = rushing toward / over the viewer; -1 = yanking back
    var maxR = Math.hypot(W, H) * 0.72, i, n = 22, z, r, a, p, sz, k;
    var spd = (dir > 0) ? (0.15 + 3.6 * rush * rush) : (0.8 + 2.2 * (1 - rush));
    scroll += spd * 0.016;
    // concentric scan rings (perspective)
    c.strokeStyle = rgba(GOLD, 0.55);
    c.lineWidth = 1.2;
    for (i = 0; i < n; i++) {
      z = (i / n + scroll * 0.35) % 1;
      if (dir < 0) z = 1 - z;
      r = 6 + Math.pow(z, 1.35) * maxR;
      a = (dir > 0 ? z : (1 - z)) * (0.15 + 0.7 * Math.min(1, rush + 0.2));
      c.strokeStyle = rgba(z < 0.35 ? PALE : GOLD, a);
      c.lineWidth = z < 0.25 ? 1 : (z > 0.8 ? 2.2 : 1.3);
      c.beginPath();
      c.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);
      c.stroke();
      // short tick marks on the ring — a glowing pixel grid, not a smooth pipe
      if (z > 0.15) {
        var ticks = 24, t;
        c.strokeStyle = rgba(PALE, a * 0.7);
        c.beginPath();
        for (t = 0; t < ticks; t++) {
          k = t / ticks * Math.PI * 2;
          c.moveTo(Math.cos(k) * r * 1.05, Math.sin(k) * r * 0.78);
          c.lineTo(Math.cos(k) * r * 1.12, Math.sin(k) * r * 0.84);
        }
        c.stroke();
      }
    }
    // radial scanlines
    c.strokeStyle = rgba(GOLD, 0.22 + 0.2 * rush);
    c.lineWidth = 1;
    c.beginPath();
    for (i = 0; i < spokes; i++) {
      k = (i / spokes) * Math.PI * 2 + roll * 0.25;
      c.moveTo(Math.cos(k) * 8, Math.sin(k) * 6);
      c.lineTo(Math.cos(k) * maxR, Math.sin(k) * maxR * 0.74);
    }
    c.stroke();
    // pixels / motes streaming past
    if (!dots) dots = seedDots(280);
    for (i = 0; i < dots.length; i++) {
      p = dots[i];
      p.z += dir * (0.012 + 0.11 * rush) * (0.6 + p.s * 0.3);
      if (p.z > 1) p.z -= 1;
      if (p.z < 0) p.z += 1;
      z = dir > 0 ? p.z : (1 - p.z);
      r = 8 + Math.pow(Math.max(0.001, z), 1.4) * maxR;
      sz = (0.6 + 2.8 * z) * p.w;
      a = (dir > 0 ? z : p.z) * 0.85;
      c.fillStyle = rgba(z > 0.7 ? PALE : GOLD, a);
      c.fillRect(Math.cos(p.a) * r * 1.05 - sz / 2, Math.sin(p.a) * r * 0.78 - sz / 2, sz, sz);
    }
  }

  function reveal(el, u) {
    if (!el) return;
    el.style.visibility = 'visible';
    el.style.pointerEvents = u > 0.7 ? 'auto' : 'none';
    // rez: opacity plus a slight digital stagger
    var e = easeOut(u);
    el.style.opacity = String(e);
    if (u < 1) el.style.filter = 'contrast(' + (1.4 - 0.4 * e) + ') brightness(' + (0.7 + 0.3 * e) + ')';
    else el.style.filter = '';
  }

  // —— exit: firm hard snap, then threads ——
  function paintExit(raw) {
    var W = innerWidth, H = innerHeight, o = origin(), cx = o.x, cy = o.y;
    ctx.clearRect(0, 0, W, H);
    // 0–0.22 shatter + yank; 0.18–0.38 hard black; 0.34–1 threads
    var snapP = clamp(raw / 0.22, 0, 1);
    var yank = hardOut(clamp((raw - 0.06) / 0.28, 0, 1));
    var black = clamp((raw - 0.22) / 0.14, 0, 1);
    var th = clamp((raw - 0.36) / 0.62, 0, 1);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (black < 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-yank * 0.18);
      var sc = 1 - yank * 0.85;
      if (sc > 0.04) {
        if (snap && snapP < 1) {
          var cell = Math.max(2, Math.round(2 + snapP * 28));
          var sw = Math.max(6, Math.floor(W / cell)), sh = Math.max(6, Math.floor(H / cell));
          if (!bits) bits = document.createElement('canvas');
          bits.width = sw; bits.height = sh;
          var bx = bits.getContext('2d');
          bx.imageSmoothingEnabled = false;
          bx.drawImage(snap, 0, 0, sw, sh);
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = (1 - yank) * (1 - black);
          ctx.scale(sc, sc);
          ctx.drawImage(bits, -W / 2, -H / 2, W, H);
          ctx.imageSmoothingEnabled = true;
        }
        ctx.globalAlpha = (1 - yank * 0.5) * (1 - black);
        paintTunnel(ctx, W, H, 1 - yank, -1);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (th > 0) paintThreads(ctx, W, H, o, th, 1);
    cv.style.opacity = raw > 0.92 ? String(1 - clamp((raw - 0.92) / 0.08, 0, 1)) : '1';
  }

  // dir +1 = threads draw themselves inward-to-out (logo return);
  // dir -1 = explode outward from a point (QR burst).
  function paintThreads(c, W, H, o, p, dir) {
    var i, q, r, X, Y, n = Math.floor(SP.length * (dir > 0 ? p : 1));
    var sc = Math.min(W, H) * 0.28;
    var rot = (dir > 0 ? 0 : (1 - p) * 0.4) + (dir < 0 ? p * 0.6 : 0);
    c.save();
    c.translate(o.x, o.y);
    c.strokeStyle = rgba(GOLD, 0.15 + 0.75 * Math.min(1, p * 1.4));
    c.lineWidth = 1.4;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.shadowColor = rgba(GOLD, 0.45);
    c.shadowBlur = 10;
    // main thread
    c.beginPath();
    for (i = 0; i < n; i++) {
      q = SP[i][0] + rot;
      r = SP[i][1] * sc * (dir > 0 ? 1 : (0.3 + 1.4 * p));
      X = Math.cos(q) * r;
      Y = Math.sin(q) * r / 0.72; // oval, same aspect as the front-page zero
      if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
    }
    c.stroke();
    if (dir < 0) {
      // extra outward filaments
      var f, j, m = 7;
      for (f = 1; f <= m; f++) {
        c.strokeStyle = rgba(f % 2 ? PALE : GOLD, 0.2 + 0.35 * p);
        c.lineWidth = 0.8;
        c.beginPath();
        var off = f * 0.9, cut = Math.floor(n * (0.4 + 0.6 * p));
        for (j = 0; j < cut; j++) {
          q = SP[j][0] + rot + off;
          r = SP[j][1] * sc * (0.4 + 1.6 * p) * (0.55 + 0.08 * f);
          X = Math.cos(q) * r; Y = Math.sin(q) * r / 0.72;
          if (j === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
        }
        c.stroke();
      }
    }
    c.shadowBlur = 0;
    c.restore();
  }

  // —— QR tumble to a point, then threads burst the other way ——
  function paintQR(raw, qr) {
    var W = innerWidth, H = innerHeight, o = origin(), cx = o.x, cy = o.y;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#030304';
    ctx.fillRect(0, 0, W, H);
    if (snap) {
      ctx.drawImage(snap, 0, 0, W, H);
      // cover the still QR so only the tumbling copy is seen
      var qx = (qr && qr.cx) || cx, qy = (qr && qr.cy) || cy, qs = (qr && qr.s) || 80;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(qx, qy, qs * 0.95, qs * 1.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    var tum = hardOut(clamp(raw / 0.42, 0, 1));
    var burst = clamp((raw - 0.38) / 0.58, 0, 1);
    if (qr && tum < 1) {
      ctx.save();
      var dx = qr.cx, dy = qr.cy + tum * Math.min(H, W) * 0.06;
      ctx.translate(dx, dy);
      ctx.rotate(tum * 2.6 + tum * tum * 1.8);
      var sc = 1 - tum;
      ctx.scale(sc, sc * (1 - tum * 0.35));
      ctx.globalAlpha = 1 - tum * 0.2;
      ctx.drawImage(qr.img, -qr.s / 2, -qr.s / 2, qr.s, qr.s);
      ctx.restore();
    }
    if (burst > 0) {
      paintThreads(ctx, W, H, { x: (qr && qr.cx) || cx, y: (qr && qr.cy) || cy }, burst, -1);
    }
    if (raw > 0.88) cv.style.opacity = String(1 - clamp((raw - 0.88) / 0.12, 0, 1));
    else cv.style.opacity = '1';
  }

  function loop(now) {
    if (!mode) return;
    var raw = done ? 1 : clamp((now - start) / dur, 0, 1);
    if (cfg.seek != null) raw = clamp(cfg.seek, 0, 1);
    if (mode === 'enter') paintEnter(raw, raw);
    else if (mode === 'exit') paintExit(raw);
    else if (mode === 'qr') paintQR(raw, cfg.qr);
    if (cfg.seek != null) { /* freeze for a still */ return; }
    if (raw >= 1) {
      if (mode === 'enter') {
        if (cfg.reveal) reveal(cfg.reveal, 1);
        var tgt = cfg.target;
        finish(function () {
          if (typeof tgt === 'function') tgt();
          else if (typeof tgt === 'string' && tgt) location.href = tgt;
        });
        return;
      }
      if (mode === 'exit' || mode === 'qr') { finish(cfg.after); return; }
    }
    raf = requestAnimationFrame(loop);
  }

  function boot(kind, ms, opts) {
    if (qoff('tunnel') && kind !== 'qr') {
      var tgt = opts && (opts.target != null ? opts.target : opts);
      if (kind === 'enter') {
        if (opts && opts.reveal) reveal(opts.reveal, 1);
        if (typeof tgt === 'function') tgt();
        else if (typeof tgt === 'string') location.href = tgt;
      } else if (opts && opts.onDone) opts.onDone();
      return;
    }
    cancelAnimationFrame(raf);
    cfg = opts || {};
    reduce = prefersReduce(cfg);
    mode = kind; done = false; roll = 0; scroll = 0; dots = null; bits = null;
    ensure(); size();
    snap = grab();
    cv.style.opacity = '1';
    if (reduce) {
      if (kind === 'enter') {
        fadeTo(true, 380, function () {
          if (cfg.reveal) reveal(cfg.reveal, 1);
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          cv.style.opacity = '0';
          finish(function () {
            var tgt = cfg.target;
            if (typeof tgt === 'function') tgt();
            else if (typeof tgt === 'string' && tgt) location.href = tgt;
          });
        });
        return;
      }
      fadeTo(true, 320, function () {
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        cv.style.opacity = '0';
        finish(cfg.after || cfg.onDone);
      });
      return;
    }
    dur = ms;
    start = performance.now();
    if (cfg.seek == null) armSkip();
    else cv.style.pointerEvents = 'none';
    raf = requestAnimationFrame(loop);
  }

  function enter(target, opts) {
    opts = opts || {};
    if (typeof target === 'string' || typeof target === 'function') opts.target = target;
    else if (target && typeof target === 'object') {
      opts = Object.assign({}, target, opts);
      if (target.url && !opts.target) opts.target = target.url;
    }
    boot('enter', opts.duration || 1600, opts);
  }
  function exit(opts) {
    opts = opts || {};
    opts.after = opts.onDone || opts.after;
    boot('exit', opts.duration || 2000, opts);
  }
  function qrBurst(opts) {
    opts = opts || {};
    boot('qr', opts.duration || 2000, opts);
  }
  function skip() {
    if (!mode || cfg.seek != null) return;
    start = performance.now() - dur;
    done = false;
  }
  function seek(kind, t, opts) {
    opts = opts || {};
    opts.seek = clamp(t, 0, 1);
    var ms = kind === 'exit' ? 2000 : 1800;
    if (kind === 'qr') ms = 2000;
    boot(kind, ms, opts);
    // paint once at seek
    start = performance.now() - opts.seek * ms;
    loop(performance.now());
  }

  addEventListener('resize', function () { if (cv) size(); });

  root.ZTPTunnel = {
    enter: enter,
    exit: exit,
    qrBurst: qrBurst,
    skip: skip,
    seek: seek,
    busy: function () { return !!mode; },
    VERSION: 'v01'
  };
})(window);
