/* =====================================================================
   lanes.js - lane (row) types and the level builder.

   A level is a list of lanes, bottom (row 0) to top. Each lane def has a
   `type` that names an entry in LaneTypes. A lane type is an object with
   any of these hooks (all optional - see registerLaneType defaults):

     safe       true = can never kill you just for standing there
     respawn    true = counts as a checkpoint (you respawn on the last one)
     goal       true = reaching it wins the round
     init(lane, def, level)          create entities from the def
     update(lane, dt, game)          move entities
     drawBg(ctx, lane, view, game)   ground for this row
     drawEntities(ctx, lane, game)   things in this row
     land(lane, player, game)        player just landed here -> outcome
     grounded(lane, player, dt, game) every step while standing here -> outcome or null
     takeoff(lane, player, game)     player just jumped off this lane
     friction   number (1/s) - sideways-velocity decay on this surface
                (defaults to CONFIG.friction[type]; a level lane can set its own)

   Outcome objects: { ok: true } | { ok: true, ride: entity } | { die: 'splat'|'drown'|'fall'|'carried' }

   To add a new lane/hazard type, copy one of the registerLaneType blocks
   below (e.g. 'road'), give it a new name, and use that name in a level.
   ===================================================================== */
const LaneTypes = {};
const TAU = Math.PI * 2;

function registerLaneType(name, impl) {
  LaneTypes[name] = Object.assign({
    safe: false, respawn: false, goal: false,
    init() {}, update() {}, drawBg() {}, drawEntities() {},
    land() { return { ok: true }; },
    grounded() { return null; },
    takeoff() {}
  }, impl);
}

const World = {
  get T() { return CONFIG.world.tile; },
  get W() { return CONFIG.world.tile * CONFIG.world.columns; },
  get margin() { return CONFIG.world.offscreenMargin * CONFIG.world.tile; },
  rowCenter(row) { return -(row + 0.5) * CONFIG.world.tile; },
  feetY(row) { return -(row + 0.5 - CONFIG.world.feetOffset) * CONFIG.world.tile; },
  colX(col) { return (col + 0.5) * CONFIG.world.tile; }
};

function hash2(a, b) { // deterministic 0..1 noise for decoration
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/* ---------------- shared drawing helpers ---------------- */
function fillRow(ctx, lane, view, color) {
  ctx.fillStyle = color;
  ctx.fillRect(view.x0, lane.top, view.x1 - view.x0, World.T + 0.5);
}
function tiledOr(ctx, key, lane, view, game) {
  const T = World.T, x0 = Math.floor(view.x0 / T) * T;
  return Sprites.drawTiles(ctx, key, game.time, x0, lane.top, view.x1 - x0, T, T);
}

function drawGrass(ctx, lane, view, game) {
  const T = World.T;
  if (tiledOr(ctx, 'tile_grass', lane, view, game)) return;
  fillRow(ctx, lane, view, lane.index % 2 ? '#4c9a3f' : '#469139');
  const c0 = Math.floor(view.x0 / T), c1 = Math.ceil(view.x1 / T);
  for (let c = c0; c <= c1; c++) {
    const h = hash2(lane.index + 11, c + 1000);
    const x = c * T + hash2(c, lane.index) * T * 0.7 + 6, y = lane.top + 10 + hash2(lane.index, c * 7) * (T - 20);
    if (h < 0.45) {
      ctx.strokeStyle = 'rgba(30,80,25,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x - 4, y - 2); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 4);
      ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 5, y - 1); ctx.stroke();
    } else if (h < 0.55) {
      ctx.fillStyle = hash2(c, 3) < 0.5 ? '#ffe14d' : '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
    } else if (h < 0.6) {
      ctx.fillStyle = 'rgba(40,90,35,0.8)';
      ctx.beginPath(); ctx.ellipse(x, y, 7, 4, 0, 0, TAU); ctx.fill();
    }
  }
}

/* ======================= GRASS / START / GOAL ======================= */
registerLaneType('grass', { safe: true, respawn: true, drawBg: drawGrass });

