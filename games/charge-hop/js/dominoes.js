/* =====================================================================
   dominoes.js - OPEN PLAINS with DOMINOES.

   A plain is a multi-row lane in a level:
     { type: 'plain', rows: 8, name: 'Domino Meadow', dominoes: [ ...patterns ], items: [...] }
   Pattern coordinates are PLAIN-RELATIVE: [col, row] where col 0..13 runs
   left->right in tiles (fractions allowed) and row 0 is the plain's bottom row.
   Patterns (see DOMINO_PATTERNS below):
     { pattern: 'line',   from: [c, r], to: [c, r] }
     { pattern: 'path',   points: [[c, r], [c, r], ...], smooth: true }     (S-shapes, turns)
     { pattern: 'wave',   from: [c, r], to: [c, r], amp: 1, waves: 1 }      (sine / S-curve)
     { pattern: 'arc',    center: [c, r], radius: 3, from: 0, to: 180 }     (degrees)
     { pattern: 'spiral', center: [c, r], r0: 0.8, r1: 4, turns: 2, start: 0 }
     { pattern: 'zigzag', from: [c, r], to: [c, r], amp: 1, teeth: 4 }
     { pattern: 'grid',   from: [c, r], cols: 6, rows: 3, dx: 1, dy: 1, axis: 'h'|'v'|'d', gaps: [[i, j], ...] }
   Optional on any pattern: spacing (px between dominoes, default CONFIG.domino.spacing),
   gaps: [index, ...] (skip those dominoes -> breaks the chain, opens a path).

   Rules: standing dominoes block (landing on / sliding into one topples it,
   knocks you back and stuns you briefly); toppling chains along the pattern;
   fallen dominoes are low obstacles: a running streak hop bonks into them,
   a deliberate tap hop vaults one fallen row, charged jumps vault up to
   CONFIG.domino.chargeVault more; a bonk glances you sideways (past fallen
   tiles in your own row) so you can never get boxed in.
   ===================================================================== */

