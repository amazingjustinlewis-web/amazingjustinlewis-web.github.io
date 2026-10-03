/* =====================================================================
   entities.js - things that live in lanes: vehicles, logs, pickups.
   To add a new hazard/object: add an entry to ENTITY_TYPES (sprite key,
   size in tiles, kind) and register a placeholder drawing for its sprite
   key at the bottom of this file. Lanes (lanes.js) decide how it behaves.
   kind: 'vehicle' (kills grounded players it touches), 'platform'
         (can be ridden), 'pickup' (collected by touching).
   ===================================================================== */
const ENTITY_TYPES = {
  car:     { kind: 'vehicle',  sprite: 'car',     state: 'drive', len: 1.25, height: 0.62,
             colors: ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8d5cf6', '#3b82f6', '#ec4899'] },
  truck:   { kind: 'vehicle',  sprite: 'truck',   state: 'drive', len: 2.7,  height: 0.76,
             colors: ['#ef4444', '#16a34a', '#2563eb', '#f59e0b'] },
  log:     { kind: 'platform', sprite: 'log',     state: 'float', len: 3,    height: 0.7 },
  powerup: { kind: 'pickup',   sprite: 'powerup', state: 'idle',  len: 0.62, height: 0.62, effect: 'triple' }
};

function createEntity(type, props = {}) {
  const def = ENTITY_TYPES[type];
  if (!def) throw new Error('Unknown entity type: ' + type);
  const T = CONFIG.world.tile;
  const e = {
    type, def, kind: def.kind, x: 0, y: 0, vx: 0, t: Math.random() * 10,
    len: def.len, color: def.colors ? def.colors[(Math.random() * def.colors.length) | 0] : null,
    hidden: false, bob: 0
  };
  Object.assign(e, props);
  e.w = e.len * T; e.h = def.height * T;
  return e;
}

function drawEntity(ctx, e, flip) {
  if (e.hidden) return;
  Sprites.draw(ctx, e.def.sprite, e.state || e.def.state, e.t, e.x, e.y + (e.bob || 0), {
    w: e.w, h: e.h, flipX: flip !== undefined ? flip : e.vx < 0, color: e.color, entity: e
  });
}

/* ---------- shape helpers ---------- */
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function shade(hex, amt) { // amt -1..1
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
  return `rgb(${r},${g},${b})`;
}

/* ---------- placeholders (drawn facing RIGHT, origin = centre) ---------- */
Sprites.registerPlaceholder('car', (ctx, state, t, o) => {
  const w = o.w, h = o.h, c = o.color || '#e63946';
  const bounce = Math.sin(t * 22) * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, -w / 2 + 2, -h / 2 + 5, w, h, 9); ctx.fill();
  ctx.fillStyle = '#16161a';
  for (const wx of [-w * 0.3, w * 0.3]) { rrect(ctx, wx - 6, -h / 2 - 2, 12, 6, 2); ctx.fill(); rrect(ctx, wx - 6, h / 2 - 4, 12, 6, 2); ctx.fill(); }
  ctx.translate(0, bounce);
  ctx.fillStyle = c; rrect(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill();
  ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = shade(c, -0.2); rrect(ctx, -w * 0.22, -h * 0.36, w * 0.4, h * 0.72, 6); ctx.fill();
  ctx.fillStyle = '#bfe6ff'; rrect(ctx, w * 0.16, -h * 0.32, w * 0.1, h * 0.64, 3); ctx.fill();
  ctx.fillStyle = '#8fb8d0'; rrect(ctx, -w * 0.3, -h * 0.28, w * 0.07, h * 0.56, 2); ctx.fill();
  ctx.fillStyle = '#fff6b0'; ctx.fillRect(w / 2 - 4, -h * 0.38, 3, 6); ctx.fillRect(w / 2 - 4, h * 0.38 - 6, 3, 6);
  ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-w / 2 + 1, -h * 0.38, 3, 5); ctx.fillRect(-w / 2 + 1, h * 0.38 - 5, 3, 5);
});