registerLaneType('checkpoint', {
  safe: true, respawn: true,
  init(lane) { lane.reached = new Set(); },
  drawBg(ctx, lane, view, game) {
    drawGrass(ctx, lane, view, game);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < World.W; x += 16) ctx.fillRect(x, lane.bottom - 4, 8, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.font = '900 16px "Trebuchet MS", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('C H E C K P O I N T', World.W / 2, lane.y + 6);
  },
  drawEntities(ctx, lane, game) {
    const raised = lane.reached.size > 0;
    for (const x of [10, World.W - 10]) {
      const col = raised ? CONFIG.player.colors[[...lane.reached][0]] : '#e8e8e8';
      Sprites.draw(ctx, 'flag', 'idle', game.time, x, lane.y + 14, { color: col, raised, h: 40 });
    }
  },
  land(lane, p, game) {
    if (!lane.reached.has(p.idx)) {
      lane.reached.add(p.idx);
      Sfx.play('checkpoint');
      Effects.text(p.x, p.groundY - 56, 'CHECKPOINT', p.color, 13, 1.1);
      Effects.spawn('sparkle', p.x, p.groundY - 16, 10, { color: p.color });
    }
    return { ok: true };
  }
});

Sprites.registerPlaceholder('flag', (ctx, state, t, o) => {
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke();
  const top = o.raised ? -40 : -18, wave = Math.sin(t * 8) * 2;
  ctx.fillStyle = o.color || '#eee'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(14, top + 4 + wave); ctx.lineTo(0, top + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
});

registerLaneType('start', {
  safe: true, respawn: true,
  drawBg(ctx, lane, view, game) {
    drawGrass(ctx, lane, view, game);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.font = '900 26px "Trebuchet MS", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S T A R T', World.W / 2, lane.y + 4);
  }
});

registerLaneType('goal', {
  safe: true, respawn: true, goal: true,
  drawBg(ctx, lane, view, game) {
    if (tiledOr(ctx, 'tile_goal', lane, view, game)) return;
    const T = World.T, s = T / 4;
    fillRow(ctx, lane, view, '#3d7f33');
    for (let x = 0; x < World.W; x += s) for (let k = 0; k < 4; k++) {
      ctx.fillStyle = ((x / s + k) | 0) % 2 ? '#f5f5f5' : '#1c1c1c';
      ctx.fillRect(x, lane.top + k * s, s + 0.3, s + 0.3);
    }
    ctx.fillStyle = 'rgba(255,215,0,0.25)'; ctx.fillRect(0, lane.top, World.W, T);
    ctx.font = '900 22px "Trebuchet MS", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText('GOAL', World.W / 2, lane.y);
    ctx.fillStyle = '#ffd23f'; ctx.fillText('GOAL', World.W / 2, lane.y);
  }
});

/* =============================== ROAD =============================== */
function vehicleGap(v, px, hw) {
  const inset = CONFIG.road.vehicleInset;
  const vl = v.x - v.w / 2 + inset, vr = v.x + v.w / 2 - inset;
  return Math.max(vl - (px + hw), (px - hw) - vr);   // < 0 means overlapping
}

