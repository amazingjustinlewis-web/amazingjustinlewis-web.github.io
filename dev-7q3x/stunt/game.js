/* Stunt Smash - TV-authoritative level + physics (cannon.js 0.6.2). Exposes window.Stunt. */
(function (root) {
  'use strict';
  var VEH = {   // proxy vehicles: mass, box size [len, height, width], speed factor, takeoff pitch spin (handling), friction
    bike: { name: 'Motorbike', mass: 250, size: [2.1, 1.1, 0.7], spd: 1.12, spin: 4.2, fr: 0.03 },
    car: { name: 'Car', mass: 1300, size: [4.2, 1.3, 1.9], spd: 1.0, spin: 1.8, fr: 0.04 },
    bus: { name: 'Bus', mass: 7000, size: [10, 3, 2.6], spd: 0.82, spin: 0.45, fr: 0.05 } };
  var SCORE = { crate: 100, tower: 400, air: 60, flip: 500 }, RUN = { maxT: 11, stillV: 0.7, stillT: 1.2, speedMin: 18, speedMax: 44, yawMax: 0.45 };
  var START = [-42, 0];
  // v0.2 off-road: the runway is |z| < ROAD.hw between x0..x1 (ramps count as road). On dirt vehicles dig in: drag, sideways grip, slip -> roll torque.
  var ROAD = { hw: 4.5, x0: -50, x1: 80 }, DIRT = { drag: 7, grip: 5, roll: 0.55, rollMin: 3, sink: 0.12 };
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function genLevel(seed) { var R = rng(seed), L = { seed: seed, ramps: [], crates: [], start: START };
    var x = -12 + R() * 10, h = 1.8 + R() * 1.6, len = 7 + R() * 4; L.ramps.push({ x: x, z: (R() - .5) * 4, len: len, w: 7, h: h });
    if (R() < 0.6) { var x2 = x + len + 14 + R() * 10; L.ramps.push({ x: x2, z: (R() - .5) * 8, len: 6 + R() * 3, w: 6, h: 1.2 + R() * 1.4 }); }
    var sx = 52 + R() * 18, sz = (R() - .5) * 10, kind = Math.floor(R() * 3), C = 1.2;
    if (kind === 0) { for (var y = 0; y < 6; y++) for (var a = 0; a < 3; a++) for (var b = 0; b < 2; b++) L.crates.push([sx + b * C, C / 2 + y * C, sz + (a - 1) * C]); }     // tower
    else if (kind === 1) { for (y = 0; y < 4; y++) for (a = 0; a < 7 - y; a++) L.crates.push([sx, C / 2 + y * C, sz + (a - (6 - y) / 2) * C]); }                       // wall/pyramid
    else { for (y = 0; y < 3; y++) for (a = 0; a < 4; a++) for (b = 0; b < 3; b++) if (R() < 0.85 || y === 0) L.crates.push([sx + b * C, C / 2 + y * C, sz + (a - 1.5) * C]); }   // crate pile
    L.kind = ['tower', 'wall', 'pile'][kind]; return L; }
  function World(L) { var w = this.w = new CANNON.World(); w.gravity.set(0, -9.82 * 1.4, 0); w.broadphase = new CANNON.SAPBroadphase(w); w.allowSleep = true; w.solver.iterations = 8;
    this.L = L; var mG = this.mG = new CANNON.Material('g'), mV = this.mV = new CANNON.Material('v'), mC = this.mC = new CANNON.Material('c');
    w.addContactMaterial(new CANNON.ContactMaterial(mG, mV, { friction: 0.0, restitution: 0.0 })); w.addContactMaterial(new CANNON.ContactMaterial(mC, mV, { friction: 0.4, restitution: 0.1 })); w.addContactMaterial(new CANNON.ContactMaterial(mG, mC, { friction: 0.5, restitution: 0.05 })); w.addContactMaterial(new CANNON.ContactMaterial(mC, mC, { friction: 0.5, restitution: 0.05 }));
    var g = new CANNON.Body({ mass: 0, material: mG }); g.addShape(new CANNON.Plane()); g.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); w.addBody(g); this.ground = g;
    this.ramps = L.ramps.map(function (r) { var a = Math.atan2(r.h, r.len), hl = Math.hypot(r.h, r.len) / 2, th = 0.3, b = new CANNON.Body({ mass: 0, material: mG }); b.addShape(new CANNON.Box(new CANNON.Vec3(hl, th, r.w / 2)));
      b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), a); b.position.set(r.x + r.len / 2 + Math.sin(a) * th, r.h / 2 - Math.cos(a) * th, r.z); w.addBody(b); r.a = a; return b; });
    var me = this; this.crates = L.crates.map(function (c) { var b = new CANNON.Body({ mass: 40, material: mC }); b.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.6, 0.6))); b.position.set(c[0], c[1], c[2]); b.allowSleep = true; b.sleepSpeedLimit = 0.2; w.addBody(b); b.sleep(); b.p0 = b.position.clone(); return b; });
    this.veh = null; this.t = 0; this.run = null; }
  World.prototype.reset = function () { this.crates.forEach(function (b) { b.position.copy(b.p0); b.quaternion.set(0, 0, 0, 1); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.sleep(); }); if (this.veh) { this.w.remove(this.veh); this.veh = null; } this.run = null; };
  World.prototype.launch = function (o) { this.reset(); var V = VEH[o.veh] || VEH.car, s = V.size, b = new CANNON.Body({ mass: V.mass, material: this.mV }); b.addShape(new CANNON.Box(new CANNON.Vec3(s[0] / 2, s[1] / 2, s[2] / 2)));
    var yaw = Math.max(-RUN.yawMax, Math.min(RUN.yawMax, o.yaw || 0)), sp = Math.max(RUN.speedMin, Math.min(RUN.speedMax, o.speed || 30)) * V.spd; b.position.set(START[0], s[1] / 2 + 0.05, START[1] + (o.z || 0)); b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -yaw);
    b.velocity.set(Math.cos(yaw) * sp, 0, Math.sin(yaw) * sp); b.linearDamping = 0.01; b.angularDamping = 0.05; b.allowSleep = false; this.w.addBody(b); this.veh = b;
    this.run = { V: V, veh: o.veh, t: 0, air: 0, airNow: false, flipAcc: 0, flips: 0, still: 0, took: false, rec: [], done: false, ground: true, maxAir: 0, yaw: yaw, speed: sp }; };
  World.prototype.grounded = function () { var v = this.veh, w = this.w, g = false, onG = false; for (var i = 0; i < w.contacts.length; i++) { var c = w.contacts[i]; if (c.bi === v || c.bj === v) { var o = c.bi === v ? c.bj : c.bi; if (o.mass === 0) { g = true; if (o === this.ground) onG = true; } } } this.onGround = onG; return g; };
  World.prototype.offRoad = function () { var p = this.veh.position; return this.onGround && (Math.abs(p.z) > ROAD.hw || p.x < ROAD.x0 || p.x > ROAD.x1); };
  World.prototype.step = function (dt) { var R = this.run; this.w.step(1 / 60, dt, 4); if (!R || R.done) return; var v = this.veh; R.t += dt;
    var gr = this.grounded(); R.dirt = gr && this.offRoad();
    if (R.dirt) { var vel = v.velocity, hs = Math.hypot(vel.x, vel.z); if (hs > 0.05) { var dv = Math.min(hs, DIRT.drag * dt) / hs; vel.x -= vel.x * dv; vel.z -= vel.z * dv; }
      var rt = new CANNON.Vec3(0, 0, 1), fw = new CANNON.Vec3(1, 0, 0); v.quaternion.vmult(rt, rt); v.quaternion.vmult(fw, fw); var vl = vel.dot(rt), kk = Math.min(1, DIRT.grip * dt);
      vel.x -= rt.x * vl * kk; vel.z -= rt.z * vl * kk;   // sideways grip...
      if (Math.abs(vl) > DIRT.rollMin) { R.rollK = R.rollK || (0.5 + Math.random()); v.angularVelocity.vadd(fw.scale(-Math.sign(vl) * (Math.abs(vl) - DIRT.rollMin) * DIRT.roll * R.rollK * (1 + hs / 25) * dt * 6 / Math.sqrt(R.V.mass / 1300)), v.angularVelocity); }   // ...and a slide that digs in can trip it over
      R.dirtT = (R.dirtT || 0) + dt; }
    if (!gr) { R.air += dt; if (!R.took && v.position.y > 0.8) { R.took = true; var lat = new CANNON.Vec3(0, 0, 1); v.quaternion.vmult(lat, lat); v.angularVelocity.vadd(lat.scale(R.V.spin * (0.7 + Math.random() * 0.6)), v.angularVelocity); } var ax = new CANNON.Vec3(0, 0, 1), ax2 = new CANNON.Vec3(1, 0, 0); v.quaternion.vmult(ax, ax); v.quaternion.vmult(ax2, ax2); R.flipAcc += Math.abs(v.angularVelocity.dot(ax)) * dt + Math.abs(v.angularVelocity.dot(ax2)) * dt * 0.6; } else { R.flips += Math.floor(R.flipAcc / (Math.PI * 2) + 0.15); R.flipAcc = 0; }
    var sp = v.velocity.length(); R.still = sp < RUN.stillV && R.t > 2 ? R.still + dt : 0;
    // record for replays (30 fps)
    if (!R.lastRec || R.t - R.lastRec >= 1 / 30) { R.lastRec = R.t; var bs = [v].concat(this.crates), f = new Float32Array(bs.length * 7); bs.forEach(function (b, k) { f.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], k * 7); }); R.rec.push(f); }
    if (R.still > RUN.stillT || R.t > RUN.maxT || v.position.y < -20) this.finish(); };
  World.prototype.smashed = function () { var n = 0, top = 0; this.crates.forEach(function (b) { var d = b.position.vsub(b.p0).length(), up = new CANNON.Vec3(0, 1, 0); b.quaternion.vmult(up, up); if (d > 0.8 || up.y < 0.85) n++; top = Math.max(top, b.p0.y); }); return n; };
  World.prototype.finish = function () { var R = this.run; if (R.flipAcc) R.flips += Math.floor(R.flipAcc / (Math.PI * 2) + 0.15); R.done = true; R.crates = this.smashed(); R.towerDown = R.crates >= this.crates.length * 0.6;
    R.score = Math.round(R.crates * SCORE.crate + (R.towerDown ? SCORE.tower : 0) + R.air * SCORE.air + R.flips * SCORE.flip); };
  root.Stunt = { ROAD: ROAD, DIRT: DIRT, VEH: VEH, SCORE: SCORE, RUN: RUN, genLevel: genLevel, World: World, START: START };
})(window);
