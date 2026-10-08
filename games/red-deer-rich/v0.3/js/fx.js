/* RED DEER RICH - board effects (v0.2). Small, swappable particle effects drawn on the TV board.
   Every effect is a named KIND with a placeholder look drawn in code. To swap in rendered art later, register a
   sprite strip for that kind (3-8 frames, top-down, any size, transparent PNG):
       RDRFx.useSprite('dollar', ['fx/dollar_0.png', 'fx/dollar_1.png', ...], { fps: 12, size: 1.0 })
   and the particle plays those frames over its life instead of the placeholder (tinted kinds stay untinted).
   Kinds: 'spark' (landing firework), 'dollar' (money earned), 'bill' (money lost, flies away),
          'flybill' (a payment flying from one token to another),
          'boombill' (v0.3 PAY UP catch: bills explode out of the caught token, then stream to the catcher).
   Cost: pre-rendered little sprites + drawImage only, capped particle count, fewer particles on low graphics rungs. */
(function (root) {
  'use strict';
  var MAX = 260;
  var parts = [], sprites = {}, cache = {};
  var F = { rung: 0, scale: 1 };

  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // placeholder art, cached per colour
  function dotSprite(col) {
    var k = 'dot' + col; if (cache[k]) return cache[k];
    var c = cv(32, 32), x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return (cache[k] = c);
  }
  function dollarSprite() {
    if (cache.dollar) return cache.dollar;
    var c = cv(40, 40), x = c.getContext('2d');
    x.font = '900 34px Fredoka, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 6; x.strokeStyle = '#0c3d14'; x.strokeText('$', 20, 21); x.fillStyle = '#7dff7d'; x.fillText('$', 20, 21);
    return (cache.dollar = c);
  }
  function billSprite() {
    if (cache.bill) return cache.bill;
    var c = cv(44, 24), x = c.getContext('2d');
    x.fillStyle = '#3f8f4a'; x.fillRect(1, 1, 42, 22); x.strokeStyle = '#1d4a24'; x.lineWidth = 2; x.strokeRect(1, 1, 42, 22);
    x.strokeStyle = '#9fe0a6'; x.lineWidth = 1.5; x.strokeRect(5, 5, 34, 14);
    x.fillStyle = '#cdf5d1'; x.beginPath(); x.arc(22, 12, 5, 0, 7); x.fill();
    return (cache.bill = c);
  }
  function spriteFor(p) {
    var s = sprites[p.kind];
    if (s && s.ready) { var i = Math.min(s.frames.length - 1, Math.floor((1 - p.life / p.max) * s.frames.length * (s.loop ? 3 : 1)) % s.frames.length); return { img: s.frames[i], size: s.size }; }
    if (p.kind === 'spark') return { img: dotSprite(p.col), size: 1 };
    if (p.kind === 'dollar') return { img: dollarSprite(), size: 1 };
    return { img: billSprite(), size: 1 };
  }
  function add(p) { if (parts.length >= MAX) parts.shift(); parts.push(p); }
  function many(n) { var k = F.rung >= 5 ? 0.35 : F.rung >= 3 ? 0.6 : 1; return Math.max(2, Math.round(n * k)); }
  // how many particles for an amount: a few for small money, lots for big money
  function forAmount(a) { a = Math.abs(a); return Math.max(3, Math.min(22, Math.round(2 + Math.log(Math.max(1, a / 10)) / Math.LN2 * 2.2))); }

  // landing firework: player's colour; when the tile belongs to someone else, both colours mixed
  function burst(x, y, cols, r) {
    var n = many(26), sc = F.scale;
    for (var i = 0; i < n; i++) {
      var a = Math.PI * 2 * i / n + Math.random() * 0.3, v = (0.10 + Math.random() * 0.10) * sc;
      add({ kind: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.00012 * sc, drag: 0.9965, life: 650 + Math.random() * 250, max: 900, col: cols[i % cols.length], sz: (r || 1) * 7 * sc });
    }
  }
  function earn(x, y, amount) {
    var n = many(forAmount(amount)), sc = F.scale;
    for (var i = 0; i < n; i++) add({ kind: 'dollar', x: x + (Math.random() - 0.5) * 6 * sc, y: y, vx: (Math.random() - 0.5) * 0.12 * sc, vy: -(0.08 + Math.random() * 0.12) * sc, g: 0.00016 * sc, drag: 0.998, life: 900 + Math.random() * 400, max: 1300, sz: 13 * sc, delay: i * 35 });
  }
  function lose(x, y, amount) {
    var n = many(forAmount(amount)), sc = F.scale;
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2; add({ kind: 'bill', x: x, y: y, vx: Math.cos(a) * (0.06 + Math.random() * 0.08) * sc, vy: Math.sin(a) * 0.05 * sc - 0.05 * sc, g: -0.00002 * sc, drag: 0.999, spin: (Math.random() - 0.5) * 0.012, rot: Math.random() * 6, life: 1000 + Math.random() * 400, max: 1400, sz: 16 * sc, delay: i * 30 }); }
  }
  // a payment flying from one token to another (bills arc over, landing on the receiver)
  function fly(from, to, amount, getPos) {
    var n = many(Math.max(3, Math.round(forAmount(amount) * 0.8)));
    for (var i = 0; i < n; i++) add({ kind: 'flybill', from: from, to: to, getPos: getPos, t: -i * 70, dur: 700 + Math.random() * 150, life: 1, max: 1, sz: 15 * F.scale, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.02, arc: 0.25 + Math.random() * 0.2, jit: (Math.random() - 0.5) * 0.3 });
  }

  // v0.3 PAY UP catch: a bigger burst of bills blasts OUTWARD from the caught player's token, hangs a beat, then every
  // bill streams across to the catcher. o = { burstMs, flyMs, spread (burst radius in tiles), mult (bills vs a normal payment) }
  function explode(from, to, amount, getPos, o) {
    o = o || {}; var burstMs = o.burstMs || 420, flyMs = o.flyMs || 760, spread = o.spread || 2.3, mult = o.mult || 1.8, sc = F.scale;
    var n = many(Math.min(40, Math.round(forAmount(amount) * mult) + 6)), tile = 48 * sc;
    for (var i = 0; i < n; i++) {
      var a = Math.PI * 2 * i / n + (Math.random() - 0.5) * 0.5;
      add({ kind: 'boombill', from: from, to: to, getPos: getPos, t: -Math.random() * 60, burst: burstMs, fly: flyMs, wait: 90 + i * 22, dx: Math.cos(a), dy: Math.sin(a), dist: spread * tile * (0.5 + Math.random() * 0.5),
        life: 1, max: 1, sz: 19 * sc, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.03, arc: 0.12 + Math.random() * 0.18 });
    }
    var A = getPos(from); if (A) burst(A.x, A.y, ['#ffd84a', '#7dff7d', '#ffffff'], 1.4);
  }

  function step(dt) {
    dt = Math.min(dt, 100);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (p.kind === 'flybill') { p.t += dt; if (p.t > p.dur) parts.splice(i, 1); continue; }
      if (p.kind === 'boombill') { p.t += dt; if (p.t > p.burst + p.wait + p.fly) parts.splice(i, 1); continue; }
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= Math.pow(p.drag, dt); p.vy *= Math.pow(p.drag, dt); p.x += p.vx * dt; p.y += p.vy * dt; if (p.spin) p.rot += p.spin * dt;
    }
  }
  function draw(c) {
    if (!parts.length) return;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], sp = spriteFor(p), s = p.sz * sp.size, x, y, a;
      if (p.kind === 'boombill') {
        if (p.t < 0) continue;
        var A2 = p.getPos(p.from), B2 = p.getPos(p.to); if (!A2 || !B2) continue;
        var k1 = Math.min(1, p.t / p.burst), e1 = 1 - Math.pow(1 - k1, 3), sx = A2.x + p.dx * p.dist * e1, sy = A2.y + p.dy * p.dist * e1;
        var k2 = Math.max(0, Math.min(1, (p.t - p.burst - p.wait) / p.fly)), e2 = k2 < 0.5 ? 2 * k2 * k2 : 1 - Math.pow(-2 * k2 + 2, 2) / 2;
        var ddx = B2.x - sx, ddy = B2.y - sy, L2 = Math.sqrt(ddx * ddx + ddy * ddy);
        x = sx + ddx * e2; y = sy + ddy * e2 - L2 * p.arc * Math.sin(k2 * Math.PI);
        a = k2 > 0.85 ? (1 - k2) / 0.15 : 1; p.rot += p.spin * (k2 > 0 ? 8 : 24);
        s = p.sz * sp.size * (k1 < 1 ? 0.7 + 0.5 * e1 : 1.2 - 0.35 * e2);
      } else if (p.kind === 'flybill') {
        if (p.t < 0) continue;
        var A = p.getPos(p.from), Bp = p.getPos(p.to); if (!A || !Bp) continue;
        var k = p.t / p.dur, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, dx = Bp.x - A.x, dy = Bp.y - A.y, L = Math.sqrt(dx * dx + dy * dy);
        x = A.x + dx * e - dy * p.jit * Math.sin(k * Math.PI); y = A.y + dy * e - L * p.arc * Math.sin(k * Math.PI);
        a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1; p.rot += p.spin * 16;
      } else {
        if (p.delay > 0) continue;
        x = p.x; y = p.y; var f = p.life / p.max; a = p.kind === 'spark' ? Math.min(1, f * 1.6) : Math.min(1, f * 2.5);
      }
      c.globalAlpha = Math.max(0, Math.min(1, a));
      var w = s * sp.img.width / Math.max(sp.img.width, sp.img.height), h = s * sp.img.height / Math.max(sp.img.width, sp.img.height);
      if (p.rot) { c.save(); c.translate(x, y); c.rotate(p.rot); c.drawImage(sp.img, -w / 2, -h / 2, w, h); c.restore(); }
      else c.drawImage(sp.img, x - w / 2, y - h / 2, w, h);
    }
    c.globalAlpha = 1;
  }
  function useSprite(kind, urls, o) {
    o = o || {}; var s = { frames: [], ready: false, size: o.size || 1, loop: !!o.loop }, left = urls.length;
    urls.forEach(function (u, i) { var im = new Image(); im.onload = function () { if (--left === 0) s.ready = true; }; im.src = u; s.frames[i] = im; });
    sprites[kind] = s;
  }
  root.RDRFx = {
    burst: burst, earn: earn, lose: lose, fly: fly, explode: explode, step: step, draw: draw, useSprite: useSprite, forAmount: forAmount,
    count: function () { return parts.length; },
    kinds: function () { var o = {}; parts.forEach(function (q) { o[q.kind] = (o[q.kind] || 0) + 1; }); return o; },   // v0.3: tests
    clear: function () { parts.length = 0; },
    setRung: function (r) { F.rung = r; }, setScale: function (s) { F.scale = s; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