registerLaneType('road', {
  init(lane, def) {
    const sp = def.spawn || {};
    lane.pattern = sp.pattern || ['car'];
    lane.gapRange = sp.gap || [3, 5];
    lane.spawnIdx = (Math.random() * lane.pattern.length) | 0;
    lane.vehicles = [];
    lane.nextGap = this.randGap(lane);
    for (let i = 0; i < 900; i++) this.update(lane, 1 / 20);   // pre-fill the road
  },
  randGap(lane) { return (lane.gapRange[0] + Math.random() * (lane.gapRange[1] - lane.gapRange[0])) * World.T; },
  update(lane, dt) {
    const dir = lane.dir, W = World.W, m = World.margin;
    const entry = dir > 0 ? -m : W + m, exit = dir > 0 ? W + m : -m;
    for (const v of lane.vehicles) { v.x += v.vx * dt; v.t += dt; }
    lane.vehicles = lane.vehicles.filter((v) => dir * (v.x - exit) < v.w);
    if (lane.spawnPaused) return;
    const last = lane.vehicles[lane.vehicles.length - 1];
    if (!last || dir * ((last.x - dir * last.w / 2) - entry) >= lane.nextGap) {
      const type = lane.pattern[lane.spawnIdx++ % lane.pattern.length];
      const v = createEntity(type, { y: lane.y, vx: dir * lane.speed });
      v.x = entry - dir * v.w / 2;
      lane.vehicles.push(v);
      lane.nextGap = this.randGap(lane);
    }
  },
  drawBg(ctx, lane, view, game) {
    const T = World.T;
    if (!tiledOr(ctx, 'tile_road', lane, view, game)) {
      fillRow(ctx, lane, view, '#3b3e45');
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = Math.floor(view.x0 / 23) * 23; x < view.x1; x += 23) ctx.fillRect(x + hash2(x, lane.index) * 9, lane.top + hash2(lane.index, x) * T, 2, 2);
    }
    const above = lane.above, below = lane.below;
    if (above && above.type === 'road') {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let x = Math.floor(view.x0 / 40) * 40; x < view.x1; x += 40) ctx.fillRect(x, lane.top - 1.5, 22, 3);
    } else {
      ctx.fillStyle = '#9a9a9a'; ctx.fillRect(view.x0, lane.top, view.x1 - view.x0, 4);
      ctx.fillStyle = '#d0d0d0'; ctx.fillRect(view.x0, lane.top, view.x1 - view.x0, 2);
    }
    if (!below || below.type !== 'road') {
      ctx.fillStyle = '#9a9a9a'; ctx.fillRect(view.x0, lane.bottom - 4, view.x1 - view.x0, 4);
    }
  },
  drawEntities(ctx, lane) { for (const v of lane.vehicles) drawEntity(ctx, v); },
  grounded(lane, p) {
    for (const v of lane.vehicles) if (vehicleGap(v, p.x, CONFIG.player.hitHalfWidth) < 0) return { die: 'splat', by: v };
    return null;
  },
  land(lane, p, game) {
    let minGap = Infinity;
    for (const v of lane.vehicles) {
      const g = vehicleGap(v, p.x, CONFIG.player.hitHalfWidth);
      if (g < 0) return { die: 'splat', by: v };
      minGap = Math.min(minGap, g);
    }
    if (minGap < CONFIG.road.landCloseGap) game.closeCall(p, 'close shave');
    return { ok: true };
  },
  takeoff(lane, p, game) {
    for (const v of lane.vehicles) {
      const approaching = Math.sign(p.x - v.x) === Math.sign(v.vx);
      const g = vehicleGap(v, p.x, CONFIG.player.hitHalfWidth);
      if (approaching && g >= 0 && g < CONFIG.road.takeoffCloseGap) { game.closeCall(p, 'whoosh!'); return; }
    }
  }
});

