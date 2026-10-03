/* =====================================================================
   effects.js - particles, splats, shockwave rings and floating text.
   All effects run on GAME time, so slow motion slows them too.
   Add a new particle look by adding an entry to PARTICLE_TYPES.
   ===================================================================== */
const FIRE_PALETTES = [
  ['#ffe27a', '#ffb02e', '#ff6a1f', '#d8321c', '#4a1508'],   // P1: classic fire
  ['#b8f8ff', '#5ee6ff', '#22a8ee', '#2563eb', '#1e1b4b']    // P2: blue fire
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const PARTICLE_TYPES = {
  // each returns a particle object given (x, y, opts)
  fire: (x, y, o) => ({ x: x + rand(-11, 11), y: y + rand(-4, 2), vx: rand(-30, 30), vy: rand(-120, -55), g: -60, drag: 2,
    life: rand(0.25, 0.5), size: rand(2.5, 5.5), size1: 0.35, palette: o.palette || FIRE_PALETTES[0], add: true, shape: 'flame',
    alpha: 0.7, behind: Math.random() < 0.45 }),
  ember: (x, y, o) => { const a = rand(0, Math.PI * 2), s = rand(120, 320);
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - 60, g: 120, drag: 2.5, life: rand(0.4, 0.8), size: rand(3, 7), size1: 0.3,
      palette: o.palette || FIRE_PALETTES[0], add: true, shape: 'circle' }; },
  dust: (x, y) => ({ x: x + rand(-10, 10), y: y + rand(-2, 2), vx: rand(-70, 70), vy: rand(-35, -5), g: 50, drag: 4,
    life: rand(0.25, 0.45), size: rand(2.5, 4.5), size1: 2.2, color: 'rgba(225,215,180,0.7)', shape: 'circle' }),
  splash: (x, y) => ({ x: x + rand(-8, 8), y, vx: rand(-90, 90), vy: rand(-230, -90), g: 650, drag: 0.5,
    life: rand(0.45, 0.75), size: rand(2, 4.5), size1: 0.6, color: pick(['#e0f4ff', '#9fd6ff', '#5fb4f0']), shape: 'circle' }),
  splat: (x, y, o) => ({ x, y, vx: rand(-170, 170), vy: rand(-220, -40), g: 520, drag: 1,
    life: rand(0.5, 0.9), size: rand(3, 6.5), size1: 0.8, color: o.color || '#e33', shape: 'circle' }),
  decal: (x, y, o) => ({ x: x + rand(-14, 14), y: y + rand(-6, 6), vx: 0, vy: 0, g: 0, drag: 0,
    life: 3.5, size: rand(3, 8), size1: 1, color: o.color || '#a22', shape: 'circle', fadeLate: true, under: true }),
  sparkle: (x, y, o) => ({ x: x + rand(-14, 14), y: y + rand(-14, 14), vx: rand(-40, 40), vy: rand(-60, 10), g: 0, drag: 2,
    life: rand(0.4, 0.8), size: rand(2.5, 5), size1: 0.2, color: o.color || '#fff6a0', add: true, shape: 'star', rot: rand(0, 6), vr: rand(-6, 6) }),
  confetti: (x, y) => ({ x: x + rand(-30, 30), y: y + rand(-20, 0), vx: rand(-160, 160), vy: rand(-380, -160), g: 380, drag: 1.2,
    life: rand(1.4, 2.4), size: rand(3, 5), size1: 1, color: pick(['#ff8a1f', '#22d3ee', '#ffe14d', '#ff4fa3', '#7cff6b', '#ffffff']),
    shape: 'rect', rot: rand(0, 6), vr: rand(-12, 12) }),
  bumpspark: (x, y) => ({ x, y: y + rand(-14, 14), vx: rand(-60, 60), vy: rand(-140, -40), g: 500, drag: 1,
    life: rand(0.3, 0.5), size: rand(1.5, 3), size1: 0.6, color: pick(['#d9f2ff', '#9fd6ff', '#c49a6c']), shape: 'circle' }),
  spout: (x, y) => ({ x: x + rand(-5, 5), y, vx: rand(-35, 35), vy: rand(-420, -250), g: 900, drag: 0.4,
    life: rand(0.45, 0.7), size: rand(2.5, 4.5), size1: 0.6, color: pick(['#e6f6ff', '#bfe4ff', '#ffffff']), shape: 'circle' }),
  bubble: (x, y) => ({ x: x + rand(-8, 8), y: y + rand(-2, 4), vx: rand(-8, 8), vy: rand(-36, -18), g: 0, drag: 0.5,
    life: rand(0.45, 0.8), size: rand(1.4, 2.8), size1: 1.3, color: 'rgba(225,245,255,0.9)', shape: 'ring', lineWidth: 1.2 }),
  droplet: (x, y) => ({ x: x + rand(-6, 6), y: y + rand(-8, 8), vx: rand(-150, 150), vy: rand(-120, -20), g: 500, drag: 0.8,
    life: rand(0.3, 0.5), size: rand(1.2, 2.2), size1: 0.7, color: pick(['#cfeeff', '#ffffff', '#9fd6ff']), shape: 'circle' }),
  smoke: (x, y) => ({ x: x + rand(-6, 6), y: y + rand(-4, 4), vx: rand(-14, 14), vy: rand(-55, -25), g: 0, drag: 0.8,
    life: rand(0.6, 1.1), size: rand(3, 5), size1: 2.6, color: pick(['rgba(90,90,90,0.55)', 'rgba(130,125,120,0.5)', 'rgba(60,55,55,0.55)']), shape: 'circle' }),
  lavapop: (x, y) => ({ x, y, vx: rand(-20, 20), vy: rand(-90, -40), g: 260, drag: 1,
    life: rand(0.3, 0.6), size: rand(1.5, 2.6), size1: 0.5, color: pick(['#fff2a8', '#ffb02e', '#ff5a1f']), shape: 'circle', add: true }),
  ring: (x, y, o) => ({ x, y, vx: 0, vy: 0, g: 0, drag: 0, life: o.life || 0.35, size: o.r0 || 6, size1: (o.r1 || 60) / (o.r0 || 6),
    color: o.color || '#fff', shape: 'ring', lineWidth: o.lineWidth || 3, add: !!o.add })
};