/* ---------- pattern generators: return a polyline in plain coords [[c, r], ...] ---------- */
const DOMINO_PATTERNS = {
  line: (p) => [p.from, p.to],
  path: (p) => (p.smooth ? catmull(p.points) : p.points),
  wave: (p) => {
    const [c0, r0] = p.from, [c1, r1] = p.to, amp = p.amp === undefined ? 1 : p.amp, waves = p.waves || 1;
    const vertical = Math.abs(r1 - r0) > Math.abs(c1 - c0), out = [];
    for (let i = 0; i <= 96; i++) {
      const t = i / 96, o = amp * Math.sin(t * waves * TAU);
      out.push(vertical ? [c0 + (c1 - c0) * t + o, r0 + (r1 - r0) * t] : [c0 + (c1 - c0) * t, r0 + (r1 - r0) * t + o]);
    }
    return out;
  },
  arc: (p) => {
    const [cx, cy] = p.center, R = p.radius, a0 = (p.from || 0) * Math.PI / 180, a1 = (p.to === undefined ? 180 : p.to) * Math.PI / 180, out = [];
    for (let i = 0; i <= 64; i++) { const a = a0 + (a1 - a0) * i / 64; out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    return out;
  },
  spiral: (p) => {
    const [cx, cy] = p.center, r0 = p.r0 || 0.8, r1 = p.r1 || 4, turns = p.turns || 2, s = (p.start || 0) * Math.PI / 180, out = [];
    const n = Math.ceil(160 * turns);
    for (let i = 0; i <= n; i++) { const t = i / n, a = s + t * turns * TAU, R = r0 + (r1 - r0) * t; out.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    return out;
  },
  zigzag: (p) => {
    const [c0, r0] = p.from, [c1, r1] = p.to, teeth = p.teeth || 4, amp = p.amp === undefined ? 1 : p.amp;
    const dx = c1 - c0, dy = r1 - r0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, out = [];
    for (let i = 0; i <= teeth * 2; i++) {
      const t = i / (teeth * 2), o = i === 0 || i === teeth * 2 ? 0 : (i % 2 ? amp : -amp);
      out.push([c0 + dx * t + nx * o, r0 + dy * t + ny * o]);
    }
    return out;
  }
};

function catmull(pts) {
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** evenly resample a world-space polyline every `spacing` px */
function resample(poly, spacing) {
  const out = [poly[0].slice()];
  let carry = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[i + 1], seg = Math.hypot(x1 - x0, y1 - y0);
    let d = spacing - carry;
    while (d <= seg) { const t = d / seg; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); d += spacing; }
    carry = seg - (d - spacing);
  }
  return out;
}

/* ---------------------------- the field ---------------------------- */
class DominoField {
  constructor(region, level) {
    this.region = region;
    this.dominoes = [];
    this.active = new Set();
    this.chains = {};
    this.nextChain = 1;
    this.drawStamp = -1;
    this.lastClick = 0;
    const C = CONFIG.domino, T = World.T;
    // v3 'run' plains (open straights): soft rules - dominoes never block, passing them topples them,
    // fallen ones (and boulders) only slow you down. v2 plains (no run flag) keep the v2 rules.
    this.soft = !!region.def.run;
    this.boulders = (region.def.boulders || []).map(([c, r]) => ({ x: c * T, y: World.feetY(region.startRow + r), r: 15 + ((c * 7 + r * 3) % 4) }));
    const toWorld = (c, r) => [c * T, World.feetY(region.startRow + r)];
    (region.def.dominoes || []).forEach((pat) => {
      const gaps = new Set((pat.gaps && !Array.isArray(pat.gaps[0])) ? pat.gaps : []);
      if (pat.pattern === 'grid') {
        const cellGaps = new Set((pat.gaps || []).filter(Array.isArray).map(([i, j]) => i + ',' + j));
        const ax = pat.axis === 'v' ? [0, -1] : pat.axis === 'd' ? [Math.SQRT1_2, -Math.SQRT1_2] : [1, 0];
        for (let j = 0; j < (pat.rows || 1); j++) for (let i = 0; i < (pat.cols || 1); i++) {
          if (cellGaps.has(i + ',' + j)) continue;
          const [x, y] = toWorld(pat.from[0] + i * (pat.dx || 1), pat.from[1] + j * (pat.dy || 1));
          this.add(x, y, ax[0], ax[1]);
        }
        return;
      }
      const gen = DOMINO_PATTERNS[pat.pattern];
      if (!gen) throw new Error('Unknown domino pattern: ' + pat.pattern);
      const pts = resample(gen(pat).map(([c, r]) => toWorld(c, r)), pat.spacing || C.spacing);
      pts.forEach((pt, i) => {
        if (gaps.has(i)) return;
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        this.add(pt[0], pt[1], dx / l, dy / l);
      });
    });
    this.dominoes.forEach((d, i) => { d.id = i; });
  }

  add(x, y, ax, ay) {
    if (x < 6 || x > World.W - 6) return;   // keep inside the playfield
    this.dominoes.push({
      x, y, ax, ay, fdx: ax, fdy: ay, state: 'standing', t: 0, theta: 0, settle: 0,
      pips: [(Math.random() * 7) | 0, (Math.random() * 7) | 0], shade: (Math.random() * 3) | 0,
      chain: 0, triggered: false
    });
  }

  get fallenCount() { return this.dominoes.filter((d) => d.state !== 'standing').length; }

  /** start a domino falling in direction (fx, fy) */
  topple(d, fx, fy, chain, game) {
    if (d.state !== 'standing') return false;
    const l = Math.hypot(fx, fy) || 1;
    d.state = 'falling'; d.t = 0; d.fdx = fx / l; d.fdy = fy / l;
    d.chain = chain || this.nextChain++;
    const ch = this.chains[d.chain] || (this.chains[d.chain] = { count: 0, slowmo: false });
    ch.count++;
    this.active.add(d);
    if (game) this.chainDrama(d, ch, game);
    return true;
  }

  /** push a domino away from a point (player position) */
  toppleAwayFrom(d, px, py, game) {
    let s = d.ax * (d.x - px) + d.ay * (d.y - py);
    if (Math.abs(s) < 3) s = d.ay <= 0 ? -d.ay || 1 : -1;   // straight-on: fall forward (up the screen)
    const sg = s >= 0 ? 1 : -1;
    return this.topple(d, sg * d.ax, sg * d.ay, 0, game);
  }

  chainDrama(d, ch, game) {
    const C = CONFIG.domino;
    if (ch.slowmo || ch.count < C.slowmoChain) return;
    let best = null, bd = C.slowmoRadius * World.T;
    for (const p of game.active) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.x - d.x, p.groundY - d.y);
      if (dist < bd) { bd = dist; best = p; }
    }
    if (best && game.closeCall(best, 'CHAIN!')) ch.slowmo = true;
  }

  update(dt, game) {
    const C = CONFIG.domino;
    if (this.soft && game) this.brush(game);
    for (const d of this.active) {
      d.t += dt;
      const p = Math.min(1, d.t / C.fallTime);
      if (d.state === 'falling') {
        d.theta = (Math.PI / 2) * p * p;   // accelerates like it's really tipping over
        if (!d.triggered && p >= C.triggerAt) { d.triggered = true; this.propagate(d, game); }
        if (p >= 1) { d.state = 'fallen'; d.settle = 0; this.onFallen(d, game); }
      } else {
        d.settle += dt;
        d.theta = Math.PI / 2 - Math.sin(Math.min(1, d.settle / 0.16) * Math.PI) * 0.07 * Math.exp(-d.settle * 10);
        if (d.settle > 0.2) { d.theta = Math.PI / 2; this.active.delete(d); }
      }
    }
  }

  propagate(a, game) {
    const C = CONFIG.domino, reach = C.height + C.thickness / 2 + C.reachSlack, cosCone = Math.cos(C.coneDeg * Math.PI / 180);
    for (const b of this.dominoes) {
      if (b.state !== 'standing') continue;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
      if (dist > reach || dist < 0.5) continue;
      if ((dx * a.fdx + dy * a.fdy) / dist < cosCone) continue;
      let s = (b.ax * dx + b.ay * dy) / dist;
      if (Math.abs(s) < 0.25) s = b.ax * a.fdx + b.ay * a.fdy;
      const sg = s >= 0 ? 1 : -1;
      this.topple(b, sg * b.ax, sg * b.ay, a.chain, game);
    }
  }

  onFallen(d, game) {
    const C = CONFIG.domino;
    const tipX = d.x + d.fdx * (C.height * 0.85), tipY = d.y + d.fdy * (C.height * 0.85);
    Effects.spawn('dust', tipX, tipY, 3);
    if (game && game.time - this.lastClick > C.clickGap) { Sfx.play('click'); this.lastClick = game.time; }
    if (!game || this.soft) return;
    for (const p of game.active) {   // landed on a player standing there: a gentle bonk
      if (!p.grounded || p.state === 'win' || p.row < this.region.startRow || p.row >= this.region.startRow + this.region.rows) continue;
      if (this.overlap(d, p.x, World.feetY(p.row))) { p.stun(C.landOnPlayerStun, 'BONK'); }
    }
  }

  /* ---------- geometry ---------- */
  aabb(d) {
    const C = CONFIG.domino;
    const hv = C.width / 2;
    let hu, cx = d.x, cy = d.y, ux = d.ax, uy = d.ay;
    if (d.state === 'standing') hu = C.thickness / 2;
    else {
      const ext = C.height * Math.sin(d.theta);
      hu = (C.thickness + ext) / 2; ux = d.fdx; uy = d.fdy;
      cx += ux * ext / 2; cy += uy * ext / 2;
    }
    const hx = Math.abs(ux) * hu + Math.abs(uy) * hv, hy = Math.abs(uy) * hu + Math.abs(ux) * hv;
    return [cx - hx, cx + hx, cy - hy, cy + hy];
  }
  overlap(d, x, feetY) {
    const C = CONFIG.domino, hw = CONFIG.player.hitHalfWidth;
    const [x0, x1, y0, y1] = this.aabb(d);
    return x1 > x - hw && x0 < x + hw && y1 > feetY - C.footBand[0] && y0 < feetY + C.footBand[1];
  }
  standingAt(x, row) { const fy = World.feetY(row); return this.dominoes.filter((d) => d.state === 'standing' && this.overlap(d, x, fy)); }
  fallenAt(x, row, includeFalling = true) {
    const fy = World.feetY(row);
    return this.dominoes.some((d) => (d.state === 'fallen' || (includeFalling && d.state === 'falling' && d.theta > 0.6)) && this.overlap(d, x, fy));
  }
  inRegion(row) { return row >= this.region.startRow && row < this.region.startRow + this.region.rows; }

  /* ---------- player interaction ---------- */
  boulderAt(x, row) {
    const fy = World.feetY(row), hw = CONFIG.player.hitHalfWidth;
    return this.boulders.some((b) => Math.abs(b.x - x) < b.r + hw && Math.abs(b.y - fy) < 18);
  }
  /** v3: anyone passing next to / over a standing domino tips it (away from them) */
  brush(game) {
    const R = CONFIG.domino.brushRadius, y0 = World.feetY(this.region.startRow) + 30, y1 = World.feetY(this.region.startRow + this.region.rows - 1) - 30;
    for (const p of game.active) {
      if (!p.alive || p.satOut) continue;
      const py = p.groundY;
      if (py > y0 || py < y1) continue;
      for (const d of this.dominoes) {
        if (d.state !== 'standing' || Math.abs(d.x - p.x) > R || Math.abs(d.y - py) > R * 0.8) continue;
        this.toppleAwayFrom(d, p.x, py + 20, game);
      }
    }
  }

  onLand(p, game) {
    if (this.soft) return { ok: true, slow: this.fallenAt(p.x, p.row, false) || this.boulderAt(p.x, p.row) };
    const standing = this.standingAt(p.x, p.row);
    if (standing.length) {
      const fromY = World.feetY(p.fromRow);
      standing.forEach((d) => this.toppleAwayFrom(d, p.x, fromY, game));
      Sfx.play('thud'); Camera.shake(1.5);
      return { bounce: true, stun: CONFIG.domino.bumpStun };
    }
    if (this.fallenAt(p.x, p.row, false)) { Sfx.play('thud'); return { bounce: true, stun: 0 }; }
    return { ok: true };
  }

  onGrounded(p, dt, game) {
    if (this.soft) return;
    if (p.glanceT > 0) p.glanceT -= dt;
    if (p.vx === 0 || p.prevX === undefined || p.prevX === p.x) return;
    const fy = World.feetY(p.row);
    const hitStanding = this.dominoes.filter((d) => d.state === 'standing' && this.overlap(d, p.x, fy));
    if (hitStanding.length) {
      hitStanding.forEach((d) => this.toppleAwayFrom(d, p.prevX, fy, game));
      p.x = p.prevX; p.vx = -p.vx * CONFIG.domino.knockback;
      Sfx.play('thud');
      p.stun(CONFIG.domino.bumpStun * 0.7, 'BUMP');
      return;
    }
    const nowFallen = this.dominoes.some((d) => d.state === 'fallen' && this.overlap(d, p.x, fy));
    const wasFallen = this.dominoes.some((d) => d.state === 'fallen' && this.overlap(d, p.prevX, fy));
    if (nowFallen && !wasFallen && !(p.glanceT > 0)) { p.x = p.prevX; p.vx = 0; }
  }

  /** decide where a jump that ends in this plain really lands */
  planJump(p, toRow, running, game) {
    if (this.soft || !this.fallenAt(p.x, toRow)) return toRow;
    if (running) return this.deflect(p, toRow);         // pitter-patter run straight into a fallen domino
    // a deliberate tap vaults 1 fallen row; a charged jump can carry over up to CONFIG.domino.chargeVault more
    const extra = toRow - p.row >= 2 ? CONFIG.domino.chargeVault : 1;
    for (let k = 1; k <= extra; k++) {
      const r = toRow + k;
      if (r > game.level.goalRow) break;
      const nl = game.level.lanes[r];
      if (!(nl.field === this && this.fallenAt(p.x, r))) return r;
    }
    return this.deflect(p, toRow);
  }

  /** bonk: glance off the blocking domino sideways, toward the nearest open column of the blocked row,
      with just enough speed to get there (capped) - so you can never get boxed in behind fallen dominoes */
  deflect(p, row) {
    const C = CONFIG.domino, hw = CONFIG.player.hitHalfWidth;
    let best = null;
    for (let dx = 4; dx < World.W && best === null; dx += 4) {
      for (const sg of (p.x < World.W / 2 ? [1, -1] : [-1, 1])) {   // ties: prefer heading toward the middle
        const x = p.x + sg * dx;
        if (x < hw || x > World.W - hw) continue;
        if (!this.fallenAt(x, row)) { best = sg * (dx + 6); break; }
      }
    }
    if (best === null) best = (p.x < World.W / 2 ? 1 : -1) * 40;
    const fr = CONFIG.friction.plain || 6;               // ground slides decay at this rate: distance = v / friction
    const v = Math.min(C.deflectMax, Math.max(C.deflect, Math.abs(best) * fr));
    p.vx = Math.sign(best) * v;
    p.glanceT = C.glanceTime;                           // the glance may slide past fallen tiles in your own row
    return 'bonk';
  }

  /* ---------- drawing ---------- */
  draw(ctx, view) {
    const C = CONFIG.domino;
    for (const b of this.boulders) {
      if (b.y < view.y0 - 40 || b.y > view.y1 + 40) continue;
      Sprites.draw(ctx, 'boulder', 'idle', 0, b.x, b.y, { r: b.r, w: b.r * 2.2, h: b.r * 1.8 });
    }
    const list = this.dominoes.filter((d) => d.y > view.y0 - 60 && d.y < view.y1 + 60 && d.x > view.x0 - 60 && d.x < view.x1 + 60);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) {
      const state = d.state;
      const angle = Math.atan2(d.fdx, -d.fdy);       // art is drawn falling toward the top of the image
      const hasArt = Sprites.has('domino', state);
      const prog = state === 'standing' ? 0 : d.theta / (Math.PI / 2);
      Sprites.draw(ctx, 'domino', state, prog, d.x, d.y, hasArt
        ? { rot: angle, w: C.width, h: state === 'standing' ? C.thickness + 4 : C.thickness + C.height * Math.sin(d.theta), progress: prog }
        : { domino: d });
    }
  }
}

