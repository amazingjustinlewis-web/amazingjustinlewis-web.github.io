/* =====================================================================
   characters.js - CHARACTER PROXIES (procedural placeholders, 'Benevolence'-inspired)
     P1 = chunky yellow toy robot   (gold body, wide chest, thin waist, big blocky head,
                                     silver ball joints, eyelid/eyebrow plates, no mouth)
     P2 = small bronze robot dog    (prominent snout, floppy metal ears, wagging tail)
   They are drawn through the normal sprite system as the 'player' placeholder, so ANY art
   file in assets/ (player_*.png or p1_* / p2_*) still overrides them state by state.
   Style toggle: CONFIG.characters.style = 'robots' | 'stickman'  (C on the title screen
   switches it and remembers the choice in this browser).
   Also here: robot splat debris (comes apart, clatters, reassembles on respawn),
   rust tint for water deaths, and the battery power-up look for robot style.
   ===================================================================== */
const Characters = (() => {
  let style = CONFIG.characters.style;
  try { const s = localStorage.getItem('chargehop.style'); if (s === 'robots' || s === 'stickman') style = s; } catch (e) { /* file:// may block storage */ }

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
  const RUST = '#8a4b22', RUST_DK = '#5a2e14', RUST_LT = '#b8642a';

  const PAL = {
    robot: { body: '#FFD700', shade: '#d4a800', line: '#4a3a00', joint: '#AAAAAA', jointDk: '#6f6f6f', face: '#2b2b33' },
    dog:   { body: '#D27D2D', shade: '#9c5518', line: '#3d1f08', joint: '#AAAAAA', jointDk: '#6f6f6f', face: '#2b2b33' }
  };
  function pal(kind, rust, heat) {
    const P = PAL[kind];
    if (heat > 0.02) return { body: mix(P.body, '#ff5a1f', heat), shade: mix(P.shade, '#b3200a', heat), line: P.line,   // red-hot (lava)
      joint: mix(P.joint, '#ffb070', heat * 0.85), jointDk: mix(P.jointDk, '#a03010', heat * 0.8), face: P.face };
    if (!rust) return P;
    return { body: mix(P.body, RUST, rust), shade: mix(P.shade, RUST_DK, rust), line: P.line, joint: mix(P.joint, '#8a6a4a', rust * 0.8),
      jointDk: mix(P.jointDk, '#4a3020', rust * 0.8), face: P.face };
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function ball(ctx, x, y, r, P) {
    ctx.fillStyle = P.joint; ctx.strokeStyle = P.jointDk; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  function seg(ctx, a, b, w, P) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = P.line; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = P.body; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function rustPatches(ctx, rust, spots) {
    if (rust < 0.15) return;
    ctx.save(); ctx.globalAlpha *= Math.min(1, (rust - 0.15) * 1.6);
    for (const [x, y, r, c] of spots) { ctx.fillStyle = c ? RUST_DK : RUST_LT; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function gear(ctx, r, P) {
    ctx.fillStyle = P.joint; ctx.strokeStyle = P.jointDk; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? r : r * 1.3; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.jointDk; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }

  /* ---- robot eyes with eyelid + eyebrow plates (no mouth) ---- */
  function robotEyes(ctx, cx, cy, face, t, P) {
    for (const s of [-1, 1]) {
      const ex = cx + s * 4.6, ey = cy;
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); ctx.fill();
      if (face === 'dizzy') {
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey, 1.8, t * 10 * s, t * 10 * s + 4.5); ctx.stroke();
      } else if (face === 'dead') {
        ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(ex - 1.6, ey - 1.6); ctx.lineTo(ex + 1.6, ey + 1.6); ctx.moveTo(ex + 1.6, ey - 1.6); ctx.lineTo(ex - 1.6, ey + 1.6); ctx.stroke();
      } else {
        ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(ex + 0.4, ey + 0.3, face === 'shock' ? 1.5 : 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 0.8, ey - 0.9, 0.6, 0, Math.PI * 2); ctx.fill();
      }
      // eyelid plate (covers the top of the eye) + eyebrow plate above it
      const lid = { normal: 0.35, happy: 0.15, grit: 0.55, strain: 0.8, shock: 0, dizzy: 0.3, dead: 0.4 }[face] ?? 0.35;
      const tilt = { grit: 0.35, strain: 0.5, happy: -0.25, shock: -0.1 }[face] ?? 0;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(s * tilt);
      if (lid > 0) { ctx.fillStyle = P.shade; ctx.fillRect(-3.1, -3.1, 6.2, 6.2 * lid); ctx.fillStyle = P.line; ctx.fillRect(-3.1, -3.1 + 6.2 * lid - 0.6, 6.2, 0.7); }
      const bh = face === 'shock' ? -6.2 : face === 'happy' ? -5.4 : -4.6;
      ctx.fillStyle = P.joint; ctx.fillRect(-3.4, bh, 6.8, 1.5); ctx.restore();
    }
  }

  /* ---- P1: chunky yellow toy robot (front view; origin = feet) ---- */
  function drawRobot(ctx, state, t, o) {
    const pose = o.pose || {}, P = pal('robot', o.rust || 0, o.heat || 0);
    ctx.scale(0.92, 0.92);
    const crouch = pose.crouch || 0, spread = pose.legSpread || 5, knee = pose.knee || 0, stride = pose.stride || 0;
    const hipY = -13 * (1 - crouch * 0.5), waistY = hipY - 3, chestY = waistY - 13 * (1 - crouch * 0.12), headY = chestY - 3;
    // legs: hip -> knee -> foot, chunky with ball joints
    for (const s of [-1, 1]) {
      const fy = -s * stride * 5;
      const hip = [s * 4, hipY], kn = [s * (spread * 0.55 + 1.5 + knee * 4 + crouch * 5), hipY * 0.5 + fy * 0.6], ft = [s * (spread + 1), fy];
      seg(ctx, hip, kn, 4.2, P); seg(ctx, kn, ft, 4.2, P);
      ctx.fillStyle = P.shade; ctx.strokeStyle = P.line; ctx.lineWidth = 1; rrect(ctx, ft[0] - 4 + s, ft[1] - 2.5, 8, 3.6, 1.2); ctx.fill(); ctx.stroke();
      ball(ctx, kn[0], kn[1], 2.2, P);
    }
    // pelvis + thin waist
    ctx.fillStyle = P.shade; ctx.strokeStyle = P.line; ctx.lineWidth = 1.2;
    rrect(ctx, -6.5, hipY - 2.5, 13, 4.5, 1.5); ctx.fill(); ctx.stroke();
    ball(ctx, 0, waistY + 0.5, 2.6, P);
    // arms (behind/in front of the chest by side): shoulder -> elbow -> hand
    const arm = (s, a) => {
      const sh = [s * 11, chestY + 2.5];
      const el = [sh[0] + s * Math.sin(a) * 6.5, sh[1] + Math.cos(a) * 6.5];
      const hd = [sh[0] + s * Math.sin(a) * 12.5, sh[1] + Math.cos(a) * 12.5];
      seg(ctx, sh, el, 3.6, P); seg(ctx, el, hd, 3.6, P);
      ball(ctx, el[0], el[1], 1.9, P);
      ctx.fillStyle = P.joint; ctx.strokeStyle = P.jointDk; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hd[0], hd[1], 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ball(ctx, sh[0], sh[1], 2.6, P);
    };
    // chest: wide trapezoid tapering to the thin waist
    ctx.fillStyle = P.body; ctx.strokeStyle = P.line; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-12, chestY); ctx.lineTo(12, chestY); ctx.lineTo(4.2, waistY); ctx.lineTo(-4.2, waistY); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-10.5, chestY + 1); ctx.lineTo(10.5, chestY + 1); ctx.lineTo(9.2, chestY + 3); ctx.lineTo(-9.2, chestY + 3); ctx.fill();
    ctx.fillStyle = o.accent || '#ff8a1f'; ctx.beginPath(); ctx.arc(0, chestY + 6, 1.8, 0, Math.PI * 2); ctx.fill();   // team light
    rustPatches(ctx, o.rust || 0, [[-6, chestY + 4, 2.4, 1], [5, chestY + 7, 1.8, 0], [2, chestY + 2.5, 1.4, 1]]);
    arm(-1, pose.armL ?? 0.3); arm(1, pose.armR ?? 0.3);
    if (o.glow > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= o.glow * 0.5; ctx.fillStyle = '#fff6c0';
      ctx.beginPath(); ctx.moveTo(-12, chestY); ctx.lineTo(12, chestY); ctx.lineTo(4.2, waistY); ctx.lineTo(-4.2, waistY); ctx.fill(); ctx.restore(); }
    // neck + big blocky head
    ball(ctx, 0, headY + 1, 2.2, P);
    const hw = 21, hh = 16, hy = headY - hh;
    ctx.fillStyle = P.body; ctx.strokeStyle = P.line; ctx.lineWidth = 1.5; rrect(ctx, -hw / 2, hy, hw, hh, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.shade; rrect(ctx, -hw / 2 + 1, hy + hh - 3.5, hw - 2, 2.5, 1); ctx.fill();           // jaw shading (no mouth)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-hw / 2 + 2, hy + 1.5, hw - 4, 1.5);          // top bevel
    ball(ctx, -hw / 2 - 0.5, hy + hh * 0.55, 1.8, P); ball(ctx, hw / 2 + 0.5, hy + hh * 0.55, 1.8, P);    // ear bolts
    ctx.fillStyle = P.face; rrect(ctx, -8.6, hy + 4, 17.2, 8, 2.5); ctx.fill();                        // face plate
    robotEyes(ctx, 0, hy + 8, pose.face || 'normal', t, P);
    rustPatches(ctx, o.rust || 0, [[-7, hy + 2.5, 2, 1], [7.5, hy + 13, 1.7, 0], [4, hy + 1.8, 1.2, 1]]);
  }

  /* ---- P2: small bronze robot dog (side view, facing right; origin = feet) ---- */
  function drawDog(ctx, state, t, o) {
    const pose = o.pose || {}, P = pal('dog', o.rust || 0, o.heat || 0), face = pose.face || 'normal';
    ctx.scale(0.95, 0.95);
    const crouch = pose.crouch || 0, stride = pose.stride || 0;
    const sit = state === 'win';
    const raise = Math.max(0, ((pose.armL ?? 0.3) + (pose.armR ?? 0.3)) / 2 - 0.6) / 2.1;     // arms up -> front legs reach forward
    const bodyY = -10 + crouch * 5;
    ctx.save();
    if (sit) { ctx.translate(-8, 0); ctx.rotate(-0.85); ctx.translate(8, 0); }                     // sits up, front paws raised
    const legs = [[-8, 1], [-4.5, -1], [5, 1], [8.5, -1]];
    // tail (segmented, wagging)
    const wagSpeed = state === 'charge' ? 30 : sit ? 26 : face === 'dizzy' ? 2 : 12, droop = face === 'dizzy' || state === 'fall' ? 0.9 : 0;
    const ta = -0.9 + droop + Math.sin(t * wagSpeed) * (sit ? 0.6 : 0.4);
    let tx = -11, ty = bodyY - 3;
    for (let i = 0; i < 3; i++) { const nx = tx - Math.cos(ta + i * 0.25) * 3.6, ny = ty + Math.sin(ta + i * 0.25) * 3.6; seg(ctx, [tx, ty], [nx, ny], 2.4 - i * 0.4, P); tx = nx; ty = ny; }
    ball(ctx, tx, ty, 1.5, P);
    // legs (far pair darker, drawn first)
    for (const [lx, far] of legs) {
      const front = lx > 0;
      const sw = (front ? 1 : -1) * stride * 3 * (far < 0 ? -1 : 1);
      const top = [lx, bodyY + 1], footX = lx + sw + (front ? raise * 6 : 0), footY = front ? -raise * 6 : 0;
      const LP = far < 0 ? { ...P, body: P.shade } : P;
      seg(ctx, top, [footX, footY - 0.5], 2.6, LP);
      ctx.fillStyle = P.jointDk; rrect(ctx, footX - 1.8, footY - 1.6, 3.8, 2, 0.8); ctx.fill();
      ball(ctx, lx, bodyY + 1, 1.6, P);
    }
    // body
    ctx.fillStyle = P.body; ctx.strokeStyle = P.line; ctx.lineWidth = 1.3;
    rrect(ctx, -12, bodyY - 6, 22, 8, 3.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-10, bodyY - 5, 18, 1.4);
    ctx.strokeStyle = P.shade; ctx.lineWidth = 0.8; for (const x of [-5, 1]) { ctx.beginPath(); ctx.moveTo(x, bodyY - 5.5); ctx.lineTo(x, bodyY + 1.5); ctx.stroke(); }
    rustPatches(ctx, o.rust || 0, [[-6, bodyY - 2, 2.2, 1], [4, bodyY - 3, 1.6, 0], [-1, bodyY, 1.3, 1]]);
    // collar (team colour) + neck joint
    ctx.fillStyle = o.accent || '#22d3ee'; rrect(ctx, 7, bodyY - 8, 3, 7, 1); ctx.fill();
    // head + prominent snout
    const hx = 9, hy = bodyY - 15 + (state === 'charge' ? 1.5 : 0);
    ctx.fillStyle = P.body; ctx.strokeStyle = P.line; ctx.lineWidth = 1.3;
    rrect(ctx, hx, hy, 10, 9, 2.5); ctx.fill(); ctx.stroke();
    rrect(ctx, hx + 8, hy + 3.5, 8.5, 5, 1.8); ctx.fill(); ctx.stroke();                              // snout
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx + 16.2, hy + 4.6, 1.5, 0, Math.PI * 2); ctx.fill();   // nose
    ctx.strokeStyle = P.line; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(hx + 10, hy + 7.4); ctx.lineTo(hx + 15.5, hy + 7.4); ctx.stroke();  // jaw seam
    // eye + eyebrow plate
    const ex = hx + 6.2, ey = hy + 3.6;
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex, ey, 1.9, 0, Math.PI * 2); ctx.fill();
    if (face === 'dizzy') { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(ex, ey, 1.3, t * 10, t * 10 + 4.5); ctx.stroke(); }
    else if (face === 'dead') { ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 1.3, ey - 1.3); ctx.lineTo(ex + 1.3, ey + 1.3); ctx.moveTo(ex + 1.3, ey - 1.3); ctx.lineTo(ex - 1.3, ey + 1.3); ctx.stroke(); }
    else { ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(ex + 0.4, ey, face === 'shock' ? 1.1 : 0.8, 0, Math.PI * 2); ctx.fill(); }
    const brow = { grit: 0.35, strain: 0.5, happy: -0.3, shock: -0.2 }[face] ?? 0;
    ctx.save(); ctx.translate(ex, ey - (face === 'shock' || face === 'happy' ? 3.6 : 2.9)); ctx.rotate(brow);
    ctx.fillStyle = P.joint; ctx.fillRect(-2.4, -0.7, 4.8, 1.3); ctx.restore();
    // floppy metal ear (hinged at the back of the head)
    const airy = state === 'jump' || state === 'run' || state === 'fling';
    const earA = (airy ? -1.9 : state === 'charge' ? 0.9 : 0.35) + Math.sin(t * (airy ? 20 : 3)) * (airy ? 0.25 : 0.08);
    ctx.save(); ctx.translate(hx + 2.5, hy + 1); ctx.rotate(earA);
    ctx.fillStyle = P.shade; ctx.strokeStyle = P.line; ctx.lineWidth = 1; rrect(ctx, -2.2, 0, 4.4, 8, 2); ctx.fill(); ctx.stroke();
    ctx.restore(); ball(ctx, hx + 2.5, hy + 1, 1.3, P);
    rustPatches(ctx, o.rust || 0, [[hx + 3, hy + 6.5, 1.5, 1], [hx + 12, hy + 4.5, 1.2, 0]]);
    if (o.glow > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= o.glow * 0.5; ctx.fillStyle = '#fff6c0'; rrect(ctx, -12, bodyY - 6, 22, 8, 3.5); ctx.fill(); }
    ctx.restore();
  }

  /* ---- splat debris: the robot comes apart, parts clatter, then reassemble on respawn ---- */
  const PARTS = {
    robot: ['head', 'chest', 'arm', 'arm', 'leg', 'leg', 'gear', 'gear', 'gear', 'bolt', 'bolt'],
    dog: ['dhead', 'dbody', 'dleg', 'dleg', 'dleg', 'dleg', 'tail', 'ear', 'gear', 'gear', 'bolt']
  };
  const kindOf = (p) => (p.idx === 0 ? 'robot' : 'dog');
  function drawPart(ctx, part, P) {
    ctx.save(); ctx.translate(part.x, part.y - part.z); ctx.rotate(part.rot);
    ctx.fillStyle = P.body; ctx.strokeStyle = P.line; ctx.lineWidth = 1.2;
    switch (part.kind) {
      case 'head': rrect(ctx, -10, -8, 20, 16, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.face; rrect(ctx, -8, -4, 16, 7, 2); ctx.fill();
        ctx.fillStyle = '#7fe8ff'; ctx.fillRect(-5, -1.5, 2, 2); ctx.fillRect(3, -1.5, 2, 2); break;
      case 'chest': ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(11, -6); ctx.lineTo(4, 6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'arm': case 'leg': case 'dleg': { const l = part.kind === 'dleg' ? 6 : 8; seg(ctx, [-l, 0], [l, 0], part.kind === 'dleg' ? 2.6 : 4, P); ball(ctx, -l, 0, 2, P); break; }
      case 'dhead': rrect(ctx, -6, -5, 10, 9, 2.5); ctx.fill(); ctx.stroke(); rrect(ctx, 2, -1.5, 8, 5, 1.8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(9.5, -0.5, 1.4, 0, 7); ctx.fill(); break;
      case 'dbody': rrect(ctx, -11, -4, 22, 8, 3.5); ctx.fill(); ctx.stroke(); break;
      case 'tail': seg(ctx, [-5, 0], [5, -2], 2.2, P); break;
      case 'ear': ctx.fillStyle = P.shade; rrect(ctx, -2.2, -4, 4.4, 8, 2); ctx.fill(); ctx.stroke(); break;
      case 'gear': gear(ctx, 3.2, P); break;
      default: ball(ctx, 0, 0, 1.8, P);
    }
    ctx.restore();
  }
  function spawnDebris(p) {
    const list = PARTS[kindOf(p)], dir = p.splatDir || 1, out = [];
    const heights = { head: 34, chest: 22, arm: 22, leg: 8, dhead: 18, dbody: 10, dleg: 4, tail: 10, ear: 20 };
    for (const kind of list) {
      out.push({ kind, homeZ: heights[kind] ?? 14, x: (Math.random() * 2 - 1) * 6, y: (Math.random() * 2 - 1) * 3, z: heights[kind] ?? 14,
        vx: dir * (40 + Math.random() * 110) + (Math.random() * 2 - 1) * 60, vy: (Math.random() * 2 - 1) * 45,
        vz: 80 + Math.random() * 150, rot: Math.random() * 6, vr: (Math.random() * 2 - 1) * 16, bounces: 0 });
    }
    p.debris = out;
  }
  function updateDebris(p, dt) {
    if (!p.debris) return;
    let clatter = 0;
    for (const d of p.debris) {
      d.vz -= 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rot += d.vr * dt;
      if (d.z < 0) {
        d.z = 0;
        if (Math.abs(d.vz) > 40 && d.bounces < 4) { d.vz = -d.vz * 0.42; d.vx *= 0.6; d.vy *= 0.6; d.vr *= 0.6; d.bounces++; clatter++; }
        else { d.vz = 0; d.vx *= Math.max(0, 1 - 8 * dt); d.vy *= Math.max(0, 1 - 8 * dt); d.vr *= Math.max(0, 1 - 8 * dt); }
      }
      d.x = Math.max(-p.x + 6, Math.min(World.W - p.x - 6, d.x));
    }
    if (clatter) Sfx.play('clatter', Math.min(1, clatter / 3));
  }
  function drawDebris(ctx, p, alpha = 1) {
    if (!p.debris) return;
    const P = pal(kindOf(p), p.rust || 0);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(p.x, p.groundY);
    for (const d of p.debris) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 1, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const d of p.debris.slice().sort((a, b) => a.y - b.y)) drawPart(ctx, d, P);
    ctx.restore();
  }
  /** reassembly after respawn: parts fly in from where they'd scattered and snap together */
  function drawAssemble(ctx, p, k) {
    if (!p.debris) return;
    const P = pal(kindOf(p), p.rust || 0), e = k * k * (3 - 2 * k);
    ctx.save(); ctx.translate(p.x, p.groundY);
    for (const d of p.debris) {
      drawPart(ctx, { kind: d.kind, x: d.x * (1 - e), y: d.y * (1 - e), z: d.z * (1 - e) + (d.homeZ ?? 14) * e, rot: d.rot * (1 - e) }, P);
    }
    ctx.restore();
  }

  return {
    get style() { return style; },
    get robots() { return style === 'robots'; },
    toggle() {
      style = style === 'robots' ? 'stickman' : 'robots';
      try { localStorage.setItem('chargehop.style', style); } catch (e) { /* ignore */ }
      return style;
    },
    set(s) { style = s; },
    mix, kindOf, spawnDebris, updateDebris, drawDebris, drawAssemble, drawRobot, drawDog,
    /** does this player have real art for a state? (then the art is used, not the proxy) */
    hasArt(p, state) { return Sprites.has('p' + (p.idx + 1), state) || Sprites.has('player', state); },
    RUST
  };
})();