Sprites.registerPlaceholder('truck', (ctx, state, t, o) => {
  const w = o.w, h = o.h, c = o.color || '#ef4444';
  const cab = w * 0.24;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, -w / 2 + 3, -h / 2 + 6, w, h, 7); ctx.fill();
  ctx.fillStyle = '#16161a';
  for (const wx of [-w * 0.38, -w * 0.22, w * 0.1, w * 0.36]) { ctx.fillRect(wx - 6, -h / 2 - 2, 12, 5); ctx.fillRect(wx - 6, h / 2 - 3, 12, 5); }
  ctx.translate(0, Math.sin(t * 15) * 0.4);
  // trailer
  ctx.fillStyle = '#e8e8ec'; rrect(ctx, -w / 2, -h / 2, w - cab - 4, h, 5); ctx.fill();
  ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = c; ctx.fillRect(-w / 2 + 6, -h * 0.12, w - cab - 16, h * 0.24);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
  for (let x = -w / 2 + 14; x < w / 2 - cab - 8; x += 14) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + 3); ctx.lineTo(x, h / 2 - 3); ctx.stroke(); }
  // cab
  ctx.fillStyle = c; rrect(ctx, w / 2 - cab, -h * 0.44, cab, h * 0.88, 8); ctx.fill();
  ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#bfe6ff'; rrect(ctx, w / 2 - cab * 0.42, -h * 0.34, cab * 0.22, h * 0.68, 3); ctx.fill();
  ctx.fillStyle = '#fff6b0'; ctx.fillRect(w / 2 - 4, -h * 0.36, 3, 6); ctx.fillRect(w / 2 - 4, h * 0.36 - 6, 3, 6);
});

Sprites.registerPlaceholder('log', (ctx, state, t, o) => {
  const w = o.w, h = o.h, e = o.entity || {};
  // wake/foam
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rrect(ctx, -w / 2 - 4, -h / 2 + 2, w + 8, h + 4, h / 2); ctx.fill();
  ctx.fillStyle = '#7a4a24'; rrect(ctx, -w / 2, -h / 2, w, h, h / 2.2); ctx.fill();
  ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,10,0.55)'; ctx.lineWidth = 1.5;
  const seed = e.seed || 1;
  for (let i = 0; i < 3; i++) {
    const yy = -h * 0.25 + i * h * 0.25;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 10 + ((seed * (i + 3)) % 9), yy);
    ctx.lineTo(w / 2 - 12 - ((seed * (i + 5)) % 11), yy + (i - 1) * 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,220,170,0.18)'; rrect(ctx, -w / 2 + 6, -h / 2 + 3, w - 12, h * 0.22, 4); ctx.fill();
  // end caps with rings
  for (const s of [-1, 1]) {
    const cx = s * (w / 2 - h * 0.28);
    ctx.fillStyle = '#c9925a'; ctx.beginPath(); ctx.ellipse(cx, 0, h * 0.24, h * 0.44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(cx, 0, h * 0.13, h * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (e.bumpT > 0) { // flash on bump
    ctx.fillStyle = `rgba(255,255,255,${e.bumpT * 1.2})`; rrect(ctx, -w / 2, -h / 2, w, h, h / 2.2); ctx.fill();
  }
});

function drawOrbPowerup(ctx, state, t, o) {   // (robot style swaps in a battery - characters.js)
  const r = (o.w || 30) / 2, pulse = 1 + Math.sin(t * 6) * 0.08;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.4);
  g.addColorStop(0, 'rgba(255,240,140,0.85)'); g.addColorStop(0.4, 'rgba(255,170,40,0.35)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(0, Math.sin(t * 3) * 2.5);
  ctx.scale(pulse, pulse);
  const g2 = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  g2.addColorStop(0, '#fffbe0'); g2.addColorStop(0.5, '#ffd23f'); g2.addColorStop(1, '#e8701c');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  // triple chevrons
  ctx.strokeStyle = '#7a2e00'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const yy = r * 0.45 - i * r * 0.42;
    ctx.beginPath(); ctx.moveTo(-r * 0.4, yy + r * 0.18); ctx.lineTo(0, yy - r * 0.12); ctx.lineTo(r * 0.4, yy + r * 0.18); ctx.stroke();
  }
  // orbiting sparks
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + (i * Math.PI * 2) / 3;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.6, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}
Sprites.registerPlaceholder('powerup', drawOrbPowerup);