/* ---------- domino placeholder: crisp retro 3D tile (dark with white pips) ---------- */
const DOMINO_SHADES = [['#1c1f29', '#2e3342', '#4a5166'], ['#1f1b29', '#332e44', '#514a68'], ['#18212a', '#2b3845', '#45576a']];
const PIP_LAYOUT = [[], [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [2, 0], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]];

Sprites.registerPlaceholder('domino', (ctx, state, t, o) => {
  const d = o.domino; if (!d) return;
  const C = CONFIG.domino, W = C.width, D = C.thickness, H = C.height, K = C.obliqueK;
  const th = d.theta, ch = Math.cos(th), sh = Math.sin(th), hu = D / 2;
  const ax = d.fdx, ay = d.fdy, px = -ay, py = ax;   // fall axis & its perpendicular (ground plane)
  // box corner in local (u along fall, v across, z up) -> screen, rotating about the front-bottom hinge
  const P = (u, v, z) => {
    const uu = hu + (u - hu) * ch + z * sh, zz = -(u - hu) * sh + z * ch;
    return [uu * ax + v * px, uu * ay + v * py - zz * K];
  };
  const N = (nu, nv, nz) => { // rotated normal in world (x, y, z)
    const uu = nu * ch + nz * sh, zz = -nu * sh + nz * ch;
    return [uu * ax + nv * px, uu * ay + nv * py, zz];
  };
  // shadow (light from upper-left)
  const ext = D + H * sh + H * ch * 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  for (const [u, v] of [[-hu, -W / 2], [-hu + ext, -W / 2], [-hu + ext, W / 2], [-hu, W / 2]]) ctx.lineTo(u * ax + v * px + 3, u * ay + v * py + 3);
  ctx.fill();
  const shade = DOMINO_SHADES[d.shade || 0];
  const faces = [ // [corners (u,v,z)], normal, kind
    [[[-hu, -W / 2, 0], [-hu, W / 2, 0], [-hu, W / 2, H], [-hu, -W / 2, H]], [-1, 0, 0], 'pips'],
    [[[hu, -W / 2, 0], [hu, W / 2, 0], [hu, W / 2, H], [hu, -W / 2, H]], [1, 0, 0], 'pips'],
    [[[-hu, -W / 2, H], [hu, -W / 2, H], [hu, W / 2, H], [-hu, W / 2, H]], [0, 0, 1], 'end'],
    [[[-hu, -W / 2, 0], [hu, -W / 2, 0], [hu, W / 2, 0], [-hu, W / 2, 0]], [0, 0, -1], 'end'],
    [[[-hu, -W / 2, 0], [hu, -W / 2, 0], [hu, -W / 2, H], [-hu, -W / 2, H]], [0, -1, 0], 'side'],
    [[[-hu, W / 2, 0], [hu, W / 2, 0], [hu, W / 2, H], [-hu, W / 2, H]], [0, 1, 0], 'side']
  ];
  ctx.lineJoin = 'miter';
  for (const [corners, n, kind] of faces) {
    const wn = N(n[0], n[1], n[2]);
    const facing = wn[1] * K + wn[2];
    if (facing <= 0.02) continue;
    const pts = corners.map((c) => P(c[0], c[1], c[2]));
    const up = Math.max(0, wn[2]);
    ctx.fillStyle = kind === 'pips' ? (up > 0.7 ? shade[1] : shade[0]) : kind === 'end' ? shade[2] : shade[1];
    ctx.beginPath(); pts.forEach((q) => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#06070a'; ctx.lineWidth = 1.2; ctx.stroke();
    if (kind === 'pips' && facing > 0.25) {
      // bilinear map (s across, t up the tile) -> screen
      const [c00, c10, c11, c01] = pts;   // (v-,z0) (v+,z0) (v+,zH) (v-,zH)
      const M = (s, tt) => [
        c00[0] * (1 - s) * (1 - tt) + c10[0] * s * (1 - tt) + c11[0] * s * tt + c01[0] * (1 - s) * tt,
        c00[1] * (1 - s) * (1 - tt) + c10[1] * s * (1 - tt) + c11[1] * s * tt + c01[1] * (1 - s) * tt];
      const a = M(0.15, 0.5), b = M(0.85, 0.5);
      ctx.strokeStyle = '#8a90a2'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.fillStyle = '#f4f4f0';
      const ps = Math.max(1.4, 2.6 * Math.min(1, facing + 0.2));
      d.pips.forEach((val, half) => {
        for (const [gx, gy] of PIP_LAYOUT[val]) {
          const q = M(0.25 + gx * 0.25, half * 0.5 + 0.1 + gy * 0.15);
          ctx.fillRect(Math.round(q[0] * 2) / 2 - ps / 2, Math.round(q[1] * 2) / 2 - ps / 2, ps, ps);
        }
      });
    }
    if (kind === 'end') { // bevel highlight on the top edge
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke();
    }
  }
});

/* ============================ PLAIN lane type ============================ */
registerLaneType('plain', {
  safe: true, respawn: false,
  init(lane, def, level) {
    const reg = def.region || { def, startRow: lane.index, rows: 1 };
    if (!reg.field) reg.field = new DominoField(reg, level);
    lane.field = reg.field; lane.region = reg;
    lane.run = !!(reg.def && reg.def.run);          // v3 open straight: auto-run (player.js)
  },
  update(lane, dt, game) { if ((lane.def.regionRow || 0) === 0) lane.field.update(dt, game); },
  drawBg(ctx, lane, view, game) {
    const T = World.T, s = T / 2;
    if (!tiledOr(ctx, 'tile_plain', lane, view, game)) {
      fillRow(ctx, lane, view, '#cdb985');
      const x0 = Math.floor(view.x0 / s) * s;
      for (let x = x0; x < view.x1; x += s) for (let k = 0; k < 2; k++) {
        if (((x / s) + k + lane.index) % 2 === 0) { ctx.fillStyle = '#c4af7a'; ctx.fillRect(x, lane.top + k * s, s, s); }
      }
      ctx.fillStyle = 'rgba(110,90,50,0.35)';
      for (let x = x0; x < view.x1; x += s) {
        const h = hash2(x, lane.index * 3);
        if (h < 0.3) ctx.fillRect(x + h * 40, lane.top + hash2(lane.index, x) * (T - 4), 2, 2);
      }
    }
    const r = lane.def.regionRow || 0, rows = lane.region ? lane.region.rows : 1;
    if (r === rows - 1) { ctx.fillStyle = 'rgba(70,50,20,0.45)'; ctx.fillRect(view.x0, lane.top, view.x1 - view.x0, 3); }
    if (r === 0) {
      ctx.fillStyle = 'rgba(70,50,20,0.45)'; ctx.fillRect(view.x0, lane.bottom - 3, view.x1 - view.x0, 3);
      if (lane.region && lane.region.def.name) {
        ctx.fillStyle = 'rgba(90,70,30,0.35)'; ctx.font = `900 18px "Trebuchet MS", Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lane.region.def.name.toUpperCase().split('').join(' '), World.W / 2, lane.y + 8);
      }
    }
  },
  drawEntities(ctx, lane, game) {
    if (lane.field.drawStamp === game.frame) return;
    lane.field.drawStamp = game.frame;
    lane.field.draw(ctx, Camera.visibleRect());
  },
  land(lane, p, game) { return lane.field.onLand(p, game); },
  grounded(lane, p, dt, game) { lane.field.onGrounded(p, dt, game); return null; },
  planJump(lane, p, toRow, running, game) { return lane.field.planJump(p, toRow, running, game); }
});
