/* =====================================================================
   chutes.js - LAVA CHUTES (v3): transitions between sections.
   A chute is a multi-row lane in a level:   { type: 'chute', rows: 7, name: 'Lava Chute' }
   Optional per chute: v0 / v1 (forward flow speed px/s at the start / end), chunks (per wave),
   waveGap (px between waves at the start), side0 / side1 (sideways speed start / extra at the end),
   sway (px each row swings either side of centre), spread (how much wider a row gets by the lip).
   How it plays:
   - Rows of floating rock chunks sway side to side (alternating, like logs) while the whole lava
     flow carries them FORWARD (up the screen), faster and faster along the chute. The chunks spread
     apart and shrink as they go: early on you can hop from chunk to chunk, later the gaps are too wide.
   - Riding a chunk carries you forward. Landing in the lava = the lava gag (player.js), respawn at the
     last checkpoint.
   - The last stretch is the LIP (CONFIG.chute.lipStart): tap there to jump off the end yourself
     (longer BIG LAUNCH, and you pick where you line up by when you jump - chunks drift sideways).
     Don't tap and the chute launches you anyway onto the ledge / into the next open straight at speed.
   ===================================================================== */

World.rowAt = (y) => Math.round(-y / CONFIG.world.tile - 0.5 + CONFIG.world.feetOffset);

class ChuteFlow {
  constructor(region, level) {
    const C = CONFIG.chute, T = World.T, d = region.def;
    this.region = region; this.level = level;
    this.startRow = region.startRow; this.rows = region.rows; this.endRow = region.startRow + region.rows - 1;
    this.y0 = -this.startRow * T;                          // bottom edge (entrance)
    this.y1 = -(this.endRow + 1) * T;                      // top edge (the lip)
    this.len = this.y0 - this.y1;
    this.d = d;   // per-chute overrides; everything else is read live from CONFIG.chute (so the tuning panel works)
    this.chunks = []; this.waveT = 0; this.waveN = 0; this.drawStamp = -1; this.t = 0;
    const settle = 1 / 20;
    for (let k = 0; k < 400 && !this.filled(); k++) this.update(settle, null);
  }
  opt(k, ck) { const v = this.d[k]; return v !== undefined ? v : CONFIG.chute[ck || k]; }
  get v0() { return this.opt('v0'); }        get v1() { return this.opt('v1'); }      get accel() { return this.opt('accel'); }
  get perWave() { return this.opt('chunks', 'chunksPerWave'); }                       get waveGap() { return this.opt('waveGap'); }
  get side0() { return this.opt('side0'); }  get side1() { return this.opt('side1'); } get sway() { return this.opt('sway'); }
  get spread() { return this.opt('spread'); }
  filled() { return this.chunks.some((c) => c.y < this.y1 + 10); }
  sAt(y) { return Math.max(0, Math.min(1, (this.y0 - y) / this.len)); }
  speedAt(y) { return this.v0 + (this.v1 - this.v0) * Math.pow(this.sAt(y), this.accel); }
  get launchY() { return this.y1 + World.T * 0.25; }       // riders get launched when their chunk reaches this
  inLip(y) { return this.sAt(y) >= CONFIG.chute.lipStart; }

  spawnWave() {
    // a wave = one ROW of chunks that sways side to side as a unit (alternating direction, like logs) and widens
    // as it goes (each chunk's offset from the row centre grows), so the chunks spread apart
    const C = CONFIG.chute, W = World.W, n = this.perWave, dir = this.waveN++ % 2 ? -1 : 1;
    const wave = { cx: W / 2 + (Math.random() * 2 - 1) * this.sway, dir, y: this.y0 + C.chunkH * 0.2 };
    const slot = W / n * 0.92;
    for (let i = 0; i < n; i++) {
      const w0 = C.chunkW[0] + Math.random() * (C.chunkW[1] - C.chunkW[0]);
      const off = (i - (n - 1) / 2) * slot + (Math.random() - 0.5) * slot * 0.25;
      const c = { isChunk: true, flow: this, wave, off, x: 0, y: wave.y, w0, w: w0, h: C.chunkH, vx: 0, dir, seed: Math.random() * 1000, bob: 0 };
      this.placeChunk(c, 0);
      this.chunks.push(c);
    }
  }
  placeChunk(c, s) {
    const W = World.W, x = c.wave.cx + c.off * (1 + this.spread * s), m = c.w / 2 + CONFIG.chute.bankGap * s;
    c.x = Math.max(m, Math.min(W - m, x));                // (pushed off the bank as it goes; at the entrance chunks reach the banks so you can always board)
  }