// The 'player' placeholder: robots (P1 robot, P2 dog) or the original stickman.
// Art files always win over this (Sprites.draw only falls back to a placeholder when no art is ready).
Sprites.registerPlaceholder('player', (ctx, state, t, o) => {
  const idx = o.player ? o.player.idx : (o.idx || 0);
  if (!Characters.robots) return drawStickman(ctx, state, t, o);
  o = { ...o, accent: o.color };
  return idx === 0 ? Characters.drawRobot(ctx, state, t, o) : Characters.drawDog(ctx, state, t, o);
});

// Robot style: the power-up becomes a glowing blue cylindrical battery (stickman style keeps the orb).
(() => {
  Sprites.registerPlaceholder('powerup', (ctx, state, t, o) => {
    if (!Characters.robots) return drawOrbPowerup(ctx, state, t, o);
    const r = (o.w || 30) / 2;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.3);
    g.addColorStop(0, 'rgba(140,220,255,0.85)'); g.addColorStop(0.45, 'rgba(40,140,255,0.35)'); g.addColorStop(1, 'rgba(0,60,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(0, Math.sin(t * 3) * 2.5); ctx.rotate(Math.sin(t * 2) * 0.12);
    const w = r * 1.05, h = r * 1.7;
    const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    body.addColorStop(0, '#0b3d91'); body.addColorStop(0.35, '#3fa9ff'); body.addColorStop(0.55, '#bfe6ff'); body.addColorStop(1, '#0b3d91');
    ctx.fillStyle = body; ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, h / 2, w / 2, w * 0.18, 0, 0, Math.PI); ctx.lineTo(-w / 2, -h / 2); ctx.ellipse(0, -h / 2, w / 2, w * 0.18, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.ellipse(0, -h / 2, w / 2, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0d0d0'; ctx.fillRect(-w * 0.18, -h / 2 - 4, w * 0.36, 4);                       // + terminal
    const lvl = 0.5 + 0.5 * Math.sin(t * 4);                                                           // charge level shimmer
    ctx.fillStyle = `rgba(200,255,255,${0.5 + 0.4 * lvl})`;
    ctx.beginPath(); ctx.moveTo(2, -h * 0.32); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, h * 0.32); ctx.lineTo(4, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();   // bolt
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { const a = t * 3 + (i * Math.PI * 2) / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.4, Math.sin(a) * r * 0.55, 1.6, 0, Math.PI * 2); ctx.fill(); }
  });
})();
