/* =====================================================================
   fireworks.js - the WIN CELEBRATION: rockets whistle up from the bottom of
   the screen and burst into colourful sparks (the winner's colour featured),
   with WebAudio whistles, pops and crackles. Drawn in SCREEN space on top of
   the game, so it fills the screen at any zoom. Tuning: CONFIG.celebrate.
   Fireworks.start(color) / Fireworks.update(realDt, w, h) / Fireworks.draw(ctx, w, h) / Fireworks.clear()
   ===================================================================== */
const Fireworks = (() => {
  let rockets = [], sparks = [], flashes = [], t = 0, active = false, nextAt = 0, featured = '#ffffff', finale = 0, finaleAt = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

  function start(color) {
    rockets = []; sparks = []; flashes = []; t = 0; active = true; featured = color || '#ffffff';
    nextAt = 0.05; finale = 0; finaleAt = 0;
  }
  function clear() { rockets = []; sparks = []; flashes = []; active = false; }

  function burstColor() {
    const C = CONFIG.celebrate;
    return Math.random() < C.featuredShare ? featured : pickOf(C.palette);
  }

  function launch(w, h, x) {
    const ft = rnd(0.75, 1.15);
    rockets.push({
      x0: x === undefined ? rnd(w * 0.1, w * 0.9) : x, y0: h + 10, x: 0, y: 0,
      drift: rnd(-0.06, 0.06) * w, apex: rnd(h * 0.1, h * 0.42), age: 0, ft,
      color: burstColor(), kind: pickOf(['peony', 'peony', 'ring', 'willow', 'crackle']), big: Math.random() < 0.3
    });
    Sfx.play('whistle', ft);
  }

  function burst(r, h) {
    const C = CONFIG.celebrate;
    const n = Math.round(C.sparks * (r.big ? 1.5 : 1) * (r.kind === 'ring' ? 0.7 : 1));
    const S = h * (r.big ? 0.42 : 0.32);                       // burst speed scales with screen size
    const second = Math.random() < 0.35 ? (r.color === featured ? '#ffffff' : featured) : null;  // two-tone shells
    for (let i = 0; i < n; i++) {
      const a = r.kind === 'ring' ? (i / n) * Math.PI * 2 : rnd(0, Math.PI * 2);
      const sp = r.kind === 'ring' ? S : S * Math.sqrt(Math.random()) * rnd(0.85, 1.05);
      const willow = r.kind === 'willow';
      sparks.push({
        x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (r.kind === 'ring' ? 0.75 : 1),
        age: 0, life: willow ? rnd(1.6, 2.2) : rnd(0.9, 1.5), drag: willow ? 2.2 : 1.5, g: h * (willow ? 0.22 : 0.3),
        color: willow ? '#ffd27a' : (second && i % 2 ? second : r.color), size: r.big ? 2.6 : 2.1,
        glitter: r.kind === 'crackle' || willow, crackle: r.kind === 'crackle' && Math.random() < 0.25
      });
    }
    flashes.push({ x: r.x, y: r.y, age: 0, life: 0.18, color: r.color, r: S * 0.5 });
    Sfx.play('pop', r.big ? 1 : 0.7);
    if (r.kind === 'crackle') Sfx.play('crackle');
  }

  function update(dt, w, h) {
    if (!active && !rockets.length && !sparks.length && !flashes.length) return;
    const C = CONFIG.celebrate;
    t += dt;
    if (active) {
      if (t < C.duration - 1.6 && t >= nextAt) {              // steady show
        launch(w, h);
        if (t < 0.2) launch(w, h);                             // opening double
        nextAt = t + rnd(0.6, 1.4) / C.rocketsPerSec;
      }
      if (t >= C.duration - 1.6 && finale < C.finale && t >= finaleAt) {   // finale: a quick volley
        launch(w, h, w * (0.12 + 0.76 * ((finale * 0.618) % 1)));
        finale++; finaleAt = t + 0.09;
      }
      if (t >= C.duration) active = false;
    }
    for (const r of rockets) {
      r.age += dt;
      const k = Math.min(1, r.age / r.ft), e = 1 - (1 - k) * (1 - k);   // ease-out climb
      r.x = r.x0 + r.drift * e; r.y = r.y0 + (r.apex - r.y0) * e;
      if (Math.random() < dt * 60) sparks.push({ x: r.x + rnd(-1.5, 1.5), y: r.y + 4, vx: rnd(-14, 14), vy: rnd(10, 50), age: 0, life: rnd(0.25, 0.45), drag: 2, g: 60, color: '#ffe9b0', size: 1.4, trail: true });
      if (k >= 1) { r.done = true; burst(r, h); }
    }
    rockets = rockets.filter((r) => !r.done);
    const extra = [];
    for (const s of sparks) {
      s.age += dt;
      s.vx -= s.vx * Math.min(1, s.drag * dt); s.vy -= s.vy * Math.min(1, s.drag * dt);
      s.vy += s.g * dt; s.px = s.x; s.py = s.y; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.crackle && !s.popped && s.age > s.life * 0.55) {  // crackle: little secondary pops
        s.popped = true;
        for (let i = 0; i < 5; i++) extra.push({ x: s.x, y: s.y, vx: rnd(-60, 60), vy: rnd(-60, 60), age: 0, life: rnd(0.2, 0.35), drag: 3, g: 40, color: '#ffffff', size: 1.3 });
      }
    }
    sparks = sparks.filter((s) => s.age < s.life).concat(extra);
    if (sparks.length > 2500) sparks.splice(0, sparks.length - 2500);
    for (const f of flashes) f.age += dt;
    flashes = flashes.filter((f) => f.age < f.life);
  }

  function draw(ctx, w, h, dim) {
    if (dim > 0) { ctx.fillStyle = `rgba(4,6,20,${0.3 * dim})`; ctx.fillRect(0, 0, w, h); }  // night-sky dim behind the show
    if (!rockets.length && !sparks.length && !flashes.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flashes) {
      const k = f.age / f.life, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineCap = 'round';
    for (const s of sparks) {
      const k = s.age / s.life;
      let a = 1 - k * k;
      if (s.glitter && k > 0.35) a *= Math.random() < 0.5 ? 1 : 0.15;   // twinkle
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size * (1 - k * 0.5);
      ctx.beginPath(); ctx.moveTo(s.px === undefined ? s.x : s.px - (s.x - s.px) * 1.5, s.py === undefined ? s.y : s.py - (s.y - s.py) * 1.5);
      ctx.lineTo(s.x + 0.01, s.y); ctx.stroke();
    }
    for (const r of rockets) {
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  return { start, clear, update, draw, get active() { return active; }, get count() { return sparks.length + rockets.length; } };
})();