const Effects = (() => {
  let parts = [];
  let texts = [];

  function spawn(type, x, y, n = 1, opts = {}) {
    const make = PARTICLE_TYPES[type];
    for (let i = 0; i < n; i++) {
      const p = make(x, y, opts);
      p.max = p.life; p.age = 0; p.vr = p.vr || 0; p.rot = p.rot || 0;
      parts.push(p);
    }
  }

  function update(dt) {
    for (const p of parts) {
      p.age += dt;
      p.vx -= p.vx * Math.min(1, p.drag * dt);
      p.vy -= p.vy * Math.min(1, p.drag * dt);
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    parts = parts.filter((p) => p.age < p.max);
    for (const t of texts) { t.age += dt; t.y -= 28 * dt; }
    texts = texts.filter((t) => t.age < t.life);
  }

  function star(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.4 : r, a = (i / 8) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  // layer: 'under' (ground decals), 'behind' (behind characters), 'front'
  function drawList(ctx, layer) {
    for (const p of parts) {
      const pl = p.under ? 'under' : p.behind ? 'behind' : 'front';
      if (pl !== layer) continue;
      const k = p.age / p.max;
      const size = p.size * (1 + (p.size1 - 1) * k);
      let alpha = (p.fadeLate ? Math.min(1, (1 - k) * 4) : 1 - k * k) * (p.alpha || 1);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      const col = p.palette ? p.palette[Math.min(p.palette.length - 1, Math.floor(k * p.palette.length))] : p.color;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (p.shape === 'flame') { // teardrop pointing along its motion
        const a = Math.atan2(p.vy, p.vx), sz = Math.max(0.4, size);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(sz * 2.6, 0); ctx.quadraticCurveTo(0, sz * 1.1, -sz, 0); ctx.quadraticCurveTo(0, -sz * 1.1, sz * 2.6, 0);
        ctx.fill(); ctx.restore();
      } else if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.3, size), 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === 'ring') {
        ctx.lineWidth = p.lineWidth * (1 - k) + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.shape === 'star') star(ctx, size); else ctx.fillRect(-size, -size * 0.5, size * 2, size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  return {
    spawn, update,
    /** Decals and other ground-level marks (drawn under characters). */
    drawUnder(ctx) { drawList(ctx, 'under'); },
    /** Particles that sit behind characters (half of the charge fire, for depth). */
    drawBehind(ctx) { drawList(ctx, 'behind'); },
    draw(ctx) {
      drawList(ctx, 'front');
      for (const t of texts) {
        const k = t.age / t.life;
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `900 ${t.size}px "Trebuchet MS", Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        const s = 1 + Math.max(0, 0.25 - t.age) * 2;
        ctx.save(); ctx.translate(t.x, t.y); ctx.scale(s, s);
        ctx.strokeText(t.text, 0, 0); ctx.fillStyle = t.color; ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    text(x, y, text, color = '#fff', size = 16, life = 1.0) { texts.push({ x, y, text, color, size, life, age: 0 }); },
    clear() { parts = []; texts = []; },
    get count() { return parts.length; }
  };
})();