function gauss() { // standard normal random number
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

/* =============================== RIVER ==============================
   Logs ride a ring that is (world width + 2*margin) long, so they wrap
   off-screen. Each log's speed wanders around the lane's mean speed;
   faster logs catch up and bump slower ones (1D collisions, mass = length,
   restitution in config), so landing spots keep shifting.
   =================================================================== */
registerLaneType('river', {
  init(lane, def) {
    const W = World.W, m = CONFIG.river.wrapMargin * World.T, L = W + 2 * m;
    lane.wrapMargin = m;
    lane.ringLength = L;
    const list = def.logs || [{ len: 3, speed: lane.speed || 50 }];
    const n = list.length, spacing = L / n;
    lane.logs = list.map((ld, i) => {
      const log = createEntity('log', { len: ld.len, y: lane.y, seed: 1 + ((Math.random() * 97) | 0) });
      const slack = Math.max(0, spacing - log.w) * 0.35;
      log.x = -m + (i + 0.5) * spacing + (Math.random() * 2 - 1) * slack;
      log.speed = ld.speed !== undefined ? ld.speed : lane.speed;
      log.vx = lane.dir * log.speed;
      log.bumpT = 0; log.sinkV = 0;
      return log;
    });
    // Logs start at their own level-file speeds, then each log's speed wanders randomly around the
    // lane's mean speed: faster logs catch up and bump slower ones, then things spread out again.
    lane.meanSpeed = lane.logs.reduce((a, l) => a + l.speed, 0) / lane.logs.length;
    for (const log of lane.logs) log.dv = log.speed - lane.meanSpeed;
    lane.lastBumpSound = 0;
    for (let i = 0; i < 300; i++) this.update(lane, 1 / 20, null);  // settle into a natural spread
  },
  update(lane, dt, game) {
    const R = CONFIG.river, W = World.W, m = lane.wrapMargin, L = lane.ringLength;
    lane.t += dt;
    for (const log of lane.logs) {
      log.t += dt;
      const sigma = R.speedJitter * lane.meanSpeed * Math.sqrt(2 / R.driftTime);
      log.dv += -log.dv / R.driftTime * dt + sigma * Math.sqrt(dt) * gauss();
      log.dv = Math.max(-0.85 * lane.meanSpeed, Math.min(0.85 * lane.meanSpeed, log.dv));
      const target = lane.dir * (lane.meanSpeed + log.dv);
      log.vx += (target - log.vx) * Math.min(1, R.currentPull * dt);
      log.x += log.vx * dt;
      if (log.x > W + m) log.x -= L;
      else if (log.x < -m) log.x += L;
      // bob spring (sinks when landed on)
      log.sinkV += (-log.bob * 120 - log.sinkV * 9) * dt;
      log.bob += log.sinkV * dt;
      log.bumpT = Math.max(0, log.bumpT - dt);
    }
    const logs = lane.logs.slice().sort((a, b) => a.x - b.x), n = logs.length;
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const a = logs[i], b = logs[(i + 1) % n];
      const wrap = i === n - 1 ? L : 0;
      const overlap = (a.x + a.w / 2) - (b.x + wrap - b.w / 2);
      if (overlap <= 0) continue;
      const ma = a.len, mb = b.len, M = ma + mb;
      a.x -= overlap * mb / M; b.x += overlap * ma / M;
      const rel = a.vx - b.vx;
      if (rel > 0) {
        const e = R.restitution, P = ma * a.vx + mb * b.vx;
        a.vx = (P - mb * e * rel) / M;
        b.vx = (P + ma * e * rel) / M;
        if (game) this.onBump(lane, a, b, rel, a.x + a.w / 2, game);
      }
    }
  },
  onBump(lane, a, b, impact, cx, game) {
    if (impact < 6) return;
    a.bumpT = b.bumpT = Math.min(0.25, impact / 250);
    if (cx > -10 && cx < World.W + 10) {
      Effects.spawn('bumpspark', cx, lane.y, Math.min(10, 2 + (impact / 10) | 0));
      if (game.time - lane.lastBumpSound > 0.25 && impact > 14) { Sfx.play('bump'); lane.lastBumpSound = game.time; }
      const ridden = game.players.some((p) => p.ride === a || p.ride === b);
      if (ridden) Camera.shake(CONFIG.shake.bump * impact / 100);
    }
  },
  drawBg(ctx, lane, view, game) {
    const T = World.T, t = game.time;
    if (!tiledOr(ctx, 'tile_water', lane, view, game)) {
      fillRow(ctx, lane, view, lane.index % 2 ? '#2d74bd' : '#2a6db3');
      ctx.strokeStyle = 'rgba(190,225,255,0.28)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const yy = lane.top + 9 + k * 14, off = (t * lane.dir * (18 + k * 6)) % 60;
        for (let x = Math.floor(view.x0 / 60) * 60 - 60; x < view.x1 + 60; x += 60) {
          const xx = x + off + hash2(k, lane.index) * 30;
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 7, yy - 3, xx + 14, yy); ctx.stroke();
        }
      }
    }
    if (!lane.above || lane.above.type !== 'river') { // far bank shadow
      ctx.fillStyle = 'rgba(10,30,60,0.35)'; ctx.fillRect(view.x0, lane.top, view.x1 - view.x0, 5);
    }
    if (!lane.below || lane.below.type !== 'river') { // near bank foam
      ctx.fillStyle = 'rgba(230,245,255,0.55)';
      for (let x = Math.floor(view.x0 / 16) * 16; x < view.x1; x += 16) {
        const h = 2 + Math.sin(x * 0.3 + t * 3) * 1.5;
        ctx.fillRect(x, lane.bottom - h, 12, h);
      }
    }
  },
  drawEntities(ctx, lane) { for (const log of lane.logs) drawEntity(ctx, log, false); },
  land(lane, p, game) {
    const R = CONFIG.river, W = World.W;
    if (p.x < -R.worldEdgeGrace || p.x > W + R.worldEdgeGrace) return { die: 'drown' };
    let best = null, bestEdge = -Infinity;
    for (const log of lane.logs) {
      const edge = log.w / 2 - Math.abs(p.x - log.x);
      if (edge > bestEdge) { bestEdge = edge; best = log; }
    }
    if (!best || bestEdge < -R.landTolerance) return { die: 'drown' };
    if (bestEdge < R.edgeCloseCall) game.closeCall(p, 'edge!');
    best.sinkV += 30 + p.lastJumpRows * 12;
    return { ok: true, ride: best };
  },
  grounded(lane, p, dt, game) {
    const R = CONFIG.river, W = World.W, log = p.ride;
    if (!log) return { die: 'drown' };
    // rider inertia: you keep your own velocity and slowly match the log (slides after bumps)
    p.rideOffset += (p.riderVx - log.vx) * dt;
    p.riderVx += (log.vx - p.riderVx) * Math.min(1, lane.friction * dt);
    p.x = log.x + p.rideOffset;
    if (p.x < -R.worldEdgeGrace || p.x > W + R.worldEdgeGrace) return { die: 'carried' };
    const edge = log.w / 2 - Math.abs(p.rideOffset);
    if (edge < -R.landTolerance) return { die: 'fall' };
    if (edge < R.edgeSafe) {
      if (p.teeterT === 0) { Sfx.play('teeter'); }
      p.teeterT += dt;
      p.teeterSide = Math.sign(p.rideOffset) || 1;
      if (p.teeterT > R.teeterGrace) return { die: 'fall' };
    } else p.teeterT = 0;
    return null;
  }
});