  update(dt, game) {
    const C = CONFIG.chute, W = World.W;
    this.t += dt;
    this.waveT -= dt;
    if (this.waveT <= 0) { this.spawnWave(); this.waveT += this.waveGap / this.v0; }
    const waves = new Set();
    for (const c of this.chunks) {
      const s = this.sAt(c.y);
      c.y -= this.speedAt(c.y) * dt;                      // the flow carries everything forward
      c.w = c.w0 * (1 - C.shrink * s);                     // chunks melt down a bit as they go
      waves.add(c.wave);
    }
    for (const wv of waves) {                              // each row sways (faster further along), bouncing inside the sway range
      const s = this.sAt(wv.y);
      wv.y -= this.speedAt(wv.y) * dt;
      wv.cx += wv.dir * (this.side0 + this.side1 * s) * dt;
      if (wv.cx < W / 2 - this.sway) { wv.cx = W / 2 - this.sway; wv.dir = 1; }
      if (wv.cx > W / 2 + this.sway) { wv.cx = W / 2 + this.sway; wv.dir = -1; }
    }
    for (const c of this.chunks) {
      const x0 = c.x;
      this.placeChunk(c, this.sAt(c.y));
      c.vx = dt > 0 ? (c.x - x0) / dt : 0;                 // (riders inherit this when they jump)
      c.dir = c.wave.dir;
      c.bob = Math.sin(this.t * 3 + c.seed) * 1.5;
    }
    this.chunks = this.chunks.filter((c) => c.y > this.y1 - C.chunkH);
    if (game && Math.random() < dt * 6) {                  // lava bubbles / embers
      const y = this.y0 - Math.random() * this.len;
      Effects.spawn('lavapop', Math.random() * W, y, 1);
    }
  }

