/* LASER RANGE - TV canvas renderer. Everything static (sky, fence, ground, cover objects, target cut-outs)
   is painted once into offscreen canvases; each frame only blits those and draws a few lines and circles.
   No shadowBlur, no per-frame gradients: made for a Chromecast. */
(function (root) {
  'use strict';
  var C = root.LR_CONFIG, Game = root.LRGame, AR = Game.AR;
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function R(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.g = game;
    this.low = false; this.scale = 1; this.fx = { beams: [], rings: [], floats: [], booms: [], parts: [], smoke: [] }; this.shake = 0;
    this.sprites = {}; this.coverSprites = {};
  }
  var P = R.prototype;
  P.layout = function (W, H, scale) {
    this.scale = scale; this.W = W; this.H = H;
    var cw = Math.round(W * scale), ch = Math.round(H * scale);
    this.cv.width = cw; this.cv.height = ch; this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    var bw = Math.min(cw, ch / AR), bh = bw * AR;
    this.box = { x: Math.round((cw - bw) / 2), y: Math.round((ch - bh) / 2), w: bw, h: bh };
    this.sprites = {}; this.coverSprites = {};
    this.paintBackdrop();
  };
  P.X = function (x) { return this.box.x + x * this.box.w; };
  P.Y = function (y) { return this.box.y + y * this.box.h; };
  P.L = function (w) { return w * this.box.w; };          // a length in screen widths -> pixels
  // screen-pixel (CSS) position of a point, for DOM overlays
  P.css = function (x, y) { return { x: this.X(x) / this.scale, y: this.Y(y) / this.scale }; };

  // ------------------------------------------------------------------ static backdrop
  P.paintBackdrop = function () {
    var b = this.box, c = this.bg = mk(this.cv.width, this.cv.height), x = c.getContext('2d'), self = this;
    var X = function (v) { return b.x + v * b.w; }, Y = function (v) { return b.y + v * b.h; };
    x.fillStyle = '#0d0a18'; x.fillRect(0, 0, c.width, c.height);
    // dusk sky
    var g = x.createLinearGradient(0, Y(0), 0, Y(0.4)); g.addColorStop(0, '#1d1650'); g.addColorStop(0.55, '#7a3a78'); g.addColorStop(1, '#ff9a52');
    x.fillStyle = g; x.fillRect(b.x, Y(0), b.w, b.h * 0.4);
    x.fillStyle = 'rgba(255,255,255,0.7)'; for (var i = 0; i < 40; i++) { var sx = (i * 137.5 % 100) / 100, sy = (i * 61.8 % 100) / 100 * 0.18; x.fillRect(X(sx), Y(sy), 2, 2); }
    x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(X(0.68), Y(0.36), b.w * 0.05, 0, Math.PI * 2); x.fill();
    // mesas
    x.fillStyle = '#5b2c55'; x.beginPath(); x.moveTo(X(0), Y(0.4));
    [[0, .3], [.08, .3], [.11, .25], [.22, .25], [.25, .32], [.4, .33], [.44, .27], [.52, .27], [.55, .34], [.75, .34], [.8, .22], [.88, .22], [.91, .3], [1, .31], [1, .4]].forEach(function (p) { x.lineTo(X(p[0]), Y(p[1])); });
    x.fill();
    x.fillStyle = '#7b3a5c'; x.beginPath(); x.moveTo(X(0), Y(0.4)); [[0, .36], [.15, .35], [.3, .37], [.6, .36], [.85, .37], [1, .355], [1, .4]].forEach(function (p) { x.lineTo(X(p[0]), Y(p[1])); }); x.fill();
    // back fence (the duck rail runs along its top)
    var fy0 = Y(this.g.railY + 0.012), fy1 = Y(0.5);
    x.fillStyle = '#8a5a34'; x.fillRect(b.x, fy0, b.w, fy1 - fy0);
    var pw = b.w / 28; for (i = 0; i < 28; i++) { x.fillStyle = i % 2 ? '#93613a' : '#7d5130'; x.fillRect(b.x + i * pw, fy0, pw - 2, fy1 - fy0); }
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(b.x, fy0 + (fy1 - fy0) * 0.3, b.w, 3); x.fillRect(b.x, fy0 + (fy1 - fy0) * 0.75, b.w, 3);
    // sign
    var sw = b.w * 0.2, sh = b.h * 0.07, sx0 = X(0.5) - sw / 2, sy0 = fy0 + (fy1 - fy0) * 0.22;
    x.fillStyle = '#231a33'; rr(x, sx0, sy0, sw, sh, sh * 0.25); x.fill(); x.lineWidth = Math.max(2, b.h * 0.004); x.strokeStyle = '#ff4fd8'; x.stroke();
    x.font = '700 ' + Math.round(sh * 0.56) + 'px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ff9ff0'; x.fillText('LASER RANGE', X(0.5), sy0 + sh * 0.53); x.fillStyle = '#ffffff'; x.fillText('LASER RANGE', X(0.5) - 1, sy0 + sh * 0.53 - 1);
    // rail
    x.fillStyle = '#c9ccd6'; x.fillRect(b.x, Y(this.g.railY), b.w, Math.max(3, b.h * 0.008)); x.fillStyle = '#7f8494'; x.fillRect(b.x, Y(this.g.railY) + Math.max(3, b.h * 0.008), b.w, 2);
    // ground bands (one per row)
    var rows = this.g.rows, top = 0.5, cols = ['#d9a25c', '#cf9550', '#c4874a'];
    rows.forEach(function (rw, ri) {
      x.fillStyle = cols[ri]; x.fillRect(b.x, Y(top), b.w, Y(ri === rows.length - 1 ? 1 : rw.y) - Y(top) + 1);
      x.fillStyle = 'rgba(80,40,10,0.25)'; x.fillRect(b.x, Y(rw.y) - 1, b.w, Math.max(2, b.h * 0.004));
      top = rw.y;
    });
    x.fillStyle = 'rgba(120,70,30,0.35)'; for (i = 0; i < 60; i++) { var gx = (i * 71.3 % 100) / 100, gy = 0.52 + (i * 37.1 % 100) / 100 * 0.46; x.fillRect(X(gx), Y(gy), b.w * 0.006, 2); }
    // seat markers along the bottom (where each player's laser comes from)
    for (i = 0; i < C.maxPlayers; i++) { x.fillStyle = hexA(C.colors[i].color, 0.5); x.beginPath(); x.arc(X(this.seatX(i)), Y(1.0), b.w * 0.012, Math.PI, 0); x.fill(); }
  };
  P.seatX = function (s) { return 0.2 + 0.2 * s; };

  // ------------------------------------------------------------------ sprites
  P.coverSprite = function (c) {
    var key = c.id + ':' + (c.kind === 'barrel' ? c.hp : 0), s = this.coverSprites[key]; if (s) return s;
    var w = this.L(c.w), h = c.h * this.box.h, cv = mk(w + 4, h + 4), x = cv.getContext('2d'); x.translate(2, 2);
    var lw = Math.max(1.5, w * 0.03);
    if (c.kind === 'crate') {
      x.fillStyle = '#b07a3e'; x.fillRect(0, 0, w, h); x.fillStyle = '#c58b48'; for (var i = 0; i < 4; i++) x.fillRect(w * 0.06, h * (0.06 + i * 0.23), w * 0.88, h * 0.18);
      x.strokeStyle = '#6e4521'; x.lineWidth = lw * 2.2; x.strokeRect(lw, lw, w - 2 * lw, h - 2 * lw);
      x.beginPath(); x.moveTo(lw * 2, lw * 2); x.lineTo(w - lw * 2, h - lw * 2); x.moveTo(w - lw * 2, lw * 2); x.lineTo(lw * 2, h - lw * 2); x.stroke();
      x.fillStyle = '#3b2412'; x.font = '700 ' + Math.round(h * 0.16) + 'px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = 0.35; x.fillText('ACME', w / 2, h / 2); x.globalAlpha = 1;
    } else if (c.kind === 'wall') {
      x.fillStyle = '#a8483a'; x.fillRect(0, 0, w, h);
      var bh = h / 4, bw = w / 5; x.strokeStyle = '#e8d6c0'; x.lineWidth = Math.max(1, h * 0.02);
      for (var r = 0; r < 4; r++) { x.beginPath(); x.moveTo(0, r * bh); x.lineTo(w, r * bh); x.stroke(); for (var k = 0; k <= 5; k++) { var bx = k * bw + (r % 2 ? bw / 2 : 0); if (bx > 0 && bx < w) { x.beginPath(); x.moveTo(bx, r * bh); x.lineTo(bx, (r + 1) * bh); x.stroke(); } } }
      x.fillStyle = '#7a8088'; x.fillRect(-1, -h * 0.03, w + 2, h * 0.1);
    } else {                                           // barrel
      x.fillStyle = '#d6332c'; rr(x, 0, 0, w, h, w * 0.14); x.fill();
      x.fillStyle = '#ef5a46'; x.fillRect(w * 0.15, h * 0.04, w * 0.14, h * 0.92);
      x.fillStyle = '#5c2020'; x.fillRect(0, h * 0.18, w, h * 0.05); x.fillRect(0, h * 0.77, w, h * 0.05);
      x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(w / 2, h * 0.34); x.lineTo(w * 0.78, h * 0.66); x.lineTo(w * 0.22, h * 0.66); x.closePath(); x.fill();
      x.fillStyle = '#1a1a1a'; x.font = '900 ' + Math.round(h * 0.17) + 'px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', w / 2, h * 0.55);
      if (c.hp < C.barrel.hp) {                        // dents and cracks
        x.strokeStyle = '#2a0c0c'; x.lineWidth = Math.max(1.5, w * 0.04);
        x.beginPath(); x.moveTo(w * 0.7, h * 0.08); x.lineTo(w * 0.58, h * 0.22); x.lineTo(w * 0.72, h * 0.3); if (c.hp <= 1) { x.moveTo(w * 0.2, h * 0.85); x.lineTo(w * 0.38, h * 0.72); x.lineTo(w * 0.3, h * 0.6); x.lineTo(w * 0.45, h * 0.5); } x.stroke();
        if (c.hp <= 1) { x.fillStyle = 'rgba(255,170,40,0.85)'; x.beginPath(); x.arc(w * 0.62, h * 0.24, w * 0.08, 0, Math.PI * 2); x.fill(); }
      }
    }
    return (this.coverSprites[key] = cv);
  };
  P.targetSprite = function (type, wN, hN) {
    var w = Math.round(this.L(wN)), h = Math.round(hN * this.box.h), key = type + w + 'x' + h, s = this.sprites[key]; if (s) return s;
    var cv = mk(w, h), x = cv.getContext('2d'), cx = w / 2, lw = Math.max(1.5, w * 0.05);
    x.lineJoin = 'round';
    function stick(fromY) { x.fillStyle = '#6e4521'; x.fillRect(cx - w * 0.06, fromY, w * 0.12, h - fromY); }
    function eyes(ey, r) { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - r * 1.3, ey, r, 0, 7); x.arc(cx + r * 1.3, ey, r, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(cx - r * 1.1, ey + r * 0.2, r * 0.5, 0, 7); x.arc(cx + r * 1.5, ey + r * 0.2, r * 0.5, 0, 7); x.fill(); }
    if (type === 'bullseye' || type === 'gold') {
      var R0 = w * 0.47; stick(R0 * 1.6);
      var ring = type === 'gold' ? ['#fff3b0', '#ffc21a', '#fff3b0', '#e09a00'] : ['#ffffff', '#e8312f', '#ffffff', '#e8312f'];
      for (var i = 0; i < 4; i++) { x.fillStyle = ring[i]; x.beginPath(); x.arc(cx, R0 + 1, R0 * (1 - i * 0.24), 0, 7); x.fill(); }
      x.strokeStyle = '#2a1a10'; x.lineWidth = lw; x.beginPath(); x.arc(cx, R0 + 1, R0 - lw / 2, 0, 7); x.stroke();
      if (type === 'gold') { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - R0 * 0.45, R0 * 0.55, R0 * 0.14, 0, 7); x.fill(); }
      else eyes(R0 * 0.85, R0 * 0.16);
    } else if (type === 'bandit') {
      stick(h * 0.78);
      x.fillStyle = '#2f3b8f'; x.beginPath(); x.moveTo(cx - w * 0.42, h * 0.8); x.lineTo(cx - w * 0.32, h * 0.5); x.lineTo(cx + w * 0.32, h * 0.5); x.lineTo(cx + w * 0.42, h * 0.8); x.closePath(); x.fill();
      x.fillStyle = '#f1b98a'; x.beginPath(); x.arc(cx, h * 0.38, w * 0.3, 0, 7); x.fill();
      x.fillStyle = '#3a2416'; x.fillRect(cx - w * 0.48, h * 0.17, w * 0.96, h * 0.05); x.beginPath(); x.moveTo(cx - w * 0.26, h * 0.18); x.lineTo(cx - w * 0.2, h * 0.02); x.lineTo(cx + w * 0.2, h * 0.02); x.lineTo(cx + w * 0.26, h * 0.18); x.fill();
      x.fillStyle = '#111'; x.fillRect(cx - w * 0.3, h * 0.31, w * 0.6, h * 0.07);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - w * 0.12, h * 0.345, w * 0.05, 0, 7); x.arc(cx + w * 0.12, h * 0.345, w * 0.05, 0, 7); x.fill();
      x.fillStyle = '#3a2416'; x.beginPath(); x.ellipse ? x.ellipse(cx, h * 0.46, w * 0.16, h * 0.022, 0, 0, 7) : x.rect(cx - w * 0.16, h * 0.44, w * 0.32, h * 0.04); x.fill();
      x.strokeStyle = '#1a1020'; x.lineWidth = lw * 0.8; x.beginPath(); x.arc(cx, h * 0.38, w * 0.3, 0, 7); x.stroke();
    } else if (type === 'buddy') {                    // friendly cardboard granny: don't shoot!
      stick(h * 0.8);
      x.fillStyle = '#ff8fc0'; x.beginPath(); x.moveTo(cx - w * 0.44, h * 0.82); x.lineTo(cx - w * 0.3, h * 0.5); x.lineTo(cx + w * 0.3, h * 0.5); x.lineTo(cx + w * 0.44, h * 0.82); x.closePath(); x.fill();
      x.fillStyle = '#c9c9d4'; x.beginPath(); x.arc(cx, h * 0.12, w * 0.17, 0, 7); x.fill();
      x.fillStyle = '#f6c9a2'; x.beginPath(); x.arc(cx, h * 0.33, w * 0.28, 0, 7); x.fill();
      x.fillStyle = '#c9c9d4'; x.beginPath(); x.arc(cx, h * 0.25, w * 0.27, Math.PI, 0); x.fill();
      x.strokeStyle = '#333'; x.lineWidth = Math.max(1, lw * 0.6); x.beginPath(); x.arc(cx - w * 0.11, h * 0.34, w * 0.08, 0, 7); x.arc(cx + w * 0.11, h * 0.34, w * 0.08, 0, 7); x.stroke();
      x.beginPath(); x.arc(cx, h * 0.4, w * 0.1, 0.2, Math.PI - 0.2); x.stroke();
      x.fillStyle = '#ff3d6e'; x.beginPath(); var hy = h * 0.62, hr = w * 0.1; x.arc(cx - hr * 0.55, hy, hr * 0.6, Math.PI, 0); x.arc(cx + hr * 0.55, hy, hr * 0.6, Math.PI, 0); x.lineTo(cx, hy + hr * 1.2); x.closePath(); x.fill();
    } else if (type === 'duck') {
      x.fillStyle = '#ffd23f'; x.beginPath(); x.ellipse ? x.ellipse(w * 0.45, h * 0.62, w * 0.4, h * 0.3, 0, 0, 7) : x.arc(w * 0.45, h * 0.62, h * 0.3, 0, 7); x.fill();
      x.beginPath(); x.arc(w * 0.72, h * 0.3, h * 0.24, 0, 7); x.fill();
      x.fillStyle = '#ff8a1f'; x.beginPath(); x.moveTo(w * 0.86, h * 0.3); x.lineTo(w * 1.0, h * 0.36); x.lineTo(w * 0.86, h * 0.42); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.arc(w * 0.76, h * 0.25, h * 0.05, 0, 7); x.fill();
      x.fillStyle = '#e8b520'; x.beginPath(); x.ellipse ? x.ellipse(w * 0.38, h * 0.6, w * 0.18, h * 0.12, -0.3, 0, 7) : x.arc(w * 0.38, h * 0.6, h * 0.12, 0, 7); x.fill();
      x.fillStyle = '#6e4521'; x.fillRect(w * 0.4, h * 0.88, w * 0.1, h * 0.12);
    }
    return (this.sprites[key] = cv);
  };

  // ------------------------------------------------------------------ effects from game events
  P.event = function (type, d, p) {
    var now = this.g.now, F = this.fx, maxP = this.low ? C.lowfx.maxParticles / 2 : C.lowfx.maxParticles * 2;
    var self = this;
    function parts(x, y, n, cols, spd, life, grav, size) {
      for (var i = 0; i < n && F.parts.length < maxP; i++) { var a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8); F.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s / AR - spd * 0.6, t: now, life: life * (0.6 + Math.random() * 0.6), c: cols[i % cols.length], g: grav, s: size }); }
    }
    switch (type) {
      case 'shot':
        F.beams.push({ seat: d.seat, x: d.x, y: d.y, t: now, c: d.color, w: d.charged ? 2 + d.power * 2 : 1 });
        F.rings.push({ x: d.x, y: d.y, r: d.r, t: now, life: d.charged ? 380 : 220, c: d.color, grow: d.charged ? 1.4 : 2.2 });
        break;
      case 'kill':
        F.floats.push({ x: d.x, y: d.y, t: now, text: d.pts ? (d.pts > 0 ? '+' + d.pts : String(d.pts)) : (d.type === 'buddy' ? 'OOPS!' : 'POP!'), c: d.pts < 0 ? '#ff6b6b' : d.color });
        parts(d.x, d.y, this.low ? 5 : 10, d.type === 'gold' ? ['#ffd23f', '#fff3b0'] : d.type === 'buddy' ? ['#ff8fc0', '#fff'] : ['#ffffff', '#e8312f', d.color], 0.35, 600, 1.4, 0.006);
        break;
      case 'thunk': parts(d.x, d.y, 4, ['#6e4521', '#c58b48'], 0.2, 400, 1.6, 0.005); break;
      case 'clang': parts(d.x, d.y, 5, ['#ffd23f', '#ffffff'], 0.3, 300, 1, 0.004); break;
      case 'boom':
        F.booms.push({ x: d.x, y: d.y, r: d.r, t: now });
        parts(d.x, d.y, this.low ? 10 : 26, ['#ff7a00', '#ffd23f', '#d6332c', '#5c2020', '#222'], 0.75, 900, 1.8, 0.009);
        if (!this.low) for (var i = 0; i < 6; i++) F.smoke.push({ x: d.x + (Math.random() - 0.5) * d.r, y: d.y + (Math.random() - 0.5) * d.r, t: now + i * 40, r: d.r * (0.3 + Math.random() * 0.3) });
        if (d.pts) F.floats.push({ x: d.x, y: d.y - 0.05, t: now, text: 'BOOM +' + d.pts, c: d.color, big: true });
        if (!this.low) this.shake = Math.max(this.shake, 1);
        break;
      case 'powerup': parts(d.x, d.y, 16, ['#ff4fd8', '#3fd0ff', '#ffd23f', '#fff'], 0.5, 800, 0.8, 0.007); F.floats.push({ x: d.x, y: d.y, t: now, text: 'CHARGE CANNON!', c: d.color, big: true }); break;
      case 'streak': F.floats.push({ x: d.x, y: d.y - 0.07, t: now, text: d.n + ' STREAK +' + d.pts, c: '#ffd23f' }); break;
      case 'calPoint': F.rings.push({ x: d.x, y: d.y, r: 0.03, t: now, life: 500, c: '#ffffff', grow: 2.5 }); break;
    }
  };

  // ------------------------------------------------------------------ frame
  P.frame = function (now, opts) {
    var ctx = this.ctx, g = this.g, b = this.box, self = this, F = this.fx, i;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.shake > 0.01 && !this.low) { var a = this.shake * b.h * 0.012; ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a); this.shake *= 0.86; } else this.shake = 0;
    ctx.drawImage(this.bg, 0, 0);
    // duck rail (behind everything)
    g.targets.forEach(function (t) { if (t.rail) self.drawTarget(t, now, null); });
    // rows back to front: targets, then their cover
    g.rows.forEach(function (row) {
      g.targets.forEach(function (t) { if (!t.rail && t.row === row.idx) self.drawTarget(t, now, row); });
      row.covers.forEach(function (c) { self.drawCover(c, now, row); });
    });
    // balloon
    var bl = g.balloon;
    if (bl) {
      var bx = this.X(bl.x), by = this.Y(bl.y), br = this.L(bl.r);
      if (!bl.popped) {
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by + br); ctx.lineTo(bx + Math.sin(now / 300) * br * 0.3, by + br * 3.2); ctx.stroke();
        ctx.fillStyle = bl.color; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.25, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1020'; ctx.font = '900 ' + Math.round(br * 1.1) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u26A1', bx, by + br * 0.05);
        ctx.font = '700 ' + Math.round(b.h * 0.022) + 'px Fredoka, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('POWER-UP', bx, by - br * 1.5);
      }
    }
    // swipe blasts
    g.shots.forEach(function (s) {
      var sx = self.X(s.x), sy = self.Y(s.y), r = self.L(C.swipe.radius);
      ctx.strokeStyle = hexA(s.color, 0.45); ctx.lineWidth = r * 1.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - self.L(s.vx) * 0.12, sy - s.vy * b.h * 0.12); ctx.stroke();
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, 7); ctx.fill();
    });
    // smoke, explosions, particles
    for (i = F.smoke.length - 1; i >= 0; i--) { var sm = F.smoke[i], k = (now - sm.t) / 1100; if (k < 0) continue; if (k > 1) { F.smoke.splice(i, 1); continue; } ctx.fillStyle = 'rgba(70,60,70,' + (0.45 * (1 - k)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(this.X(sm.x), this.Y(sm.y - k * 0.06), this.L(sm.r * (0.6 + k)), 0, 7); ctx.fill(); }
    for (i = F.booms.length - 1; i >= 0; i--) {
      var bo = F.booms[i], kb = (now - bo.t) / 420; if (kb > 1) { F.booms.splice(i, 1); continue; }
      var rr0 = this.L(bo.r) * (0.3 + 0.9 * Math.sqrt(kb));
      ctx.fillStyle = 'rgba(255,122,0,' + (0.8 * (1 - kb)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(this.X(bo.x), this.Y(bo.y), rr0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,140,' + (0.9 * (1 - kb)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(this.X(bo.x), this.Y(bo.y), rr0 * 0.55, 0, 7); ctx.fill();
    }
    var dtp = opts && opts.dt ? opts.dt / 1000 : 0.016;
    for (i = F.parts.length - 1; i >= 0; i--) {
      var pt = F.parts[i], kp = (now - pt.t) / pt.life; if (kp > 1) { F.parts.splice(i, 1); continue; }
      pt.x += pt.vx * dtp; pt.y += pt.vy * dtp; pt.vy += pt.g * dtp;
      ctx.fillStyle = pt.c; var ps = this.L(pt.s) * (1 - kp * 0.5); ctx.fillRect(this.X(pt.x) - ps / 2, this.Y(pt.y) - ps / 2, ps, ps);
    }
    // beams and rings
    for (i = F.beams.length - 1; i >= 0; i--) {
      var bm = F.beams[i], kk = (now - bm.t) / 160; if (kk > 1) { F.beams.splice(i, 1); continue; }
      var x0 = this.X(this.seatX(bm.seat)), y0 = this.Y(1.0), x1 = this.X(bm.x), y1 = this.Y(bm.y);
      ctx.lineCap = 'round';
      if (!this.low) { ctx.strokeStyle = hexA(bm.c, 0.35 * (1 - kk)); ctx.lineWidth = b.h * 0.014 * bm.w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      ctx.strokeStyle = bm.c; ctx.lineWidth = b.h * 0.005 * bm.w * (1 - kk); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, b.h * 0.002 * bm.w * (1 - kk)); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    for (i = F.rings.length - 1; i >= 0; i--) {
      var rg = F.rings[i], kr = (now - rg.t) / rg.life; if (kr > 1) { F.rings.splice(i, 1); continue; }
      ctx.strokeStyle = hexA(rg.c, 1 - kr); ctx.lineWidth = Math.max(2, b.h * 0.006 * (1 - kr)); ctx.beginPath(); ctx.arc(this.X(rg.x), this.Y(rg.y), this.L(rg.r) * (1 + kr * (rg.grow - 1)), 0, 7); ctx.stroke();
    }
    // floating score text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = F.floats.length - 1; i >= 0; i--) {
      var fl = F.floats[i], kf = (now - fl.t) / 1000; if (kf > 1) { F.floats.splice(i, 1); continue; }
      var fs = Math.round(b.h * (fl.big ? 0.05 : 0.036));
      ctx.font = '700 ' + fs + 'px Fredoka, sans-serif'; ctx.globalAlpha = kf < 0.7 ? 1 : (1 - kf) / 0.3;
      var fx = this.X(fl.x), fy = this.Y(fl.y - kf * 0.07);
      ctx.lineWidth = Math.max(3, fs * 0.16); ctx.strokeStyle = '#1a1020'; ctx.strokeText(fl.text, fx, fy); ctx.fillStyle = fl.c; ctx.fillText(fl.text, fx, fy);
      ctx.globalAlpha = 1;
    }
    // calibration targets (the gallery dims while you calibrate in the lobby), then cursors on top of everything
    var calib = g.players.some(function (p) { return !!p.cal; });
    if (calib && g.phase === 'lobby') { ctx.fillStyle = 'rgba(8,5,16,0.45)'; ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
    g.players.forEach(function (p) { if (p.cal) self.drawCal(p, now); });
    g.players.forEach(function (p) { if (p.hasAim && !p.cal && p.connected !== false) self.drawCursor(p, now); });
  };

  P.drawCover = function (c, now, row) {
    var ctx = this.ctx, Rr = this.g.coverRect(c);
    if (c.dead) {          // scorch mark where a barrel was
      ctx.fillStyle = 'rgba(30,20,20,0.35)'; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(this.X(c.x), this.Y(row.y) - 2, this.L(c.w) * 0.8, c.h * this.box.h * 0.08, 0, 0, 7) : ctx.rect(this.X(c.x - c.w * 0.8), this.Y(row.y) - 5, this.L(c.w * 1.6), 6); ctx.fill();
      return;
    }
    var sp = this.coverSprite(c), x = this.X(Rr.x0) - 2, y = this.Y(Rr.y0) - 2, drop = 0;
    var age = now - c.bornAt; if (age < 400 && age >= 0) drop = (1 - age / 400) * (1 - age / 400) * -this.box.h * 0.25;    // respawned barrels drop in
    var jig = now - c.hitAt < 140 && !this.low ? (Math.random() - 0.5) * 4 : 0;
    ctx.drawImage(sp, Math.round(x + jig), Math.round(y + drop));
  };
  P.drawTarget = function (t, now, row) {
    var ctx = this.ctx, sp = this.targetSprite(t.type, t.w, t.h), w = sp.width, h = sp.height;
    var x = this.X(t.x) - w / 2, y = this.Y(t.top);
    var visH = row ? Math.min(h, this.Y(row.y) - y) : h;             // hidden below the row's ground line
    if (visH <= 1) return;
    if (t.state === 'dead') {                                          // flips backwards and drops
      var k = Math.min(1, (now - t.deadAt) / 300), sh = Math.max(1, visH * (1 - k));
      ctx.globalAlpha = 1 - k * 0.6; ctx.drawImage(sp, 0, 0, w, visH, x, y + (visH - sh), w, sh); ctx.globalAlpha = 1; return;
    }
    if (!this.low && t.state === 'up' && !t.rail) {
      var a = Math.sin(now / 260 + t.wob) * 0.04;
      ctx.save(); ctx.translate(x + w / 2, y + visH); ctx.rotate(a); ctx.drawImage(sp, 0, 0, w, visH, -w / 2, -visH, w, visH); ctx.restore(); return;
    }
    if (t.rail) { ctx.save(); ctx.translate(x + w / 2, y); if (t.dir < 0) ctx.scale(-1, 1); ctx.drawImage(sp, -w / 2, 0); ctx.restore(); return; }
    ctx.drawImage(sp, 0, 0, w, visH, x, y, w, visH);
  };
  P.drawCursor = function (p, now) {
    var ctx = this.ctx, b = this.box, x = this.X(Game.clamp(p.cx, 0, 1)), y = this.Y(Game.clamp(p.cy, 0, 1)), r = b.h * 0.032, k;
    var off = p.cx < 0 || p.cx > 1 || p.cy < 0 || p.cy > 1;
    var W = C.weapons[p.weapon] || C.weapons.blaster;
    if (p.weapon === 'charger') r = this.L(W.radius) * 1.0 + b.h * 0.012;
    ctx.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? p.color : 'rgba(10,6,20,0.85)'; ctx.lineWidth = pass ? Math.max(2, b.h * 0.0045) : Math.max(4, b.h * 0.009);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 1.5, y); ctx.lineTo(x - r * 0.45, y); ctx.moveTo(x + r * 0.45, y); ctx.lineTo(x + r * 1.5, y); ctx.moveTo(x, y - r * 1.5); ctx.lineTo(x, y - r * 0.45); ctx.moveTo(x, y + r * 0.45); ctx.lineTo(x, y + r * 1.5); ctx.stroke();
    }
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, Math.max(2, b.h * 0.004), 0, 7); ctx.fill();
    if (p.charge) {
      k = this.g.chargeLevel(p);
      var cr = this.L(W.radius + (W.maxRadius - W.radius) * k);
      ctx.strokeStyle = hexA(p.color, 0.9); ctx.lineWidth = Math.max(3, b.h * 0.007); ctx.beginPath(); ctx.arc(x, y, cr, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hexA(p.color, 0.12 + 0.18 * k); ctx.beginPath(); ctx.arc(x, y, cr, 0, 7); ctx.fill();
    }
    ctx.font = '700 ' + Math.round(b.h * 0.022) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var label = p.name + (off ? ' \u2194' : ''), ly = y + r * 1.65;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,6,20,0.85)'; ctx.strokeText(label, x, ly); ctx.fillStyle = p.color; ctx.fillText(label, x, ly);
  };
  P.drawCal = function (p, now) {
    var ctx = this.ctx, b = this.box, self = this, pts = p.cal.kind === 'recenter' ? [{ x: 0.5, y: 0.5, label: 'CENTRE' }] : C.aim.calPoints;
    var cur = p.cal.kind === 'recenter' ? 0 : p.cal.step, base = b.h * (0.045 + p.seat * 0.014);
    pts.forEach(function (pt, i) {
      var x = self.X(pt.x), y = self.Y(pt.y), active = i === cur, done = i < cur;
      var r = active ? base * (1.25 + 0.1 * Math.sin(now / 140)) : base * 0.8;
      if (active) {                                    // pulsing halo so it is easy to find from the couch
        var k = (now % 900) / 900;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = Math.max(3, b.h * 0.006);
        ctx.beginPath(); ctx.arc(x, y, r * (1.2 + k * 1.2), 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = done ? 0.6 : active ? 1 : 0.85;
      ctx.fillStyle = 'rgba(10,6,20,0.75)'; ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, 7); ctx.fill();
      for (var k2 = 0; k2 < 4; k2++) { ctx.fillStyle = k2 % 2 ? '#ffffff' : p.color; ctx.beginPath(); ctx.arc(x, y, r * (1 - k2 * 0.24), 0, 7); ctx.fill(); }
      if (done) { ctx.strokeStyle = '#1a1020'; ctx.lineWidth = Math.max(4, r * 0.22); ctx.beginPath(); ctx.moveTo(x - r * 0.45, y); ctx.lineTo(x - r * 0.1, y + r * 0.38); ctx.lineTo(x + r * 0.5, y - r * 0.38); ctx.stroke(); }
      if (!active && !done) { ctx.fillStyle = '#1a1020'; ctx.font = '700 ' + Math.round(r * 0.7) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 1); }
      ctx.globalAlpha = 1;
      if (active) {
        var fs = Math.round(b.h * 0.034), above = pt.y > 0.5, ly = above ? y - r * 2.6 - p.seat * fs * 1.2 : y + r * 2.6 + p.seat * fs * 1.2;
        var tx = Math.min(Math.max(x, self.X(0.14)), self.X(0.86));
        ctx.font = '700 ' + fs + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var txt = p.name + ': point here + tap';
        ctx.lineWidth = Math.max(5, fs * 0.22); ctx.strokeStyle = 'rgba(10,6,20,0.95)'; ctx.strokeText(txt, tx, ly); ctx.fillStyle = p.color; ctx.fillText(txt, tx, ly);
      }
    });
  };
  root.LRRender = R;
})(typeof window !== 'undefined' ? window : globalThis);