/* ============================ LEVEL BUILDER ============================ */
const LEVELS = window.LEVELS || (window.LEVELS = []);

/** Expand lane defs with  rows: N  (open areas, plains) into N single-row lanes sharing a region. */
function expandLanes(defs) {
  const flat = [];
  for (const ld of defs) {
    const n = ld.rows || 1;
    if (n <= 1) { flat.push(ld); continue; }
    const region = { def: ld, startRow: flat.length, rows: n, field: null };
    for (let k = 0; k < n; k++) {
      flat.push(Object.assign({}, ld, { rows: 1, region, regionRow: k, items: (ld.items || []).filter((it) => (it.row || 0) === k) }));
    }
  }
  return flat;
}

function buildLevel(def) {
  const T = World.T;
  const lanesDef = expandLanes(def.lanes);
  const level = { def, name: def.name || 'Level', lanes: [], rows: lanesDef.length, goalRow: lanesDef.length - 1 };
  lanesDef.forEach((ld, i) => {
    const impl = LaneTypes[ld.type];
    if (!impl) throw new Error(`Level "${level.name}": unknown lane type "${ld.type}" at row ${i}`);
    level.lanes.push({
      index: i, type: ld.type, def: ld, impl,
      y: World.rowCenter(i), top: -(i + 1) * T, bottom: -i * T,
      dir: ld.dir || 1, speed: ld.speed || 0, items: [], t: 0,
      friction: ld.friction !== undefined ? ld.friction
        : impl.friction !== undefined ? impl.friction
        : (CONFIG.friction[ld.type] !== undefined ? CONFIG.friction[ld.type] : CONFIG.friction.default)
    });
  });
  level.lanes.forEach((lane, i) => { lane.below = level.lanes[i - 1] || null; lane.above = level.lanes[i + 1] || null; });
  level.lanes.forEach((lane) => {
    lane.impl.init(lane, lane.def, level);
    lane.items = (lane.def.items || []).map((it) => createEntity(it.type, { x: World.colX(it.col), y: lane.y, respawnT: 0 }));
  });
  for (let i = level.lanes.length - 1; i >= 0; i--) if (level.lanes[i].impl.goal) { level.goalRow = i; break; }
  return level;
}