  /** player landing at (p.x, y): the chunk under their feet, or null (= lava) */
  chunkAt(x, y) {
    const C = CONFIG.chute;
    let best = null, bd = Infinity;
    for (const c of this.chunks) {
      const ex = Math.abs(x - c.x) - c.w / 2, ey = Math.abs(y - c.y) - c.h / 2;
      if (ex > C.landTolX || ey > C.landTolY) continue;
      const d = Math.max(ex, 0) + Math.max(ey, 0) * 0.5;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  land(p, game) {
    const y = p.landY !== null && p.landY !== undefined ? p.landY : World.feetY(p.row);
    const c = this.chunkAt(p.x, y);
    if (!c) return { die: 'lava' };
    c.bobKick = 4;
    return { ok: true, ride: c };
  }

  grounded(p, dt, game) {
    const c = p.ride;
    if (!c || !c.isChunk) return { die: 'lava' };
    p.rideOffset += (p.riderVx - c.vx) * dt;
    p.riderVx += (c.vx - p.riderVx) * Math.min(1, CONFIG.friction.chute * dt);
    const lim = Math.max(4, c.w / 2 - 6);                  // forgiving: you stay on your chunk
    p.rideOffset = Math.max(-lim, Math.min(lim, p.rideOffset));
    p.x = Math.max(CONFIG.player.hitHalfWidth, Math.min(World.W - CONFIG.player.hitHalfWidth, c.x + p.rideOffset));
    p.row = Math.max(this.startRow, Math.min(this.endRow, World.rowAt(c.y)));
    if (this.inLip(c.y) && !p.lipShown) {
      p.lipShown = true;
      Effects.text(p.x, c.y - 58, 'TAP TO LAUNCH!', '#ffe14d', 12, 0.8);
    }
    if (c.y <= this.launchY) p.chuteLaunch(game, false);   // didn't jump: the chute launches you
    return null;
  }

  /** where a launch off the end lands: the ledge, or a few rows into the open straight beyond it */
  launchTarget(game, big) {
    const L = game.level.lanes, ledge = this.endRow + 1, C = CONFIG.chute;
    const ll = L[ledge];
    if (!ll) return game.level.goalRow;
    if (!ll.run) return ledge;
    const reg = ll.region, last = reg ? reg.startRow + reg.rows - 1 : ledge;
    return Math.min(last, ledge + C.launchRows - 1 + (big ? C.bigLaunchExtra : 0));
  }

  /* ---------- drawing ---------- */
  drawLava(ctx, lane, view, game) {
    const T = World.T, t = game.time, s0 = this.sAt(lane.bottom), s1 = this.sAt(lane.top);
    if (Sprites.drawTiles(ctx, 'tile_lava', t, Math.floor(view.x0 / T) * T, lane.top, view.x1 - Math.floor(view.x0 / T) * T, T, T)) return;
    const g = ctx.createLinearGradient(0, lane.bottom, 0, lane.top);
    g.addColorStop(0, `hsl(${18 + 10 * s0}, 95%, ${42 + 10 * s0}%)`); g.addColorStop(1, `hsl(${18 + 10 * s1}, 95%, ${42 + 10 * s1}%)`);
    ctx.fillStyle = g; ctx.fillRect(view.x0, lane.top, view.x1 - view.x0, T + 0.5);
    // flow streaks moving forward, faster further along
    ctx.strokeStyle = 'rgba(255,240,150,0.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = (hash2(i, lane.index) * World.W + Math.sin(t * 0.7 + i) * 10);
      const v = this.speedAt(lane.y), len = 6 + v * 0.06;
      const yy = lane.bottom - ((t * v + hash2(lane.index, i) * T) % T);
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, yy - len); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,20,0,0.25)';
    for (let i = 0; i < 6; i++) {
      const x = hash2(lane.index, i + 7) * World.W, yy = lane.top + hash2(i, lane.index + 3) * T;
      ctx.beginPath(); ctx.ellipse(x, yy, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawChunks(ctx, view, game) {
    const list = this.chunks.filter((c) => c.y > view.y0 - 40 && c.y < view.y1 + 40).sort((a, b) => a.y - b.y);
    for (const c of list) {
      ctx.fillStyle = 'rgba(80,10,0,0.35)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 6, c.w / 2 + 2, c.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      Sprites.draw(ctx, 'chunk', 'idle', game.time, c.x, c.y + c.bob, { w: c.w, h: c.h, chunk: c });
    }
  }
  drawLip(ctx, game) {
    const W = World.W, y = this.y1, t = game.time;
    ctx.fillStyle = '#3b2a22'; ctx.fillRect(0, y - 4, W, 8);                 // stone lip at the end
    ctx.fillStyle = '#5a4234'; ctx.fillRect(0, y - 4, W, 3);
    const ly = y + World.T * (1 - CONFIG.chute.lipStart) * this.rows;        // lip zone marker
    ctx.strokeStyle = `rgba(255,225,77,${0.35 + 0.25 * Math.sin(t * 6)})`; ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,240,170,0.8)';
    for (let i = 0; i < 5; i++) {                                           // chevrons: launch this way
      const x = W * (i + 0.5) / 5, yy = y + 14 + ((t * 30) % 10);
      ctx.beginPath(); ctx.moveTo(x - 8, yy + 6); ctx.lineTo(x, yy); ctx.lineTo(x + 8, yy + 6); ctx.lineTo(x + 8, yy + 9); ctx.lineTo(x, yy + 3); ctx.lineTo(x - 8, yy + 9); ctx.fill();
    }
  }
}

registerLaneType('chute', {
  safe: false, respawn: false,
  init(lane, def, level) {
    const reg = def.region || { def, startRow: lane.index, rows: 1 };
    if (!reg.flow) reg.flow = new ChuteFlow(reg, level);
    lane.flow = reg.flow; lane.region = reg;
  },
  update(lane, dt, game) { if ((lane.def.regionRow || 0) === 0) lane.flow.update(dt, game); },
  drawBg(ctx, lane, view, game) {
    lane.flow.drawLava(ctx, lane, view, game);
    const r = lane.def.regionRow || 0;
    if (r === 0) {                                                          // entrance edge + name
      ctx.fillStyle = 'rgba(40,10,0,0.5)'; ctx.fillRect(view.x0, lane.bottom - 4, view.x1 - view.x0, 4);
      if (lane.region.def.name) {
        ctx.fillStyle = 'rgba(90,15,0,0.45)'; ctx.font = '900 16px "Trebuchet MS", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lane.region.def.name.toUpperCase().split('').join(' '), World.W / 2, lane.y + 10);
      }
    }
  },
  drawEntities(ctx, lane, game) {
    const f = lane.flow;
    if (f.drawStamp === game.frame) return;
    f.drawStamp = game.frame;
    f.drawLip(ctx, game);
    f.drawChunks(ctx, Camera.visibleRect(), game);
  },
  land(lane, p, game) { return lane.flow.land(p, game); },
  grounded(lane, p, dt, game) { return lane.flow.grounded(p, dt, game); }
});

/* ---------- placeholders: rock chunk (basalt with glowing cracks) and boulder ---------- */
Sprites.registerPlaceholder('chunk', (ctx, state, t, o) => {
  const w = o.w || 60, h = o.h || 28, seed = o.chunk ? o.chunk.seed : 1;
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, j = 0.82 + 0.18 * hash2(i, seed | 0);
    pts.push([Math.cos(a) * w / 2 * j, Math.sin(a) * h / 2 * j]);
  }
  ctx.fillStyle = '#2c2523'; ctx.strokeStyle = '#120c0a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4a3d38';                                                  // lit top face
  ctx.beginPath(); pts.forEach(([x, y], i) => { const yy = y * 0.7 - 3; i ? ctx.lineTo(x * 0.85, yy) : ctx.moveTo(x * 0.85, yy); }); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(255,${120 + 60 * Math.sin(t * 4 + seed)},30,0.9)`; ctx.lineWidth = 1.4;  // glowing cracks
  ctx.beginPath(); ctx.moveTo(-w * 0.3, -2); ctx.lineTo(-w * 0.1, 2); ctx.lineTo(w * 0.05, -3); ctx.lineTo(w * 0.25, 1); ctx.stroke();
  ctx.fillStyle = 'rgba(255,170,60,0.55)'; ctx.fillRect(-w * 0.45, h * 0.28, w * 0.9, 2);   // glowing rim at the waterline
});
Sprites.registerPlaceholder('boulder', (ctx, state, t, o) => {
  const r = o.r || 16;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 3, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7d7468'; ctx.strokeStyle = '#3e3832'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.45, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9d9486'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.7, r * 0.5, r * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a534b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.2); ctx.lineTo(r * 0.45, -r * 0.6); ctx.stroke();
});
