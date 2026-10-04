/* ZOMBIE TILES - TV board renderer (canvas). Retro top-down pixel tiles + clean vector tokens. */
(function (root) {
  'use strict';
  var C = root.ZT_CONFIG, TL = root.ZT_TILES, S = C.tileSize, PX = 24;   // PX = pixel-art resolution per square
  var COL = {
    street: '#8b9099', street2: '#959aa3', street3: '#7f848d', curb: '#6c717a',
    grass: '#86bf7f', grass2: '#74ad6e', grass3: '#9bcf8f', flower: '#f1f0a8',
    water: '#5ba8e0', water2: '#8bc9f2', water3: '#4a93cc',
    floor: '#cdb995', floor2: '#b7a27c', wall: '#5b4d48', wall2: '#7b6a61', wall3: '#453a36',
    door: '#a5642f', bush: '#3f8a4d', bush2: '#5aa865', bush3: '#2d6a3a',
    conc: '#a3a8b0', conc2: '#757a83', car: '#6c7482', car2: '#8a93a1', carWin: '#2c3440',
    fence: '#2f3338', fence2: '#6f757d', pad: '#4a525c', hazard: '#f2c230', bg: '#14121b'
  };
  function hash(a, b, c) { var h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ------------------------------------------------------------ tile bitmaps
  var cache = {};
  function tileCanvas(tile) {
    var k = tile.tpl + ':' + tile.rot + ':' + tile.id;
    if (cache[k]) return cache[k];
    var cv = document.createElement('canvas'); cv.width = cv.height = S * PX;
    var ctx = cv.getContext('2d'), g = tile.grid;
    function at(x, y) { return (y < 0 || x < 0 || y >= S || x >= S) ? null : g[y][x]; }
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) drawSquare(ctx, g[y][x], x, y, at, tile.id);
    if (tile.helipad) {                          // big H and circle on the pad
      var c = S * PX / 2;
      ctx.strokeStyle = COL.hazard; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c, c, PX * 1.7, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff'; var u = PX * 0.32;
      ctx.fillRect(c - 3 * u, c - 3.4 * u, 1.6 * u, 6.8 * u); ctx.fillRect(c + 1.4 * u, c - 3.4 * u, 1.6 * u, 6.8 * u); ctx.fillRect(c - 3 * u, c - 0.7 * u, 6 * u, 1.4 * u);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S * PX - 2, S * PX - 2);
    cache[k] = cv;
    return cv;
  }
  function px(ctx, col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function drawSquare(ctx, ch, x, y, at, tid) {
    var X = x * PX, Y = y * PX, r = function (i) { return hash(x + tid * 31, y, i); };
    var under = { b: ',', w: '.', v: '.', '%': '.' }[ch] || ch;
    if (ch === 'b') under = ',';
    // base
    if (under === '.' || under === 'D' && false) {
      px(ctx, COL.street, X, Y, PX, PX);
      for (var i = 0; i < 6; i++) px(ctx, r(i) > 0.5 ? COL.street2 : COL.street3, X + Math.floor(r(i + 9) * 22), Y + Math.floor(r(i + 20) * 22), 2, 2);
      // curbs where the street meets something else
      var n = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      n.forEach(function (d, k) {
        var o = at(x + d[0], y + d[1]);
        if (o && o !== '.' && o !== '%' && o !== 'v' && o !== 'w') {
          if (k === 0) px(ctx, COL.curb, X, Y, PX, 2); if (k === 2) px(ctx, COL.curb, X, Y + PX - 2, PX, 2);
          if (k === 1) px(ctx, COL.curb, X + PX - 2, Y, 2, PX); if (k === 3) px(ctx, COL.curb, X, Y, 2, PX);
        }
      });
    } else if (under === ',') {
      px(ctx, COL.grass, X, Y, PX, PX);
      for (var j = 0; j < 5; j++) { var gx = X + Math.floor(r(j) * 20), gy = Y + Math.floor(r(j + 7) * 20); px(ctx, COL.grass2, gx, gy, 2, 3); px(ctx, COL.grass2, gx + 3, gy + 1, 2, 2); }
      if (r(40) > 0.8) px(ctx, COL.flower, X + Math.floor(r(41) * 20), Y + Math.floor(r(42) * 20), 3, 3);
      if (r(43) > 0.5) px(ctx, COL.grass3, X + Math.floor(r(44) * 20), Y + Math.floor(r(45) * 20), 3, 2);
    } else if (under === '~') {
      px(ctx, COL.water, X, Y, PX, PX);
      for (var w = 0; w < 3; w++) px(ctx, COL.water2, X + Math.floor(r(w) * 14) + 2, Y + 4 + w * 7, 7, 2);
      px(ctx, COL.water3, X + Math.floor(r(9) * 16), Y + Math.floor(r(10) * 20), 5, 1);
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d, k) {
        var o = at(x + d[0], y + d[1]);
        if (o && o !== '~') { ctx.fillStyle = 'rgba(255,255,255,0.45)'; if (k === 0) ctx.fillRect(X, Y, PX, 2); if (k === 2) ctx.fillRect(X, Y + PX - 2, PX, 2); if (k === 1) ctx.fillRect(X + PX - 2, Y, 2, PX); if (k === 3) ctx.fillRect(X, Y, 2, PX); }
      });
    } else if (under === '_' || under === 'D') {
      px(ctx, COL.floor, X, Y, PX, PX);
      for (var f = 0; f < 4; f++) px(ctx, COL.floor2, X, Y + f * 6 + 5, PX, 1);
      px(ctx, COL.floor2, X + Math.floor(r(1) * 18) + 2, Y, 1, 6);
      if (under === 'D') {
        // door: brown slab across the wall line, oriented by which neighbours are walls
        var horiz = at(x - 1, y) === '#' || at(x + 1, y) === '#' || at(x - 1, y) === 'D' && at(x - 2, y) === '#' || at(x + 1, y) === 'D' && at(x + 2, y) === '#';
        ctx.fillStyle = COL.door;
        if (horiz) { ctx.fillRect(X, Y + 8, PX, 8); ctx.fillStyle = '#7a4520'; ctx.fillRect(X, Y + 8, PX, 2); }
        else { ctx.fillRect(X + 8, Y, 8, PX); ctx.fillStyle = '#7a4520'; ctx.fillRect(X + 8, Y, 2, PX); }
      }
    } else if (under === '#') {
      px(ctx, COL.wall, X, Y, PX, PX);
      for (var b = 0; b < 4; b++) { px(ctx, COL.wall3, X, Y + b * 6, PX, 1); px(ctx, COL.wall3, X + ((b % 2) ? 6 : 15), Y + b * 6, 1, 6); }
      px(ctx, COL.wall2, X, Y, PX, 2);
    } else if (under === 'X') {
      px(ctx, '#3b4148', X, Y, PX, PX);
      ctx.strokeStyle = COL.fence2; ctx.lineWidth = 1;
      for (var q = -PX; q < PX; q += 6) { ctx.beginPath(); ctx.moveTo(X + q, Y); ctx.lineTo(X + q + PX, Y + PX); ctx.moveTo(X + q + PX, Y); ctx.lineTo(X + q, Y + PX); ctx.stroke(); }
      px(ctx, '#20242a', X, Y, PX, 2); px(ctx, '#20242a', X, Y + PX - 2, PX, 2);
    } else if (under === 'G') {
      for (var s = 0; s < 6; s++) { ctx.fillStyle = s % 2 ? '#1d1d1d' : COL.hazard; ctx.beginPath(); ctx.moveTo(X + s * 8 - 16, Y); ctx.lineTo(X + s * 8 - 8, Y); ctx.lineTo(X + s * 8 + 16, Y + PX); ctx.lineTo(X + s * 8 + 8, Y + PX); ctx.fill(); }
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, PX, PX); ctx.restore();
    } else if (under === 'H') {
      px(ctx, COL.pad, X, Y, PX, PX); px(ctx, '#535c67', X + 2, Y + 2, PX - 4, PX - 4);
    }
    // cover on top
    if (ch === 'b') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X + 13, Y + 17, 10, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = COL.bush3; ctx.beginPath(); ctx.arc(X + 8, Y + 13, 7, 0, 7); ctx.arc(X + 16, Y + 13, 7, 0, 7); ctx.arc(X + 12, Y + 8, 7, 0, 7); ctx.fill();
      ctx.fillStyle = COL.bush; ctx.beginPath(); ctx.arc(X + 8, Y + 12, 5.5, 0, 7); ctx.arc(X + 16, Y + 12, 5.5, 0, 7); ctx.arc(X + 12, Y + 7, 5.5, 0, 7); ctx.fill();
      px(ctx, COL.bush2, X + 9, Y + 5, 3, 2); px(ctx, COL.bush2, X + 5, Y + 10, 2, 2); px(ctx, COL.bush2, X + 15, Y + 9, 3, 2);
    } else if (ch === 'w') {
      px(ctx, 'rgba(0,0,0,0.25)', X + 2, Y + 4, PX - 2, PX - 4);
      px(ctx, COL.conc2, X + 1, Y + 6, PX - 2, PX - 7);
      px(ctx, COL.conc, X + 1, Y + 1, PX - 2, PX - 9);
      px(ctx, '#8c9199', X + 6, Y + 4, 6, 1); px(ctx, '#8c9199', X + 14, Y + 9, 1, 4);
    } else if (ch === 'v') {
      var L = at(x - 1, y) === 'v', R = at(x + 1, y) === 'v', U = at(x, y - 1) === 'v', Dn = at(x, y + 1) === 'v';
      var x0 = X + (L ? 0 : 3), x1 = X + PX - (R ? 0 : 3), y0 = Y + (U ? 0 : 3), y1 = Y + PX - (Dn ? 0 : 3);
      px(ctx, 'rgba(0,0,0,0.3)', x0 + 2, y0 + 3, x1 - x0, y1 - y0);
      px(ctx, COL.car, x0, y0, x1 - x0, y1 - y0);
      px(ctx, COL.car2, x0 + 1, y0 + 1, x1 - x0 - 2, 2);
      var horizCar = L || R;
      if (horizCar) { var wx = L ? X + 2 : X + 8; px(ctx, COL.carWin, wx, y0 + 4, 10, y1 - y0 - 8); }
      else { var wy = U ? Y + 2 : Y + 8; px(ctx, COL.carWin, x0 + 4, wy, x1 - x0 - 8, 10); }
    } else if (ch === '%') {
      ctx.fillStyle = 'rgba(220,245,255,0.9)';
      for (var gl = 0; gl < 5; gl++) {
        var sx = X + 3 + Math.floor(r(gl + 50) * 16), sy = Y + 3 + Math.floor(r(gl + 60) * 16);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy + 1 + r(gl) * 3); ctx.lineTo(sx + 1, sy + 5); ctx.fill();
      }
      px(ctx, 'rgba(150,220,255,0.8)', X + 11, Y + 11, 2, 2);
    }
  }

  // ------------------------------------------------------------ renderer
  function Renderer(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 4, y: 4, s: 40 }; this.disp = {}; this.pops = []; this.shake = 0; this.flash = null; this.bubbles = {};
    this.area = { x: 0, y: 0, w: 100, h: 100 };
  }
  var R = Renderer.prototype;
  R.resize = function (w, h, dpr) { this.dpr = dpr; this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'; this.W = w; this.H = h; };
  R.setArea = function (a) { this.area = a; };
  // speech bubble over a player (AI reactions); shout = charge / scream style
  R.bubble = function (pid, text, color, shout) { if (!text) return; this.bubbles[pid] = { text: text, color: color || '#fff', t: 0, dur: ((C.ai && C.ai.bubbleMs) || 2300) / 1000, shout: !!shout }; };
  // escape cinematic: chopper swoops in, the token hops aboard, lift-off, fly away; fireworks in the player's colour + confetti
  R.cinematic = function (p, x, y) {
    var es = C.escapeShow || {};
    this.cine = { p: p, x: x + 0.5, y: y + 0.5, t: 0, dur: (es.ms || 5200) / 1000, fwAt: (es.fireworks || []).slice(), fw: [], conf: [], confDone: false, dir: Math.random() < 0.5 ? -1 : 1 };
  };
  // v0.4 effects: a rope snare yanking a zombie up, and a dynamite blast
  R.snare = function (x, y, color, removed) { (this.fx = this.fx || []).push({ k: 'snare', x: x, y: y, t: 0, dur: 1.1, removed: removed, color: color }); };
  R.boom = function (x, y, r) {
    var parts = []; for (var i = 0; i < 36; i++) { var a = Math.random() * 7, v = 1.5 + Math.random() * 3.5; parts.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, c: ['#ffd23f', '#ff7a1a', '#ff3b1a', '#6b5a4a'][i % 4], s: 0.08 + Math.random() * 0.1 }); }
    (this.fx = this.fx || []).push({ k: 'boom', x: x, y: y, r: r || 1, t: 0, dur: 1.3, parts: parts });
  };
  R.pop = function (text, x, y, color, big) { this.pops.push({ text: text, x: x, y: y, color: color || '#fff', t: 0, big: !!big }); };
  R.bounds = function (g) {
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    g.tiles.forEach(function (t) { minx = Math.min(minx, t.tx); miny = Math.min(miny, t.ty); maxx = Math.max(maxx, t.tx); maxy = Math.max(maxy, t.ty); });
    if (g.place) g.place.slots.forEach(function (sl) { minx = Math.min(minx, sl.tx); miny = Math.min(miny, sl.ty); maxx = Math.max(maxx, sl.tx); maxy = Math.max(maxy, sl.ty); });
    if (minx > maxx) { minx = miny = 0; maxx = maxy = 0; }
    return { x0: minx * S, y0: miny * S, x1: (maxx + 1) * S, y1: (maxy + 1) * S };
  };
  R.camTarget = function (g) {
    var b = this.bounds(g), a = this.area, pad = 1.2;
    var bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2;
    var s = Math.min(a.w / bw, a.h / bh, a.h / (S * 1.15));
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s: s };
  };
  R.snap = function (g) { var t = this.camTarget(g); this.cam = t; this.disp = {}; this.trails = []; };
  R.toScreen = function (x, y) { var a = this.area, c = this.cam; return [a.x + a.w / 2 + (x - c.x) * c.s, a.y + a.h / 2 + (y - c.y) * c.s]; };

  R.frame = function (g, dt, now) {
    var ctx = this.ctx, dpr = this.dpr || 1, self = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, this.W, this.H);
    if (!g.tiles || !g.tiles.length) return;
    // camera ease
    var tg = this.camTarget(g), k = 1 - Math.pow(0.03, dt);
    this.cam.x += (tg.x - this.cam.x) * k; this.cam.y += (tg.y - this.cam.y) * k; this.cam.s += (tg.s - this.cam.s) * k;
    var sq = this.cam.s;
    ctx.save();
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.5); ctx.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 14 * this.shake); }
    // faint dot grid
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    var o = this.toScreen(0, 0), step = sq * S;
    for (var gx = ((o[0] - this.area.x) % step + step) % step + this.area.x; gx < this.area.x + this.area.w; gx += step)
      for (var gy = ((o[1] - this.area.y) % step + step) % step + this.area.y; gy < this.area.y + this.area.h; gy += step) ctx.fillRect(gx - 2, gy - 2, 4, 4);

    // unexplored slots next to open exits
    var seen = {};
    g.tiles.forEach(function (t) {
      for (var s = 0; s < 4; s++) {
        if (!t.open[s]) continue;
        var v = root.ZTGame.SIDE_VEC[s], nx = t.tx + v[0], ny = t.ty + v[1];
        if (g.tileAt(nx, ny)) continue;
        // little "?" arrows outside the exit
        var mx = t.tx * S + S / 2 + v[0] * (S / 2 + 0.6), my = t.ty * S + S / 2 + v[1] * (S / 2 + 0.6);
        var p = self.toScreen(mx, my), pulse = 0.55 + 0.25 * Math.sin(now / 400 + s);
        ctx.fillStyle = 'rgba(255,214,90,' + pulse + ')'; ctx.font = '700 ' + Math.round(sq * 0.9) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(g.deck && g.deck.length ? '?' : '\u00d7', p[0], p[1]);
        if (!seen[nx + ',' + ny] && g.deck && g.deck.length) {
          seen[nx + ',' + ny] = 1;
          var q = self.toScreen(nx * S, ny * S);
          ctx.setLineDash([sq * 0.4, sq * 0.4]); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
          ctx.strokeRect(q[0] + 4, q[1] + 4, sq * S - 8, sq * S - 8); ctx.setLineDash([]);
        }
      }
    });

    // tiles
    ctx.imageSmoothingEnabled = false;
    g.tiles.forEach(function (t) {
      var p = self.toScreen(t.tx * S, t.ty * S);
      ctx.drawImage(tileCanvas(t), Math.floor(p[0]), Math.floor(p[1]), Math.ceil(sq * S) + 1, Math.ceil(sq * S) + 1);
    });
    ctx.imageSmoothingEnabled = true;

    // gate reveals
    (g.gateSides || []).forEach(function (gs) {
      if (!g.tiles.some(function (t) { return t.id === gs.tileId; })) return;
      gs.squares.forEach(function (sqr) {
        var p = self.toScreen(sqr[0] + 0.5, sqr[1] + 0.5);
        if (!gs.revealed) {
          ctx.fillStyle = 'rgba(20,20,20,0.75)'; ctx.beginPath(); ctx.arc(p[0], p[1], sq * 0.33, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffe28a'; ctx.font = '700 ' + Math.round(sq * 0.5) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', p[0], p[1] + 1);
        } else {
          ctx.fillStyle = gs.yes ? '#29c46a' : '#e0384b'; ctx.fillRect(p[0] - sq * 0.48, p[1] - sq * 0.48, sq * 0.96, sq * 0.96);
          ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(sq * 0.36) + 'px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(gs.yes ? 'YES' : 'NO', p[0], p[1] + 1);
        }
      });
    });

    // pickups
    g.pickups.forEach(function (it) {
      var p = self.toScreen(it.x + 0.5, it.y + 0.5), bob = Math.sin(now / 350 + it.id) * sq * 0.05;
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(p[0], p[1], sq * 0.36, 0, 7); ctx.fill();
      drawItem(ctx, it.kind, p[0], p[1] + bob, sq * 0.62);
    });
    // v0.4: set traps (rope loop + crate) and lit dynamite (with its blast area)
    (g.traps || []).forEach(function (t) {
      var p = self.toScreen(t.x + 0.5, t.y + 0.5);
      ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = Math.max(2, sq * 0.06); ctx.setLineDash([sq * 0.08, sq * 0.05]);
      ctx.beginPath(); ctx.ellipse(p[0], p[1] + sq * 0.12, sq * 0.4, sq * 0.22, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      drawItem(ctx, 'trap', p[0], p[1], sq * 0.5);
      ctx.fillStyle = t.color || '#fff'; ctx.beginPath(); ctx.arc(p[0] + sq * 0.3, p[1] - sq * 0.28, sq * 0.08, 0, 7); ctx.fill();
    });
    (g.bombs || []).forEach(function (b) {
      var r = C.items.dynamite.radius, p0 = self.toScreen(b.x - r, b.y - r), pulse = 0.5 + 0.5 * Math.sin(now / 160);
      ctx.fillStyle = 'rgba(255,120,20,' + (0.08 + 0.1 * pulse) + ')'; ctx.fillRect(p0[0], p0[1], sq * (2 * r + 1), sq * (2 * r + 1));
      ctx.strokeStyle = 'rgba(255,140,30,' + (0.5 + 0.4 * pulse) + ')'; ctx.lineWidth = 3; ctx.setLineDash([sq * 0.2, sq * 0.12]);
      ctx.strokeRect(p0[0] + 2, p0[1] + 2, sq * (2 * r + 1) - 4, sq * (2 * r + 1) - 4); ctx.setLineDash([]);
      var p = self.toScreen(b.x + 0.5, b.y + 0.5); drawItem(ctx, 'dynamite', p[0], p[1], sq * 0.62);
      ctx.fillStyle = Math.random() < 0.5 ? '#fff6a0' : '#ff9a1a'; ctx.beginPath(); ctx.arc(p[0] + sq * 0.2, p[1] - sq * 0.3, sq * (0.05 + 0.05 * Math.random()), 0, 7); ctx.fill();
    });

    drawTrails(this, ctx, now, sq);
    // planned path
    var cur = g.curP && g.curP();
    if (cur && g.plan && g.plan.length && (g.phase === 'plan' || g.phase === 'exec' || g.phase === 'place')) {
      var col = cur.color;
      g.plan.forEach(function (st, i) {
        var p = self.toScreen(st.x, st.y), last = i === g.plan.length - 1;
        ctx.globalAlpha = g.phase === 'plan' ? 0.85 : 0.5;
        if (st.kind === 'explore') {
          ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.strokeRect(p[0] + 3, p[1] + 3, sq - 6, sq - 6); ctx.setLineDash([]);
          ctx.fillStyle = '#ffd65a'; ctx.font = '700 ' + Math.round(sq * 0.55) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; var dv = root.ZTGame.DIRS[st.d]; ctx.fillText('EXPLORE', p[0] + sq / 2 + dv[0] * sq * 1.9, p[1] + sq / 2 + dv[1] * sq * 0.95);
          ctx.fillText('?', p[0] + sq / 2, p[1] + sq / 2);
        } else {
          ctx.fillStyle = hexA(col, 0.45); ctx.fillRect(p[0] + 2, p[1] + 2, sq - 4, sq - 4);
          ctx.strokeStyle = col; ctx.lineWidth = last ? 4 : 2; ctx.strokeRect(p[0] + 2, p[1] + 2, sq - 4, sq - 4);
          ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(sq * 0.38) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(st.kind === 'gate' ? 'GATE' : String(i + 1), p[0] + sq / 2, p[1] + sq / 2);
          if (st.kind === 'step' && g.dangerAt(st.x, st.y)) {
            ctx.fillStyle = '#ff3b4e'; ctx.beginPath(); ctx.moveTo(p[0] + sq - 4, p[1] + 3); ctx.lineTo(p[0] + sq - 4, p[1] + sq * 0.42); ctx.lineTo(p[0] + sq * 0.6, p[1] + 3); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(sq * 0.24) + 'px Fredoka'; ctx.fillText('!', p[0] + sq * 0.86, p[1] + sq * 0.15);
          }
        }
        ctx.globalAlpha = 1;
      });
    }

    // placement ghost
    if (g.phase === 'place' && g.place) {
      var P = g.place;
      P.slots.forEach(function (sl, i) {
        var q = self.toScreen(sl.tx * S, sl.ty * S);
        ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = i === P.idx ? '#ffd65a' : 'rgba(255,214,90,0.35)';
        ctx.strokeRect(q[0] + 3, q[1] + 3, sq * S - 6, sq * S - 6); ctx.setLineDash([]);
      });
      var sl = P.slots[P.idx], q2 = self.toScreen(sl.tx * S, sl.ty * S);
      var ghost = { tpl: P.tpl, rot: P.rot, id: 'ghost', grid: TL.rotate(TL.byId[P.tpl].grid, P.rot), helipad: !!TL.byId[P.tpl].helipad };
      ctx.globalAlpha = 0.72 + 0.18 * Math.sin(now / 250);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tileCanvas(ghost), q2[0], q2[1], sq * S, sq * S);
      ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1;
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffd65a'; ctx.strokeRect(q2[0], q2[1], sq * S, sq * S);
    }

    // entities with smoothed positions
    var ents = [];
    g.players.forEach(function (p) {
      if (p.status === 'alive' || (p.status === 'dead')) ents.push({ k: 'p' + p.id, x: p.x, y: p.y, p: p });
    });
    g.zombies.forEach(function (z) { ents.push({ k: 'z' + z.id, x: z.x, y: z.y, z: z }); });
    var live = {};
    var stepSec = (C.sprites && C.sprites.stepSec) || 0.22;
    ents.forEach(function (e) {       // v0.4: tokens walk square to square (with a facing) instead of sliding
      var d = self.disp[e.k]; if (!d) d = self.disp[e.k] = { x: e.x, y: e.y, fx: e.x, fy: e.y, tx: e.x, ty: e.y, t: 1, dur: stepSec, dir: 0, walk: 0 };
      if (e.x !== d.tx || e.y !== d.ty) {
        var dist = Math.abs(e.x - d.x) + Math.abs(e.y - d.y);
        if (dist > 6) { d.x = d.fx = d.tx = e.x; d.y = d.fy = d.ty = e.y; d.t = 1; }
        else {
          var ddx = e.x - d.x, ddy = e.y - d.y;
          if (e.p && e.p.status === 'alive') dropTrail(self, e.p, d.tx, d.ty, now);   // v0.4.1: blood drops on the square being left
          d.fx = d.x; d.fy = d.y; d.tx = e.x; d.ty = e.y; d.t = 0; d.dur = stepSec * Math.min(2.2, Math.max(1, dist));
          d.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 2 : 1) : (ddy > 0 ? 0 : 3);
        }
      }
      if (d.t < 1) { d.t = Math.min(1, d.t + dt / d.dur); d.x = d.fx + (d.tx - d.fx) * d.t; d.y = d.fy + (d.ty - d.fy) * d.t; d.walk += dt; }
      e.dx = d.x; e.dy = d.y; e.anim = { dir: d.dir, moving: d.t < 1, walkT: d.walk }; live[e.k] = 1;
    });
    for (var dk in this.disp) if (!live[dk]) delete this.disp[dk];
    // share squares nicely
    var bySq = {};
    ents.forEach(function (e) { if (e.p) { var kk = e.x + ',' + e.y; (bySq[kk] = bySq[kk] || []).push(e); } });
    for (var kq in bySq) if (bySq[kq].length > 1) bySq[kq].forEach(function (e, i) { e.ox = (i % 2 ? 0.17 : -0.17); e.oy = (i > 1 ? 0.17 : -0.17) * (bySq[kq].length > 2 ? 1 : 0); e.sc = 0.75; });
    ents.sort(function (a, b) { return a.dy - b.dy; });
    var fightZ = g.fight ? g.fight.zid : null, fightP = g.fight ? g.fight.pid : null;
    ents.forEach(function (e) {
      var p = self.toScreen(e.dx + 0.5 + (e.ox || 0), e.dy + 0.5 + (e.oy || 0));
      if (e.z) drawZombie(ctx, p[0], p[1], sq, e.z, now, e.z.id === fightZ, e.anim);
      else if (e.p.status === 'dead') drawBody(ctx, p[0], p[1], sq, e.p);
      else drawPlayer(ctx, p[0], p[1], sq * (e.sc || 1), e.p, cur === e.p && g.phase !== 'over', now, e.p.id === fightP, e.anim);
    });

    // speech bubbles
    for (var bid in this.bubbles) {
      var bb = this.bubbles[bid]; bb.t += dt;
      if (bb.t > bb.dur) { delete this.bubbles[bid]; continue; }
      var bp = g.byId(+bid); if (!bp) continue;
      var dd = this.disp['p' + bid];
      if (!dd && bp.zid) dd = this.disp['z' + bp.zid];
      var bx = dd ? dd.x : bp.x, by = dd ? dd.y : bp.y;
      drawBubble(ctx, self.toScreen(bx + 0.5, by + 0.5), sq, bb);
    }
    // floating texts
    this.pops = this.pops.filter(function (pp) { return (pp.t += dt) < 1.6; });
    this.pops.forEach(function (pp) {
      var p = self.toScreen(pp.x + 0.5, pp.y + 0.2), a = Math.min(1, 2.2 - pp.t * 1.4);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '700 ' + Math.round(sq * (pp.big ? 0.9 : 0.6)) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(pp.text, p[0], p[1] - pp.t * sq * 0.9);
      ctx.fillStyle = pp.color; ctx.fillText(pp.text, p[0], p[1] - pp.t * sq * 0.9);
      ctx.globalAlpha = 1;
    });
    drawFx(this, ctx, dt, now, sq);
    if (this.cine) drawCinematic(this, ctx, dt, now, sq);
    ctx.restore();
  };

  // v0.4.1 blood trail: small cartoon splats (round blob + a few droplets + a highlight), fading out after C.bloodTrail.fadeMs
  function dropTrail(R, p, x, y, now) {
    var BT = C.bloodTrail; if (!BT || !BT.enabled || p.hearts > BT.hearts || p.hearts <= 0) return;
    var tr = R.trails = R.trails || [], drops = [], n = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) drops.push({ ox: (Math.random() - 0.5) * 0.36, oy: (Math.random() - 0.5) * 0.36, r: 0.025 + Math.random() * 0.035 });
    tr.push({ x: x, y: y, t: now, ox: (Math.random() - 0.5) * 0.3, oy: (Math.random() - 0.5) * 0.3 + 0.12, r: 0.07 + Math.random() * 0.03, rot: Math.random() * 3, drops: drops });
    if (tr.length > (BT.max || 80)) tr.splice(0, tr.length - (BT.max || 80));
  }
  function drawTrails(R, ctx, now, sq) {
    var BT = C.bloodTrail, tr = R.trails; if (!BT || !tr || !tr.length) return;
    var life = BT.fadeMs || 12000, col = BT.color || '#d81e2c';
    R.trails = tr = tr.filter(function (s) { return now - s.t < life; });
    tr.forEach(function (s) {
      var age = (now - s.t) / life, a = age < 0.6 ? 0.9 : 0.9 * (1 - (age - 0.6) / 0.4), grow = Math.min(1, (now - s.t) / 180);
      var p = R.toScreen(s.x + 0.5 + s.ox, s.y + 0.5 + s.oy), r = s.r * sq * (0.6 + 0.4 * grow);
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], r * 1.2, r * 0.85, s.rot, 0, 7); ctx.fill();
      s.drops.forEach(function (d) { ctx.beginPath(); ctx.arc(p[0] + d.ox * sq * grow, p[1] + d.oy * sq * grow, d.r * sq, 0, 7); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(p[0] - r * 0.4, p[1] - r * 0.3, r * 0.28, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawFx(R, ctx, dt, now, sq) {
    if (!R.fx || !R.fx.length) return;
    R.fx = R.fx.filter(function (f) { return (f.t += dt) < f.dur; });
    R.fx.forEach(function (f) {
      var p = R.toScreen(f.x + 0.5, f.y + 0.5), k = f.t / f.dur;
      if (f.k === 'snare') {
        var lift = f.removed ? Math.pow(Math.min(1, k * 1.3), 2) * (p[1] - R.area.y + sq) : 0;
        ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = Math.max(2, sq * 0.06);
        ctx.beginPath(); ctx.moveTo(p[0], R.area.y - 10); ctx.lineTo(p[0], p[1] - lift - sq * 0.3); ctx.stroke();
        if (f.removed) {                     // the zombie dangles upside down and gets yanked out of view
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * 0.6);
          if (!window.ZTSprites || !window.ZTSprites.enabled || !window.ZTSprites.draw(ctx, 'zombie', null, 0, Math.floor(now / 120) % 2 + 2, p[0] + Math.sin(f.t * 12) * sq * 0.08, p[1] - lift, sq * 1.1, true)) drawZombie(ctx, p[0], p[1] - lift, sq, { id: 0, hp: 0 }, now, false);
          ctx.restore();
        }
        if (k < 0.3) { ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k / 0.3) + ')'; ctx.lineWidth = 3; for (var i = 0; i < 6; i++) { var a = i / 6 * 7; ctx.beginPath(); ctx.moveTo(p[0] + Math.cos(a) * sq * 0.3, p[1] + Math.sin(a) * sq * 0.3); ctx.lineTo(p[0] + Math.cos(a) * sq * (0.3 + k * 2), p[1] + Math.sin(a) * sq * (0.3 + k * 2)); ctx.stroke(); } }
      } else if (f.k === 'boom') {
        var rad = (f.r + 0.6) * sq * Math.min(1, k * 3.5);
        var gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], Math.max(1, rad));
        gr.addColorStop(0, 'rgba(255,250,210,' + (1 - k) + ')'); gr.addColorStop(0.45, 'rgba(255,170,40,' + (0.9 * (1 - k)) + ')'); gr.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,160,' + Math.max(0, 0.8 - k * 1.6) + ')'; ctx.lineWidth = sq * 0.12; ctx.beginPath(); ctx.arc(p[0], p[1], (f.r + 0.6) * sq * Math.min(1.4, k * 2.4), 0, 7); ctx.stroke();
        f.parts.forEach(function (q) { var x = p[0] + q.vx * sq * f.t, y = p[1] + (q.vy * f.t + 3 * f.t * f.t) * sq; ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = q.c; ctx.fillRect(x, y, q.s * sq, q.s * sq); });
        ctx.globalAlpha = 1;
      }
    });
  }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  var PARTY = ['#ffd23f', '#ff4fd8', '#3fd0ff', '#9dff6a', '#ffffff', '#ff7a1a'];
  function drawCinematic(R, ctx, dt, now, sq) {
    var c = R.cine; c.t += dt;
    if (c.t > c.dur + 1.2) { R.cine = null; return; }
    var t = c.t, a = R.area, base = R.toScreen(c.x, c.y), u = Math.max(sq * 0.17, 6);   // u = one helicopter "pixel"
    var hoverX = base[0], hoverY = base[1] - Math.max(sq * 1.25, u * 9), hx, hy, tilt = 0;
    var startX = c.dir > 0 ? a.x - u * 30 : a.x + a.w + u * 30, startY = a.y - u * 12;
    var endX = c.dir > 0 ? a.x + a.w + u * 40 : a.x - u * 40, endY = a.y - u * 25;
    if (t < 1.4) { var k = ease(t / 1.4); hx = startX + (hoverX - startX) * k; hy = startY + (hoverY - startY) * k + Math.sin(t * 5) * u * (1 - k); tilt = c.dir * 0.25 * (1 - k); }
    else if (t < 2.6) { hx = hoverX; hy = hoverY + Math.sin(t * 6) * u * 0.6 - (t > 2.1 ? (t - 2.1) * u * 4 : 0); }
    else { var k2 = Math.pow(Math.min(1, (t - 2.6) / 1.8), 1.8); hx = hoverX + (endX - hoverX) * k2; hy = hoverY - u * 2 + (endY - hoverY) * k2; tilt = c.dir * 0.3 * Math.min(1, (t - 2.6) * 2); }
    // token: bounces on the gate square, hops up into the chopper between 1.4 and 2.0 s
    var p = c.p, r = Math.max(sq * 0.38, 15);
    if (t < 1.4) drawPlayer(ctx, base[0], base[1] - Math.abs(Math.sin(t * 9)) * sq * 0.18, sq, p, false, now, false);
    else if (t < 2.0) { var h = (t - 1.4) / 0.6, px = base[0] + (hx - base[0]) * h, py = base[1] + (hy + u * 2 - base[1]) * h - Math.sin(h * Math.PI) * sq * 0.9; ctx.save(); ctx.translate(px, py); ctx.scale(1 - h * 0.5, 1 - h * 0.5); drawPlayer(ctx, 0, 0, sq, p, false, now, false); ctx.restore(); }
    if (t < 4.6) drawChopper(ctx, hx, hy, u, tilt, now, c.dir, t >= 2.0 ? p.color : null);
    // fireworks in the player's colour (plus a few party colours)
    while (c.fwAt.length && t >= c.fwAt[0]) {
      c.fwAt.shift();
      var fx = a.x + a.w * (0.15 + Math.random() * 0.7), fy = a.y + a.h * (0.12 + Math.random() * 0.35), n = 42;
      for (var i = 0; i < n; i++) { var ang = i / n * Math.PI * 2, sp = (0.6 + Math.random() * 0.5) * Math.min(a.w, a.h) * 0.32; c.fw.push({ x: fx, y: fy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1.1 + Math.random() * 0.4, t: 0, col: Math.random() < 0.65 ? p.color : PARTY[i % PARTY.length] }); }
    }
    c.fw = c.fw.filter(function (f) { return (f.t += dt) < f.life; });
    c.fw.forEach(function (f) {
      f.vy += 260 * dt; f.vx *= 0.985; f.vy *= 0.985; f.x += f.vx * dt; f.y += f.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); ctx.fillStyle = f.col; var s = Math.max(5, u * 0.8); ctx.fillRect(f.x - s / 2, f.y - s / 2, s, s);
    });
    // confetti from the top once the token is aboard
    if (!c.confDone && t > 1.9) {
      c.confDone = true;
      for (var j = 0; j < 140; j++) c.conf.push({ x: a.x + Math.random() * a.w, y: a.y - Math.random() * a.h * 0.5, vy: 90 + Math.random() * 120, ph: Math.random() * 6, w: u * (0.6 + Math.random() * 0.6), col: j % 3 === 0 ? p.color : PARTY[j % PARTY.length] });
    }
    var fade = Math.max(0, Math.min(1, (c.dur + 1.2 - t) / 1.0));
    c.conf.forEach(function (q) {
      q.y += q.vy * dt; q.ph += dt * 6; var x = q.x + Math.sin(q.ph) * u * 2;
      ctx.globalAlpha = fade; ctx.fillStyle = q.col; ctx.fillRect(x, q.y, q.w, q.w * (0.4 + 0.6 * Math.abs(Math.sin(q.ph))));
    });
    ctx.globalAlpha = 1;
  }
  // little pixel-art helicopter, built from u-sized blocks; seat shows the escaper's colour once aboard
  function drawChopper(ctx, x, y, u, tilt, now, dir, rider) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(tilt); ctx.scale(dir > 0 ? 1 : -1, 1);
    function b(px, py, w, h, col) { ctx.fillStyle = col; ctx.fillRect(px * u, py * u, w * u, h * u); }
    b(-11, -1, 8, 2, '#2b3a55'); b(-13, -3, 2, 4, '#2b3a55'); b(-13, -3, 1, 1, '#ff3b4e');       // tail boom + fin
    var tr = Math.abs(Math.sin(now / 25)); b(-13.5, -3 - tr * 2, 1, 1 + tr * 4, '#c9d3e6');        // tail rotor
    b(-4, -4, 9, 7, '#ffd23f'); b(-3, -5, 7, 1, '#ffd23f'); b(-4, 1, 9, 1, '#d9a400');               // body
    b(1, -3, 4, 3, '#9ae4ff'); b(2, -3, 1, 1, '#ffffff');                                             // cockpit window
    if (rider) { b(-2, -3, 2, 2, rider); }                                                            // escaper in the side window
    else b(-2, -3, 2, 2, '#4a5a78');
    b(-3, 4, 8, 1, '#2b3a55'); b(-2, 3, 1, 1, '#2b3a55'); b(3, 3, 1, 1, '#2b3a55');                 // skids
    b(0, -6, 1, 1, '#2b3a55');                                                                         // mast
    var rw = 8 + 6 * Math.abs(Math.sin(now / 30)); b(0.5 - rw, -7, rw * 2, 0.8, '#c9d3e6');          // main rotor blur
    ctx.restore();
  }

  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function drawPlayer(ctx, x, y, sq, p, isCur, now, fighting, anim) {
    var r = Math.max(sq * 0.38, 15), SP = window.ZTSprites;
    if (SP && SP.enabled) return drawPlayerSprite(ctx, x, y, sq, p, isCur, now, fighting, anim || { dir: 0, moving: false, walkT: 0 }, r);
    if (isCur) {
      var pr = r * (1.35 + 0.15 * Math.sin(now / 180));
      ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, pr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.beginPath(); var ay = y - r * 2.9 + Math.sin(now / 200) * 4; ctx.moveTo(x - r * 0.4, ay - r * 0.5); ctx.lineTo(x + r * 0.4, ay - r * 0.5); ctx.lineTo(x, ay); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.85, r * 0.95, r * 0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 7); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, 7); ctx.fill();
    if (p.ai) drawFace(ctx, x, y, r, p.ai.persona, now);
    else {
      ctx.fillStyle = '#1a1420'; ctx.font = '700 ' + Math.round(r * 1.1) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.name.charAt(0).toUpperCase(), x, y + 1);
    }
    // weapon badge (visible to everyone)
    if (p.weapon !== 'none') {
      var bx = x + r * 0.95, by = y + r * 0.7;
      ctx.fillStyle = '#1a1420'; ctx.beginPath(); ctx.arc(bx, by, r * 0.62, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      drawItem(ctx, p.weapon, bx, by, r * 1.05);
    }
    // name tag
    var fs = Math.max(15, Math.round(sq * 0.32));
    ctx.font = '700 ' + fs + 'px Fredoka, sans-serif';
    var label = p.name + (p.aiTakeover ? ' (AI)' : '');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(label).width + fs * 0.8, ty = y - r - fs * 0.95;
    ctx.fillStyle = 'rgba(15,12,22,0.85)'; roundRect(ctx, x - tw / 2, ty - fs * 0.62, tw, fs * 1.24, fs * 0.4); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, ty + 1);
    if (fighting) { ctx.strokeStyle = '#ff3b4e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 7); ctx.stroke(); }
  }
  function drawBody(ctx, x, y, sq, p) {
    var r = Math.max(sq * 0.34, 12);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#5a5560'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 1.1, r * 0.6, -0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - r * 0.35, y - r * 0.15); ctx.lineTo(x + r * 0.35, y + r * 0.55); ctx.moveTo(x + r * 0.35, y - r * 0.15); ctx.lineTo(x - r * 0.35, y + r * 0.55); ctx.stroke();
    ctx.globalAlpha = 1;
    var fs = Math.max(11, Math.round(sq * 0.26)); ctx.font = '700 ' + fs + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ccc';
    ctx.fillText(p.name + ' (down)', x, y - r * 1.2);
  }
  function drawZombie(ctx, x, y, sq, z, now, fighting, anim) {
    var r = Math.max(sq * 0.34, 12), wob = Math.sin(now / 300 + z.id * 1.7) * r * 0.08, SP = window.ZTSprites;
    if (SP && SP.enabled && anim) {
      var size = Math.max(sq * 1.08, 32), hang = z.stunned ? sq * 0.32 : 0;
      if (fighting) { ctx.fillStyle = 'rgba(255,40,60,0.35)'; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, 7); ctx.fill(); }
      if (z.owner) { ctx.strokeStyle = z.color || '#cfe'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + r * 0.6, r * 1.05, r * 0.45, 0, 0, 7); ctx.stroke(); }
      if (z.stunned) {                       // caught in a rope snare: dangling upside down
        var sw = Math.sin(now / 260 + z.id) * sq * 0.06;
        ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = Math.max(2, sq * 0.05); ctx.beginPath(); ctx.moveTo(x, y - sq * 1.2); ctx.lineTo(x + sw, y - hang - size * 0.3); ctx.stroke();
        SP.draw(ctx, 'zombie', null, 0, 2 + Math.floor(now / 200) % 4, x + sw, y - hang, size, true);
        ctx.font = '700 ' + Math.round(sq * 0.3) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6a0'; ctx.fillText('\u2605', x + sq * 0.35, y - hang - sq * 0.4 + Math.sin(now / 150) * 3);
      } else SP.draw(ctx, 'zombie', null, anim.dir, SP.frameFor(anim.moving, anim.walkT, now, z.id * 0.53), x, y - size * 0.12, size);
      for (var hi = 0; hi < C.zombie.hp; hi++) { ctx.fillStyle = hi < z.hp ? '#ff4a5a' : 'rgba(0,0,0,0.5)'; ctx.fillRect(x - r * 0.55 + hi * r * 0.6, y + size * 0.38, r * 0.5, r * 0.2); }
      if (z.name) { var zf = Math.max(11, Math.round(sq * 0.27)); ctx.font = '700 ' + zf + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = z.owner ? (z.color || '#cfe') : '#b9c9a0'; ctx.fillText(z.name + (z.owner ? ' (zombie)' : ''), x, y - size * 0.62); }
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.85, r * 0.95, r * 0.4, 0, 0, 7); ctx.fill();
    if (fighting) { ctx.fillStyle = 'rgba(255,40,60,0.35)'; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, 7); ctx.fill(); }
    // arms reaching forward
    ctx.strokeStyle = '#4f6b35'; ctx.lineWidth = r * 0.32; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.75 + wob, y - r * 0.95); ctx.moveTo(x + r * 0.6, y); ctx.lineTo(x + r * 0.75 - wob, y - r * 0.95); ctx.stroke();
    ctx.fillStyle = z.owner ? '#6a7f9a' : '#7b8f5b'; ctx.beginPath(); ctx.arc(x, y + wob * 0.3, r, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = z.color || '#2c3a1e'; ctx.stroke();
    ctx.fillStyle = '#a8c27a'; ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.62, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8ff7a'; ctx.beginPath(); ctx.arc(x - r * 0.24, y - r * 0.2, r * 0.13, 0, 7); ctx.arc(x + r * 0.24, y - r * 0.2, r * 0.13, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2a1a'; ctx.fillRect(x - r * 0.25, y + r * 0.12, r * 0.5, r * 0.1);
    // hp pips
    for (var i = 0; i < C.zombie.hp; i++) {
      ctx.fillStyle = i < z.hp ? '#ff4a5a' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - r * 0.55 + i * r * 0.6, y + r * 1.08, r * 0.5, r * 0.2);
    }
    if (z.name) {
      var fs = Math.max(11, Math.round(sq * 0.27)); ctx.font = '700 ' + fs + 'px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = z.owner ? (z.color || '#cfe') : '#b9c9a0'; ctx.fillText(z.name + (z.owner ? ' (zombie)' : ''), x, y - r * 1.35);
    }
  }
  // AI portraits: a face plus a persona accessory (headband, goggles, mask, cap, bandana)
  function drawFace(ctx, x, y, r, persona, now) {
    var blink = now && (Math.floor(now / 160) % 25 === 0);
    ctx.save();
    if (persona === 'fighter') {            // red headband with tails
      ctx.fillStyle = '#e8203a'; ctx.fillRect(x - r * 0.92, y - r * 0.62, r * 1.84, r * 0.3);
      ctx.beginPath(); ctx.moveTo(x + r * 0.8, y - r * 0.55); ctx.lineTo(x + r * 1.35, y - r * 0.9); ctx.lineTo(x + r * 1.3, y - r * 0.35); ctx.fill();
    } else if (persona === 'sprinter') {     // aviator goggles strap
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - r * 0.98, y - r * 0.5, r * 1.96, r * 0.2);
    } else if (persona === 'sneak') {       // bandit mask
      ctx.fillStyle = '#16121c'; roundRect(ctx, x - r * 0.85, y - r * 0.42, r * 1.7, r * 0.42, r * 0.2); ctx.fill();
    } else if (persona === 'buddy') {       // baseball cap
      ctx.fillStyle = '#2f7dff'; ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.82, Math.PI, 0); ctx.fill(); ctx.fillRect(x - r * 0.1, y - r * 0.42, r * 1.05, r * 0.16);
    } else if (persona === 'looter') {      // green bandana + backpack strap
      ctx.fillStyle = '#3cb44b'; ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.85, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.1); ctx.lineTo(x - r * 0.3, y + r * 0.9); ctx.stroke();
    }
    var ey = y - r * 0.2, ex = r * 0.33, er = r * 0.2;
    if (persona === 'sprinter') { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x - ex, ey, er * 1.45, 0, 7); ctx.arc(x + ex, ey, er * 1.45, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - ex, ey, er, 0, 7); ctx.arc(x + ex, ey, er, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1420';
    if (blink) { ctx.fillRect(x - ex - er, ey - 1, er * 2, 2); ctx.fillRect(x + ex - er, ey - 1, er * 2, 2); }
    else { ctx.beginPath(); ctx.arc(x - ex + er * 0.25, ey + er * 0.1, er * 0.5, 0, 7); ctx.arc(x + ex + er * 0.25, ey + er * 0.1, er * 0.5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#1a1420'; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.beginPath();
    if (persona === 'fighter') { ctx.moveTo(x - r * 0.3, y + r * 0.38); ctx.lineTo(x + r * 0.3, y + r * 0.32); }
    else if (persona === 'sneak') ctx.arc(x + r * 0.08, y + r * 0.22, r * 0.28, 0.15 * Math.PI, 0.7 * Math.PI);
    else ctx.arc(x, y + r * 0.18, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  // small portrait on its own canvas (lobby, player cards, results)
  function portrait(cv, p) {
    var c = cv.getContext('2d'), w = cv.width, r = w * 0.36;
    c.clearRect(0, 0, w, cv.height);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, cv.height / 2, r + Math.max(2, w * 0.04), 0, 7); c.fill();
    c.fillStyle = p.color; c.beginPath(); c.arc(w / 2, cv.height / 2, r, 0, 7); c.fill();
    if (p.ai) drawFace(c, w / 2, cv.height / 2, r, p.ai.persona, 0);
    else { c.fillStyle = '#1a1420'; c.font = '700 ' + Math.round(r * 1.1) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.name.charAt(0).toUpperCase(), w / 2, cv.height / 2 + 1); }
    return cv;
  }
  function drawBubble(ctx, pos, sq, b) {
    var a = Math.min(1, b.t * 6, (b.dur - b.t) * 3), pop = b.t < 0.15 ? 0.7 + b.t * 2 : 1;
    var fs = Math.max(16, Math.round(sq * (b.shout ? 0.5 : 0.4))) * pop;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    ctx.font = '700 ' + Math.round(fs) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(b.text).width + fs * 1.1, th = fs * 1.6, x = pos[0], y = pos[1] - Math.max(sq * 0.38, 15) - fs * 2.6 - th / 2;
    ctx.fillStyle = b.shout ? '#fff3c4' : '#ffffff'; ctx.strokeStyle = b.color; ctx.lineWidth = 3;
    roundRect(ctx, x - tw / 2, y - th / 2, tw, th, th * 0.45); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - fs * 0.35, y + th / 2 - 1); ctx.lineTo(x + fs * 0.1, y + th / 2 + fs * 0.6); ctx.lineTo(x + fs * 0.35, y + th / 2 - 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - fs * 0.35, y + th / 2); ctx.lineTo(x + fs * 0.1, y + th / 2 + fs * 0.6); ctx.lineTo(x + fs * 0.35, y + th / 2); ctx.stroke();
    ctx.fillStyle = '#1a1420'; ctx.fillText(b.text, x, y + 1);
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // item icons (pickups and weapon badges)
  function drawPlayerSprite(ctx, x, y, sq, p, isCur, now, fighting, anim, r) {
    var SP = window.ZTSprites, size = Math.max(sq * 1.12, 34);
    if (isCur) {
      var pr = r * (1.35 + 0.15 * Math.sin(now / 180));
      ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(x, y + r * 0.55, pr, pr * 0.5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.beginPath(); var ay = y - size * 0.75 + Math.sin(now / 200) * 4; ctx.moveTo(x - r * 0.4, ay - r * 0.5); ctx.lineTo(x + r * 0.4, ay - r * 0.5); ctx.lineTo(x, ay); ctx.fill();
    }
    SP.draw(ctx, 'player', p.color, anim.dir, SP.frameFor(anim.moving, anim.walkT, now, p.id * 0.37), x, y - size * 0.12, size);
    if (p.weapon !== 'none') {
      var bx = x + size * 0.36, by = y + size * 0.18;
      ctx.fillStyle = '#1a1420'; ctx.beginPath(); ctx.arc(bx, by, r * 0.55, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      drawItem(ctx, p.weapon, bx, by, r * 0.95);
    }
    var fs = Math.max(15, Math.round(sq * 0.32));
    ctx.font = '700 ' + fs + 'px Fredoka, sans-serif';
    var label = p.name + (p.aiTakeover ? ' (AI)' : '');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(label).width + fs * 0.8, ty = y - size * 0.58 - fs * 0.5;
    ctx.fillStyle = 'rgba(15,12,22,0.85)'; roundRect(ctx, x - tw / 2, ty - fs * 0.62, tw, fs * 1.24, fs * 0.4); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, ty + 1);
    if (fighting) { ctx.strokeStyle = '#ff3b4e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 7); ctx.stroke(); }
  }
  function drawItem(ctx, kind, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var u = s / 10;
    if (kind === 'heart') {
      ctx.fillStyle = '#ff4a6a'; ctx.beginPath(); ctx.moveTo(0, 3.6 * u);
      ctx.bezierCurveTo(-6 * u, -0.5 * u, -3 * u, -5.5 * u, 0, -2.2 * u); ctx.bezierCurveTo(3 * u, -5.5 * u, 6 * u, -0.5 * u, 0, 3.6 * u); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.8; ctx.stroke();
    } else if (kind === 'pipe') {
      ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = u * 2.6; ctx.beginPath(); ctx.moveTo(-3.5 * u, 3.5 * u); ctx.lineTo(3.5 * u, -3.5 * u); ctx.stroke();
      ctx.strokeStyle = '#b8c0c8'; ctx.lineWidth = u * 1.6; ctx.beginPath(); ctx.moveTo(-3.5 * u, 3.5 * u); ctx.lineTo(3.5 * u, -3.5 * u); ctx.stroke();
      ctx.fillStyle = '#8a929b'; ctx.fillRect(2.2 * u, -4.6 * u, 2.4 * u, 2.4 * u);
    } else if (kind === 'pistol') {
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-4 * u, -2.4 * u, 7.5 * u, 2.4 * u); ctx.fillRect(-4 * u, -2.4 * u, 2.4 * u, 6 * u);
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-3.4 * u, -2 * u, 6.4 * u, 0.8 * u);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.5; ctx.strokeRect(-4 * u, -2.4 * u, 7.5 * u, 2.4 * u);
    } else if (kind === 'mg') {
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-5 * u, -1.8 * u, 10 * u, 2.4 * u); ctx.fillRect(-1 * u, 0, 1.8 * u, 3.6 * u); ctx.fillRect(-5 * u, -1 * u, 1.6 * u, 3 * u);
      ctx.fillStyle = '#c99a3c'; ctx.fillRect(1.6 * u, 0.4 * u, 1.6 * u, 3 * u);
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-4.4 * u, -1.5 * u, 9 * u, 0.7 * u);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.5; ctx.strokeRect(-5 * u, -1.8 * u, 10 * u, 2.4 * u);
    } else if (kind === 'ammo') {
      ctx.fillStyle = '#6b5a2e'; ctx.fillRect(-3.6 * u, -1 * u, 7.2 * u, 4.4 * u);
      ctx.fillStyle = '#e1b44c'; for (var i = 0; i < 3; i++) { ctx.fillRect(-2.9 * u + i * 2.2 * u, -3.6 * u, 1.5 * u, 3 * u); }
      ctx.fillStyle = '#c0c0c0'; for (var j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(-2.15 * u + j * 2.2 * u, -3.6 * u, 0.75 * u, Math.PI, 0); ctx.fill(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.5; ctx.strokeRect(-3.6 * u, -1 * u, 7.2 * u, 4.4 * u);
    } else if (kind === 'trap') {           // wooden trap box with a rope coil
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-3.8 * u, -3 * u, 7.6 * u, 6.4 * u);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = u * 0.6; ctx.strokeRect(-3.8 * u, -3 * u, 7.6 * u, 6.4 * u); ctx.beginPath(); ctx.moveTo(-3.8 * u, -3 * u); ctx.lineTo(3.8 * u, 3.4 * u); ctx.stroke();
      ctx.strokeStyle = '#e6c88a'; ctx.lineWidth = u * 0.9; ctx.beginPath(); ctx.arc(0, -3.4 * u, 2 * u, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -3.4 * u, 1.1 * u, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.4; ctx.strokeRect(-3.8 * u, -3 * u, 7.6 * u, 6.4 * u);
    } else if (kind === 'dynamite') {       // three red sticks + fuse
      for (var di = -1; di <= 1; di++) { ctx.fillStyle = '#d9342b'; ctx.fillRect(di * 2.3 * u - 1 * u, -3 * u, 2 * u, 6.6 * u); ctx.fillStyle = '#ff7a6a'; ctx.fillRect(di * 2.3 * u - 0.6 * u, -2.6 * u, 0.5 * u, 5.8 * u); }
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(-3.6 * u, -0.6 * u, 7.2 * u, 1.2 * u);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = u * 0.6; ctx.beginPath(); ctx.moveTo(0, -3 * u); ctx.quadraticCurveTo(1.5 * u, -5 * u, 2.6 * u, -4.4 * u); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = u * 0.4; ctx.strokeRect(-3.4 * u, -3 * u, 6.8 * u, 6.6 * u);
    }
    ctx.restore();
  }
  Renderer.drawItem = drawItem;
  Renderer.portrait = portrait;
  Renderer.tileCanvas = tileCanvas;
  root.ZTRender = Renderer;
})(window);
