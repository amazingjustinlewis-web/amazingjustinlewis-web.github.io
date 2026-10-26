/* v0.9.54: copy of sim_v0953.js + content-mode block at the end (kid mode = no fights, o.zm in snap). Goalie unchanged. */
/* v0.9.43: unchanged copy of sim_v0942.js (version bump only). */
/* v0.9.53: copy of sim_v0952.js + the v0.9.53 block at the end (fight combos, goalie butterfly/smother/post lock). */
/* v0.9.42 (sim): fighters twice as tough by default (?fhp= toughness multiplier, default 2; damage per hit divided by it). Copy of sim_v0941.js. */
/* v0.9.41: same as sim_v0940.js plus a slow after-goal settle (sim.slowS, ?settle=) and CPU body checks in watch mode (sim.cpuChk), appended at the end. */
/* v0.9.40: same as sim_v0939.js plus FIGHT MODE appended at the end. */
/* BUBBLE HOCKEY v0.9.35 (forked from sim_v0929.js) - v0.1 - table-top rod hockey sim. Rink is 1 wide x 1.8 long. Team 0 defends the bottom goal and attacks up; team 1 is the
   point-mirror (x -> 1-x, y -> 1.8-y). Every player rides a fixed track (u = 0..1). AI slides everyone you are not touching. */
(function (root) {
  'use strict';
  var L = 2.0, PR = .0176, R = .034, GW = .07, GY = .128, BL = .66, REACH = .055, GOALP = 16.8 + Math.min(20, 8 * (1 / Math.max(.1, Math.min(2, parseFloat((location.search.match(/[?&]rspd=([\d.]+)/) || [])[1]) || .5)) - 1)),   // v0.9.39 longer goal pause for half-speed replays (tap still skips)
   _GP0 = 16.8, MAGR = .045, MAGK = .0007, WIN = 5, TIME = 180;
  // v0.3 tracks come from tracks.js (sketch pixels, Catmull-Rom). Team 0 = sketch green (guards y=L), team 1 = sketch blue (guards y=0).
  var TB = root.BUBBLE_TRACKS, SK = TB.sketch;
  function sk(q) { return [(q[1] - SK.y0) / (SK.y1 - SK.y0), (q[0] - SK.x0) / (SK.x1 - SK.x0) * L]; }
  function spline(P) { var out = [P[0]]; for (var j = 0; j < P.length - 1; j++) { var p0 = P[Math.max(0, j - 1)], p1 = P[j], p2 = P[j + 1], p3 = P[Math.min(P.length - 1, j + 2)];
      for (var k = 1; k <= 8; k++) { var t = k / 8, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(function (d) { return .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3); })); } } return out; }
  var TR = []; [['green', 0], ['blue', 1]].forEach(function (g) { TB[g[0]].forEach(function (k) { var p = spline(k.pts.map(sk)), cum = [0], t = g[1];
    for (var j = 1; j < p.length; j++) cum.push(cum[j - 1] + Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1]));
    TR.push({ p: p, cum: cum, len: cum[cum.length - 1], k: k.k, sl: k.sl, t: t, a: p[0], b: p[p.length - 1] }); }); });
  // v0.7 tunables. SL: visual/solid stick = 25% of the track's sl; the old reach is kept by a weak blade magnet out to (sl * MAGOUT).
  var SL = .25, MAGOUT = .85, MAG2K = .00035, AISPD = .9;
  // v0.8: snag (thumb-down pick), one-timer, body checks
  var SUP = { on: !qoff('sup'), re: .15, n: 24, blue: .25, blueTol: .08, lead: .02, minD: .12, clr: .1, wLane: 4, wBlue: 3, wRel: .5, wAng: .08, wFar: .06, wStick: .15, wNet: .05, k: 6 };
  var SNAG = { t: .45, spd: 4.2, free: .05 }, OT = { arm: 2.5, base: 2, press: 4, bounce: 3, max: 10, sp: 3.3 }, CHK = { min: .5, hard: 1.5, kb: .55, down: 1.5, cd: .4, maxO: .16 };
  var FO = { vz: 1.05, grabZ: .03 };   // faceoff: puck pops straight up out of the centre slot
  var POKEX = 1.3;   // tap stick-check reach vs normal poke reach
  var NET = { post: .92, bar: .85, mesh: .12, give: .45 };   // net materials: metal post/crossbar restitution (hard, bouncy); soft mesh back/sides restitution + tangential give
  var GREACH = { t: .35, ext: .022, cd: .2 };   // quick goalie swipe: lunge toward d for t s, save area extends ext on that side
  var MOVE_SPRING = 30;   // thumb-held players trail the finger on a critically damped spring (rad/s; higher = crisper, lower = floatier)
  // v0.9.15 spring operator test: held player follows the thumb on a spring-damper with a little lag/overshoot. w = stiffness (rad/s), zeta = damping (1 = no overshoot).
  // ?spring=0 on the page that runs the sim (TV page for TV games, phone page for phone-vs-computer) = rigid (player sits exactly on the thumb's slot point).
  var SPRING = { on: !(typeof location !== 'undefined' && /[?&]spring=0/.test(location.search)), w: 24, zeta: .55 };
  var WHIP = .3;          // share of the carried puck's own velocity (glide + stick spin) a flick keeps
  var FREEZE = { t: 5, glove: .3, gloveMax: 3.4, pause: 3.2, hack: .12 };   // goalie covers ~t s -> whistle; glove-save chance on hard shots to his glove side; coast time; chance scale for opponents knocking a covered puck loose
  var GD = { out: 1.5, back: .25, wPx: R, rateAI: 3.2, rateHand: 14, quiet: .9, wide: .33, brk: 1.0, norm: .62, push: .85, shove: 5 };   // goalie depth: out/back in goalie widths (R); AI settle rates; puck range he reacts to; breakaway share of max, normal share; body shove
  var WILD = { on: true, p: .15, k: .5, max: .75, bounce: .45 };   // v0.9.35: p .4 -> .15 (stays on the ice more)   // 'Wild puck': rebounds/rolling pucks lift more often/higher, livelier landings. on=false = exact v0.9 behaviour
  var AIF = { drive: .3, shootFar: .9, shootNear: .5 };   // AI forwards: chance a possession drives in (shoots only when close), otherwise shoot from up to shootFar
  var HACK = { r: .14, max: Infinity, reach: .035, kick: 1.3, steal: .35 };   // slow-mo scramble: taps make your players near the puck jab at it (max = cap on players in the sphere)
  // v0.9.16 conservative goalie (AI + auto-assist; a thumb on the goalie strip is unchanged): lateral cap as a share of the half net width (GW = post offset from centre) (tighter when a shot is likely),
  // depth multipliers on GD (out/brk/norm) and an extra squeeze when an opposing carrier is in shooting range with a lane.
  // v0.9.17 puck physics (Justin feedback). BNC: every board/post/crossbar bounce keeps n of the speed along the surface normal and t of the speed along it (both .8 = ~20% total speed lost per bounce); stick shots are untouched.
  // v0.9.20 switches: each new piece can be turned off on the page that runs the sim (TV page for TV games, phone page for phone-vs-computer) with ?face=0 ?pivot=0 ?hands=0 ?bnc=0 ?grav=0 (= v0.9.19 behaviour for that piece).
  function qoff(k) { return typeof location !== 'undefined' && new RegExp('[?&]' + k + '=0').test(location.search); }
  // v0.9.21 KD: strong (non-big) checks can knock the hit skater down briefly, pushed off his slot spot. Chance rises from 0 at check speed min to p at CHK.hard; down t0..t1 s (can't play the puck), push = extra knockback per unit of check speed. ?kd=0 disables.
  // v0.9.24 BRD: players never leave the rink. Body centre clamped m inside the boards (x 0..1, y .05..L-.05); a check/knockdown/stretch that hits the boards
  // pings him back off them at >= v (rink/s; e = share of the incoming speed kept), at most once per cd s per player. Snap bpg = [counter, player, nx, ny].
  var BRD = { m: .02, v: .35, e: .45, cd: .3, minIn: .05, cr: .12 };   // cr = corner radius of the boards (matches the 3D rink)
  var KD = { on: !qoff('kd'), min: .8, p: .55, t0: .6, t1: .9, push: .35 };
  var V20 = { face: !qoff('face'), pivot: !qoff('pivot'), hands: !qoff('hands'), bnc: !qoff('bnc'), grav: !qoff('grav') };
  // FACE: engine-chosen facing. Carrier faces up-ice / the net; an opponent within r turns his shoulder (body between checker and puck, stick reaches away). sh = 0 open .. 1 fully shielded.
  // Poke / passive stick-check success: pokeOpen when facing forward, pokeShield when fully shielded (blend between). turn = facing turn rate (rad/s).
  var FACE = { r: .12, pokeOpen: .7, pokeShield: .25, turn: 8, reach: .9 };
  // PIVOT: carrier held by a thumb: thumb = where the puck goes; he pivots around it. k = soft spring rate on the thumb point (1/s, high = nearly unnoticeable), stretch = max off-slot lean toward it.
  var PIVOT = { k: 22, stretch: .02 };
  // HANDS: stickhandling. Moving faster than vmin (rink/s): puck rocks across the blade amp rad at f Hz; slower: held on the forehand side (side rad).
  var HANDS = { vmin: .06, amp: .16, f: 2.2, side: .35, ease: 4 };
  // v0.9.26 DEKE (gear-shift zigzag): the carrier's thumb zigzags side to side (each swing >= amp rink units; n reversals within win s) -> stickhandle widens into a wide
  // side-to-side deke (wide rad, follows the current zig/zag side), with a slight lateral drift on the peg (drift rink/s, via the knock offset). A shot flick during the deke
  // releases from the current side and leans aim k toward it. ease = blend in/out per s. ?deke=0 off.
  var DEKE = { on: !qoff('deke'), amp: .035, n: 2, win: 1.0, wide: .9, drift: .12, aim: .18, ease: 6 };
  // GRAV: soft pull on a nearby loose puck toward the blade of a player a thumb is holding (fewer dead spots): radius r, accel k at the blade falling to 0 at r.
  // v0.9.21 GRAV: a loose puck is pulled toward the NEAREST player's blade (within r, linear distance falloff), scaled by stillness: (1 - speed/vslow)^3 (1 at rest, ~0.3 barely moving, 0 at normal speed), ramped in over ramp s of slowness (smoothstep-cubed).
  var GRAV = { r: .2, k: .9, vslow: .15, ramp: 1 };
  // BNC v0.9.20: livelier boards 0.86 (v0.9.17-19: .8); heavy puck landing: restitution land, at most hops small hops then it sits.
  var BNC = V20.bnc ? { n: .86, t: .86, land: .38, hops: 3 } : { n: .8, t: .8 };
  // KNOCK: on a body check, a loose puck within r of the checked player (or one he carries) gets knocked along the checker's motion with chance p at speed sp (+ k x checker speed, capped at max).
  var KNOCK = { p: .65, r: .09, sp: 1.0, k: .3, max: 1.8 };
  // SCR: scramble pop-up. Two opposing sticks reach a loose puck within dt s of each other -> chance p it pops straight up at vz (hits the dome); untouchable until it drops (like the faceoff). cd = min s between scramble rolls; v = assumed stick closing speed (opponent counts if his blade is within reach + dt*v).
  var SCR = { dt: .15, p: .15, vz: 2.9, side: .3, reach: .02, cd: 2, v: .3 };
  // DOME: glass dome as an ellipsoid over the rink centre (half-width a, half-length b, height c, from arena_classic.glb glass_dome / ARENA_UNIT); e = restitution off the glass.
  var DOME = { a: .70, b: 1.05, c: .58, e: .72 };   // v0.9.35 livelier off the glass
  // v0.9.18 dead puck: a loose puck no stick has touched for t s (live play only, not airborne) -> whistle + faceoff at the nearest zone dot (end-zone dots if |y - centre| > zone, else centre ice).
  var DEAD = { t: 5, zone: .45 };
  // v0.9.25 MAX RIP: top of the existing flick range (phone sends 0.8..3.4). fire = puck catches fire (trail) for t s; net = a burning puck that hits a post/net frame knocks the net
  // off its moorings (whistle, centre serve), and a burning goal tears out the back mesh; glass = a burning puck at the very top that hits the boards/dome smashes the dome glass,
  // leaves, play resets with the dispenser arc serve. minSp = puck must still be this fast. ?rip=0 turns it off; ?riplo=1 lowers all three thresholds by .8 (testing).
  var RIP = { on: !qoff('rip'), fire: 3.0, net: 3.2, glass: 3.35, glassP: .4, t: 2.2, minSp: 1.2 }   // v0.9.33: glassP = chance a glass-tier rip may actually break the glass (Justin: half as often);
  if (typeof location !== 'undefined' && /[?&]riplo=1/.test(location.search)) { RIP.fire -= .8; RIP.net -= .8; RIP.glass -= .8; }
  // v0.9.25 serves from the centre dispenser. open = opening faceoff: straight up, small jitter (most consistent). reg = crowd spectrum: sticks (both teams) within r of the slot
  // add up crowd c (each 1 - d/r); below tight it pops diagonally out through the widest gap between sticks (side speed falls as c rises); at/above tight it blasts straight up with sparks.
  // arc = reset after a glass smash: the dispenser chugs the puck out in an arc onto one of the four zone dots (height/spin vary). Puck bounciness on landing is unchanged (BNC).
  var SRV = { r: .14, tight: 2.6, side: [.55, .2], vzReg: [.85, 1.05], blast: 1.35, open: .05, arcVz: [1.15, 1.45], spin: .5, dots: [[.25, .36], [.75, .36], [.25, L - .36], [.75, L - .36]] };
  var GSAFE = { lat: .8, latShot: .85, outK: .8, shotK: .7, shotRange: .5 };
  // v0.9.35 PER: 3 periods of len s (clock stops during whistles/goal pauses), brk s intermission + line change, tied after 3 -> overtime sudden death. ?periods=0 = old untimed-to-5 game.
  var PER = { on: !qoff('periods'), n: 3, len: 180, brk: 7 };
  // v0.9.36 ?plen=<seconds per period, 60..600> and ?pn=<periods, 1..5>; break 7 s (dome-clock orbit on the TV)
  (function () { if (typeof location === 'undefined') return; var m = /[?&]plen=(\d+)/.exec(location.search), n = /[?&]pn=(\d)/.exec(location.search); if (m) PER.len = Math.max(60, Math.min(600, +m[1])); if (n) PER.n = Math.max(1, Math.min(5, +n[1])); })();
  // v0.9.35 GK: goalie tracks the puck laterally (share of the puck's x offset), hugs the puck-side post when the puck is behind the goal line
  var GK = root.BH_GKT = { on: !qoff('gk'), track: .3, lat: .85, post: .3, pinch: .9, sharp: 1.0, shotV: .5, crossW: 1.15, shotS: 1.2, crossK: .45, yawBehind: .5 };   // v0.9.52 angle-cut: pinch = post hug (x GW), sharp = angle (rad) where he hugs the post fully, yawBehind = share of the turn when the puck is behind the net
  // v0.9.35 KO: a check can knock the victim right off his peg (chance p0..p1 scaled by impact), slides away up to maxO, lies down t s, then blends back at rate back/s. JUT = held-skater stretch gain (2x farther off the peg). ?ko=0 ?jut=0
  var KO = { on: !qoff('ko'), p0: .25, p1: .4, push: .9, maxO: .3, back: 2.2 }, JUT = qoff('jut') ? 1 : 2;
  var AI = { goalieOut: .045, dMid: .22, dPress: .16, dStretch: .05, safeRe: .4, beat: .35, press: .055, rimP: .35, oneT: .4 };
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function proj(tr, x, y) { var best = 0, bd = 9; for (var j = 1; j < tr.p.length; j++) { var a = tr.p[j - 1], b = tr.p[j], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, f = cl(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1), px = a[0] + dx * f - x, py = a[1] + dy * f - y, d = px * px + py * py;
    if (d < bd) { bd = d; best = (tr.cum[j - 1] + Math.sqrt(l2) * f) / tr.len; } } return best; }
  function pos(tr, u) { var s = cl(u, 0, 1) * tr.len; for (var j = 1; j < tr.p.length; j++) if (s <= tr.cum[j] || j === tr.p.length - 1) { var a = tr.p[j - 1], b = tr.p[j], f = (s - tr.cum[j - 1]) / ((tr.cum[j] - tr.cum[j - 1]) || 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; } }
  function adiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  // v0.9.51 goalie moves (drive the authored poses AND the save area): 0 neutral, 1 ready, 2 pad (down, covers a side low), 3 low block (square, centre),
  // 4 launch (push off a post across: long reach), 5 smother (drop on a loose puck). gm[t] = [mode, target rink x, serial]. CAP = capture sphere for airborne pucks.
  var GM = { on: !/[?&]gm=0/.test(location.search), shotV: .9, tMax: .55, wide: 2.4, low: .5, pad: 1.5, highZ: .03, smR: .07, smV: .55, hold: .55, holdN: .25, extPad: .02, extLaunch: .04, extLow: .006, T: .5 };
  var CAP = { on: !/[?&]cap=0/.test(location.search), z0: .016, r: .03, rG: .04, h: .075, v: 2.2, vG: 3.4 };
  function face(t) { return t ? 1 : -1; }   // y direction a team attacks
  function goalOf(t) { return t ? L - GY : GY; } // the goal line team t shoots at
  function Sim() { this.ai = [false, true]; this.diff = .85; this.reset(); }
  Sim.prototype.reset = function () { this.u = TR.map(function (tr) { return tr.k === 'G' || tr.k === 'D' ? .5 : .5; }); this.sc = [0, 0]; this.per = 1; this.time = PER.on ? PER.len : TIME; this.over = -1; this.grab = []; this.fing = []; for (var h0 = 0; h0 < 10; h0++) { this.grab.push(-1); this.fing.push(null); } this.side = 0; this.o = TR.map(function () { return [0, 0]; }); this.ko = TR.map(function () { return [0, 0]; }); this.dn = TR.map(function () { return 0; }); this.sn = TR.map(function () { return 0; }); this.ln = TR.map(function () { return 0; }); this.ot = [null, null]; this.lf = [-9, -9, -9, -9, -9, -9, -9, -9, -9, -9]; this.cd = {}; this.prevP = []; this.ang = TR.map(function (tr) { return tr.t ? Math.PI / 2 : -Math.PI / 2; }); this.fa = this.ang.slice(); this.sh = TR.map(function () { return 0; }); this.srvK = 'open'; this.faceoff(); };
  Sim.prototype.faceoff = function (pt) { this.fo = pt || [.5, L / 2]; this.p = this.fo.slice(); this.z = 0; this.vz = 0; this.launch = true; this.air = false; this.v = [(Math.random() - .5) * .25, (Math.random() - .5) * .25]; this.c = -1; this.pause = 1.1; this.msg = 'FACE OFF'; this.to = -1; this.cool = -1; this.coolT = 0; this.hold = 0; this.ev = ''; this.gone = 0; this.arc = null; this.fire = 0; this.rt = 0; };
  Sim.prototype.pp = function (i) { var q = pos(TR[i], this.u[i]), o = this.o ? this.o[i] : null; return o ? [q[0] + o[0], q[1] + o[1]] : q; };
  Sim.prototype.team = function (i) { return i < 6 ? 0 : 1; };
  Sim.prototype.carryPos = function () { var i = this.c, P = this.pp(i), a = this.ang[i], d = R * .5 + TR[i].sl * SL * .75 + PR * .9; return netOut([cl(P[0] + Math.cos(a) * d, PR, 1 - PR), cl(P[1] + Math.sin(a) * d, .05 + PR, L - .05 - PR)], PR); };   // v0.9.35: a carried puck can't sit inside a net cage   // v0.9.24: never outside the boards (fixes the old out-of-bounds puck)
  Sim.prototype.tip = function (i) { var P = this.pp(i), a = this.ang[i], d = R * .5 + TR[i].sl * SL; return [P[0] + Math.cos(a) * d, P[1] + Math.sin(a) * d]; };
  Sim.prototype.release = function (dir, sp, to, pt) { var i = this.c; if (i < 0) return; var t0 = this.team(i); if (this.ai[t0] && !this.held(t0) && this.ownNetHit(t0, this.carryPos(), pt ? [pt[0] - this.carryPos()[0], pt[1] - this.carryPos()[1]] : dir)) { var cpx = this.carryPos()[0]; dir = [(cpx < .5 ? -1 : 1) * .8, face(t0)]; pt = null; to = -1; var sx = this.stat = this.stat || {}; sx.ownNetAvoid = (sx.ownNetAvoid || 0) + 1; } var m = Math.hypot(dir[0], dir[1]) || 1; this.ang[i] = Math.atan2(dir[1], dir[0]); this.swing = [i, .18]; this.p = this.carryPos(); if (pt) { dir = [pt[0] - this.p[0], pt[1] - this.p[1]]; m = Math.hypot(dir[0], dir[1]) || 1; } this.v = [dir[0] / m * sp, dir[1] / m * sp]; this.cool = i; this.coolT = .25; this.z = 0; this.vz = sp > 2.0 ? Math.min(.6, (sp - 2.0) * .6 * (.3 + Math.random())) : 0; this.to = to == null ? -1 : to; this.pf = i; this.c = -1; this.hold = 0; this.side = 0; };
  // v0.9.35 net box helpers: inside(p, g) = point within goal g's cage footprint (+pad); netOut pushes a point out through the nearest face; ownNetHit = pass/clear line from p along d crosses team t's own net
  function netIn(p, g, pad) { var gl = g ? L - GY : GY, dir = g ? 1 : -1, past = (p[1] - gl) * dir; return past > -pad && past < .05 + pad && Math.abs(p[0] - .5) < GW + pad; }
  function netOut(p, pad) { for (var g = 0; g < 2; g++) { if (!netIn(p, g, pad)) continue; var gl = g ? L - GY : GY, dir = g ? 1 : -1, past = (p[1] - gl) * dir, bx = p[0] - .5, dF = past + pad, dB = .05 + pad - past, dS = GW + pad - Math.abs(bx), m = Math.min(dF, dB, dS);
      if (m === dS) p[0] = .5 + (bx > 0 ? 1 : -1) * (GW + pad); else if (m === dB) p[1] = gl + dir * (.05 + pad); else p[1] = gl - dir * pad; } return p; }
  Sim.prototype.ownNetHit = function (t, p, d) { var m = Math.hypot(d[0], d[1]) || 1, g = t ? 0 : 1; for (var s = .02; s < .6; s += .01) { if (netIn([p[0] + d[0] / m * s, p[1] + d[1] / m * s], g, PR * 1.5)) return true; } return false; };
  Sim.prototype.dekeStep = function (i, dt) { var F = DEKE.on ? this.fg(i) : null, z = this.dz;
    if (!F) { this.dz = null; this.dk = Math.max(0, (this.dk || 0) - dt * DEKE.ease); return; }
    if (!z || z.i !== i) z = this.dz = { i: i, ext: F[0], d: 0, rv: [] };
    var clk = this.clk || 0; if (z.d >= 0 && F[0] > z.ext || z.d <= 0 && F[0] < z.ext) { if (z.d === 0 && Math.abs(F[0] - z.ext) > DEKE.amp) z.d = F[0] > z.ext ? 1 : -1; if (z.d !== 0) z.ext = F[0]; }
    else if (Math.abs(F[0] - z.ext) > DEKE.amp) { z.d = F[0] > z.ext ? 1 : -1; z.ext = F[0]; z.rv.push(clk); }
    z.rv = z.rv.filter(function (c) { return clk - c < DEKE.win; }); var on = z.rv.length >= DEKE.n, was = (this.dk || 0) > .5;
    this.dk = cl((this.dk || 0) + (on ? 1 : -1) * dt * DEKE.ease, 0, 1);
    if (this.dk > .5 && !was) { this.dke = [(this.dke ? this.dke[0] : 0) + 1, i, z.d]; var s = this.stat = this.stat || {}; s.deke = (s.deke || 0) + 1; }
    if (this.dk > 0 && z.d) { var kv = this.ko[i]; kv[0] += z.d * DEKE.drift * this.dk * dt; } };
  Sim.prototype.shoot = function (dir, sp) { var i = this.c; if (i < 0) return; var t = this.team(i), cp = this.carryPos(), gy = goalOf(t);
    if (dir && (this.dk || 0) > .3 && this.dz && this.dz.d) { var dm = Math.hypot(dir[0], dir[1]) || 1; dir = [dir[0] + this.dz.d * DEKE.aim * dm, dir[1]]; this.dks = [(this.dks ? this.dks[0] : 0) + 1, i, this.dz.d]; var s2 = this.stat = this.stat || {}; s2.dekeShot = (s2.dekeShot || 0) + 1; }
    if (!dir) { var ln = this.lane(cp, t); dir = [ln[0], ln[1]]; var pt = [ln[3][0] + (Math.random() - .5) * .03, ln[3][1]]; sp = 2.8; }
    this.release(dir, cl(sp || 2.6, 1.4, 3.5), null, pt); this.ev = 'shot'; };
  // pick the most open lane to the net: sample aim points across the mouth, score by clearance from every body and stick blade on the way
  Sim.prototype.lane = function (cp, t) { var gy = goalOf(t), best = .5, bc = -1, me = this;
    for (var k = -4; k <= 4; k++) { var ax = .5 + k / 4 * GW * .45, dx = ax - cp[0], dy = gy - face(t) * .02 - cp[1], l2 = dx * dx + dy * dy, cmin = 9;
      for (var i = 0; i < 12; i++) { if (i === this.c) continue; [this.pp(i), this.tip(i)].forEach(function (q) { var f = cl(((q[0] - cp[0]) * dx + (q[1] - cp[1]) * dy) / l2, 0, 1); if (f < .02) return; var d = Math.hypot(cp[0] + dx * f - q[0], cp[1] + dy * f - q[1]); if (d < cmin) cmin = d; }); }
      cmin -= Math.abs(k) * .002; if (cmin > bc) { bc = cmin; best = ax; } }
    return [best - cp[0], gy - cp[1], bc, [best, gy - face(t) * .02]]; };
  // pass: generous aim assist. Picks the teammate closest in angle (within 75 deg). Within 40% of that cone the pass is near-straight;
  // further off, the pass errs in proportion to how far off the flick was.
  Sim.prototype.pass = function (dir, sp) { var i = this.c; if (i < 0) return; this.ripT(sp); var t = this.team(i), cp = this.carryPos(), fa = Math.atan2(dir[1], dir[0]), best = -1, bd = 9, me = this;
    var gy = goalOf(t), ga = Math.atan2(gy - cp[1], .5 - cp[0]), gd = Math.abs(Math.atan2(Math.sin(fa - ga), Math.cos(fa - ga)));
    for (var j = t * 6; j < t * 6 + 6; j++) { if (j === i) continue; var q = this.pp(j), a = Math.atan2(q[1] - cp[1], q[0] - cp[0]), d = Math.atan2(Math.sin(fa - a), Math.cos(fa - a)); if (Math.abs(d) < Math.abs(bd)) { bd = d; best = j; } }
    var CONE = 75 * Math.PI / 180, W = CONE * .4;
    if (gd < Math.min(.45, Math.abs(bd)) && (cp[1] - gy) * face(t) < 0 && sp > 1.6) { this.shoot(dir, sp * 1.1); return 'shot'; }
    if (best < 0 || Math.abs(bd) > CONE) { this.release(dir, cl(sp, .8, 2.2)); return 'loose'; }
    var q2 = this.pp(best), exact = Math.atan2(q2[1] - cp[1], q2[0] - cp[0]), ad = Math.abs(bd), err = ad <= W ? ad * .12 : W * .12 + (ad - W) * .75;
    var ang = exact + Math.sign(bd) * err, dist = Math.hypot(q2[0] - cp[0], q2[1] - cp[1]);
    this.release([Math.cos(ang), Math.sin(ang)], cl(sp, .8, 3.2), best); this.ev = 'pass'; return best; };
  // input from a team (local or over the net): {t:'grab',i} {t:'drag',x,y} {t:'rel'} {t:'tap'} {t:'flick',dx,dy,sp}
  Sim.prototype.fg = function (i) { for (var h = 0; h < 10; h++) if (this.grab[h] === i && this.fing[h]) return this.fing[h]; return null; };
  Sim.prototype.held = function (t) { for (var h = t; h < 10; h += 2) if (this.grab[h] >= 0) return true; return false; };
  // hand (default = team) lets several phones share a side; allow = list of player indexes that phone may grab
  // v0.9.19 move report: remember what an input did (iev = [counter, team, ev, target, carrier before]); data only, read by the phone's movelog.js via snap
  Sim.prototype.input = function (team, m, hand, allow) { var e0 = this.ev, c0 = this.c; this.ev = ''; this.input0(team, m, hand, allow); if (this.ev) this.iev = [((this.iev || [0])[0] + 1) % 1000, team, this.ev, this.to, c0]; else this.ev = e0; };
  Sim.prototype.input0 = function (team, m, hand, allow) { if (hand == null) hand = team;
    if (this.over >= 0) { if (m.t === 'tap') this.reset(); return; }
    if ((m.t === 'tap' || m.t === 'skip') && this.msg === 'GOAL!' && this.pause > 1.05) { this.pause = 1.05; return; }   // tap-to-skip the goal pause
    // tap anytime: acts through YOUR player closest to the tap point (he shoots if he has the puck, else stick-checks).
    // After a flick, a tap before contact arms a guaranteed one-timer for the next friendly touch (unless that receiver is held by a finger).
    if (m.t === 'tap' && this.pause <= 0) { if (this.c < 0 && (this.clk || 0) - this.lf[hand] < OT.arm) { this.ot[team] = { t: this.clk, hand: hand }; this.ev = 'arm'; return; }
      if (this.mo && (this.c < 0 || this.team(this.c) !== team)) { this.hack(team, allow); return; }
      var tx = m.x != null ? m.x : this.p[0], ty = m.y != null ? m.y : this.p[1], who = -1, wd = 9; for (var ti = team * 6; ti < team * 6 + 6; ti++) { if (allow && allow.indexOf(ti) < 0) continue; if (this.dn[ti] > 0) continue; var tq = this.pp(ti), td = Math.hypot(tq[0] - tx, tq[1] - ty); if (td < wd) { wd = td; who = ti; } }
      if (who < 0) return; if (who === this.c) { var oh = -1; for (var hh = team; hh < 10; hh += 2) if (this.grab[hh] === this.c) oh = hh; if (oh < 0 || oh === hand) this.shoot(); return; }
      this.stickCheck(team, allow, who); return; }
    if (m.t === 'grab') { var gi = (m.i >= team * 6 && m.i < team * 6 + 6 && (!allow || allow.indexOf(m.i) >= 0)) ? m.i : -1; this.grab[hand] = gi; this.fing[hand] = null;
      if (gi >= 0 && m.snag && TR[gi].k !== 'G' && gi !== this.c && this.dn[gi] <= 0 && this.clear(this.pp(gi), team) > SNAG.free) { this.sn[gi] = SNAG.t; this.ln[gi] = .4; this.ev = 'snag'; } }
    else if (m.t === 'drag') this.fing[hand] = [m.x, m.y];
    else if (m.t === 'reach') { var gk = team * 6; if (!allow || allow.indexOf(gk) >= 0) { this.gr = this.gr || [null, null]; if (!this.gr[team] || this.gr[team].t < GREACH.t - GREACH.cd) { this.gr[team] = { d: m.d > 0 ? 1 : -1, t: GREACH.t }; this.ev = 'reach'; } } return; }
    else if (m.t === 'rel') { this.grab[hand] = -1; this.fing[hand] = null; }
    else if (this.c >= 0 && this.team(this.c) === team && this.pause <= 0) { if (m.t === 'flick') { var wv = this.cpv || [0, 0], wm = Math.hypot(wv[0], wv[1]); if (wm > 2) wv = [wv[0] / wm * 2, wv[1] / wm * 2]; this.pass([m.dx, m.dy], m.sp); if (this.c < 0) { this.v[0] += wv[0] * WHIP; this.v[1] += wv[1] * WHIP; } this.lf[hand] = this.clk || 0; } } };
  // clearance of a point from the other team's bodies and blades
  Sim.prototype.clear = function (q, t) { var m = 9; for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { var a = this.pp(j), b = this.tip(j); m = Math.min(m, Math.hypot(a[0] - q[0], a[1] - q[1]), Math.hypot(b[0] - q[0], b[1] - q[1])); } return m; };
  // safest spot along player i's track (sampled), nudged toward the attacking end; cached for AI.safeRe seconds
  Sim.prototype.safeU = function (i) { this.spot = this.spot || []; var S = this.spot[i], now = this.clk || 0; if (S && now - S.t < AI.safeRe) return S.u;
    var tr = TR[i], t = tr.t, best = this.u[i], bs = -9; for (var k = 0; k <= 8; k++) { var u = cl(this.u[i] + (k - 4) * .06, 0, 1), q = pos(tr, u), sc = Math.min(.12, this.clear(q, t)) - Math.abs(q[1] - goalOf(t)) * .03 - Math.abs(u - this.u[i]) * .05; if (sc > bs) { bs = sc; best = u; } }
    this.spot[i] = { u: best, t: now }; return best; };
  // v0.9.29: center support. Human team's winger carries -> the AI-moved center skates up with the rush (around the offensive blue line,
  // a little ahead/behind the carrier) and picks the spot on his track with the clearest pass lane from the carrier (opposing D/bodies/blades)
  // plus a one-timer look at the net. Re-evaluated every SUP.re s, target smoothed so he glides instead of twitching. ?sup=0 turns it off.
  Sim.prototype.supU = function (i) { var now = this.clk || 0, S = (this.sup = this.sup || [])[i], tr = TR[i], t = tr.t;
    if (!S || S.c !== this.c) S = this.sup[i] = { u: this.u[i], g: this.u[i], t: -9, c: this.c };
    if (now - S.t >= SUP.re) { S.t = now; var cp = this.carryPos(), fw = face(t), gy = goalOf(t), blue = L / 2 + fw * SUP.blue, best = S.g, bs = -99;
      for (var k = 0; k <= SUP.n; k++) { var u = k / SUP.n, q = pos(tr, u), ly = q[1] - cp[1], ll = Math.hypot(q[0] - cp[0], ly); if (ll < SUP.minD) continue;
        var cmin = 9; for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { if (this.dn[j] > 0) continue; var wt = TR[j].k === 'D' ? 1 : TR[j].k === 'G' ? .5 : .8; [this.pp(j), this.tip(j)].forEach(function (o) { var dx = q[0] - cp[0], dy = q[1] - cp[1], f = cl(((o[0] - cp[0]) * dx + (o[1] - cp[1]) * dy) / (dx * dx + dy * dy), 0, 1); if (f < .05) return; var d = Math.hypot(cp[0] + dx * f - o[0], cp[1] + dy * f - o[1]) / wt; if (d < cmin) cmin = d; }); }
        var depth = (q[1] - blue) * fw, rel = (q[1] - cp[1]) * fw, ga = Math.abs(Math.atan2(q[0] - .5, Math.abs(gy - q[1]) + 1e-3)), sideX = (q[0] - .5) * (cp[0] - .5) < 0 ? 1 : 0;
        var sc = Math.min(SUP.clr, cmin) * SUP.wLane + (depth > -SUP.blueTol ? 0 : (depth + SUP.blueTol) * SUP.wBlue) - Math.abs(rel - SUP.lead) * SUP.wRel - ga * SUP.wAng + sideX * SUP.wFar - Math.abs(u - S.g) * SUP.wStick - Math.abs(q[1] - gy) * SUP.wNet;
        if (sc > bs) { bs = sc; best = u; } }
      S.g = best; }
    S.u += (S.g - S.u) * Math.min(1, SUP.k * (now - (S.lt == null ? now : S.lt))); S.lt = now; return S.u; };
  // where a non-held player wants to be
  Sim.prototype.aiWant = function (i, tgt, own, dt) { var tr = TR[i], t = tr.t, k = tr.k; this.pk = this.pk || []; this.pk[i] = null; if (i === this.to) return this.u[i];   // pass receiver waits where the pass was aimed
    if (k === 'G') { var gy = t ? GY : L - GY, gc = [.5, gy], dx = tgt[0] - gc[0], dy = tgt[1] - gc[1], m = Math.hypot(dx, dy) || 1, gx = gc[0] + dx / m * AI.goalieOut, lim = GW * (GK.on ? GK.lat : GSAFE.lat * (this.shotLikely(t) ? GSAFE.latShot : 1));
      if (GK.on) { lim = GW * Math.max(GK.lat, GK.pinch); var Pk = this.c >= 0 ? this.carryPos() : this.p, ex = Pk[0] - .5, ey = (Pk[1] - gy) * face(t), vin = -this.v[1] * face(t);   // v0.9.52: angle-cut on the REAL puck (the old .18 s lead point flew past the goal line on corner shots and sent him to the far post)
        /* base: angle-cut */
        if (ey < .01) gx = .5 + (ex > 0 ? 1 : -1) * GW * GK.pinch;   // behind / on the goal line: hug the near post
        else { var an = Math.atan2(Math.abs(ex), ey); gx = .5 + (ex > 0 ? 1 : -1) * GW * GK.pinch * Math.min(1, Math.sin(an) / Math.sin(GK.sharp)); }   // on the puck-centre line, post hug on sharp angles
        var cx = this.c < 0 && ey > .005 && vin > GK.shotV ? Pk[0] + this.v[0] * (ey / vin) - .5 : 9; if (Math.abs(cx) < GW * GK.crossW && Math.hypot(this.v[0], this.v[1]) > GK.shotS) gx = .5 + cx * GK.crossK + (1 - GK.crossK) * (gx - .5);   // shot on its way: slide to where it crosses the goal line   // shot on its way: slide most of the way to where it crosses the goal line (only real shots inside the posts)
        this.gkx = this.gkx || [0, 0]; this.gkx[t] = gx; } gx = cl(gx, .5 - lim, .5 + lim); return proj(tr, gx, gc[1] + dy / m * AI.goalieOut); }   // on the puck line, squared to the shooter; v0.9.16: lateral capped inside the posts (GSAFE)   // on the puck line, squared to the shooter
    if (own === 1 - t && this.c >= 0) { var cp = this.carryPos(), mine = (cp[1] - L / 2) * face(t) < 0;   // opponent has it
      if (k === 'D' && mine && Math.abs(cp[0] - .5) < AI.dMid) { var u = proj(tr, cp[0], cp[1]), q = pos(tr, u); if (Math.hypot(q[0] - cp[0], q[1] - cp[1]) < AI.dPress) this.pk[i] = cp; return u; } }
    if (own === t && this.c >= 0 && k === 'C' && !this.ai[t] && TR[this.c].k === 'W' && SUP.on) return this.supU(i);   // v0.9.29: center supports a winger rush
    if (own === t && this.c >= 0) { if (k === 'W' || k === 'C') return this.safeU(i); }   // forwards hunt open one-timer spots
    var lead = own === t && k !== 'D' ? face(t) * .12 : 0; return proj(tr, tgt[0], tgt[1] + lead); };
  Sim.prototype.aiCarrier = function (dt) { var i = this.c, t = this.team(i), P = this.pp(i), gy = goalOf(t); this.hold += dt; if (TR[i].k === 'G' && this.clear(P, t) < .06 && this.hold < FREEZE.t + 1) return;   // pressured: cover it (freeze)
    if (this.hold > 2.6 && TR[i].k === 'G') { var gpx = this.carryPos()[0]; this.release([(gpx < .5 ? -1 : 1) * .7, face(t)], 1.6); this.ev = 'pass'; return; }   // v0.9.35: clears up and out to his side, never back across his own crease
    var P0 = this.pp(i); this.aimA = Math.atan2(gy - P0[1], .5 - P0[0]) + Math.sin(this.hold * 7 + i) * .7;
    if (this.hold < .55 + (1 - this.diff) * .8) return;
    var cpp = this.carryPos(), pres = this.clear(cpp, t) < AI.press, settled = Math.abs(this.safeU(i) - this.u[i]) < .02; this.beatT = settled ? (this.beatT || 0) + dt : 0;
    if (!pres && this.beatT < AI.beat && this.hold < 2.4) return;
    if (TR[i].k === 'D' && Math.abs(P[1] - (t ? GY : L - GY)) < .45 && Math.random() < AI.rimP) { var mates = [], me = this; for (var j = t * 6; j < t * 6 + 6; j++) if (j !== i && TR[j].k !== 'G') mates.push(j);
      var D2 = mates.filter(function (j) { return TR[j].k === 'D'; })[0], Wg = mates.filter(function (j) { return TR[j].k === 'W'; }).sort(function (a, b) { return Math.abs(me.pp(a)[0] - P[0]) - Math.abs(me.pp(b)[0] - P[0]); })[0];
      var by = t ? .05 : L - .05, tgtM, ref;
      if (D2 != null && Math.random() < .5) { tgtM = D2; var q3 = this.pp(D2); ref = [q3[0], 2 * by - q3[1]]; }   // rim behind the net off the end boards
      else if (Wg != null) { tgtM = Wg; var q4 = this.pp(Wg), bx = q4[0] < .5 ? 0 : 1; ref = [2 * bx - q4[0], q4[1]]; }   // hard around the side boards up to a forward
      if (ref) { this.release([ref[0] - cpp[0], ref[1] - cpp[1]], 2.8, tgtM); this.ev = 'rim'; return; } }
    var dg = Math.abs(P[1] - gy), fw = TR[i].k === 'C' || TR[i].k === 'W'; if (fw && this.drvI !== i) { this.drvI = i; this.drv = Math.random() < AIF.drive; } if (!fw) this.drvI = -1; var lim = fw ? (this.drv ? AIF.shootNear : AIF.shootFar) : .62; if (dg < lim) { var ln = this.lane(this.carryPos(), t); if (ln[2] < PR + .01 && this.hold < 2.2 && dg > .3) return; ln[3][0] += (Math.random() - .5) * .06 * (1.4 - this.diff); this.release([ln[0], ln[1]], 2.5, null, ln[3]); this.ev = 'shot'; return; }
    var best = -1, by = 9; for (var j = t * 6; j < t * 6 + 6; j++) { if (j === i) continue; var q = this.pp(j), adv = Math.abs(q[1] - gy); if (adv < Math.abs(P[1] - gy) - .05 && adv < by) { by = adv; best = j; } }
    if (best < 0) best = t * 6 + 4; var cp = this.carryPos(), q2 = this.pp(best), dx = q2[0] - cp[0], dy = q2[1] - cp[1], e = (Math.random() - .5) * .3 * (1.2 - this.diff), a = Math.atan2(dy, dx) + e;
    this.release([Math.cos(a), Math.sin(a)], cl(Math.hypot(dx, dy) * 2.4 + .7, 1.1, 2.4), best); this.ev = 'pass'; };
  Sim.prototype.step = function (dt) {
    var me = this, F; this.ev = ''; this.clk = (this.clk || 0) + dt;
    if (this.over >= 0) return;
    if (PER.on) { if (this.pause <= 0 && !this.pg && this.per <= PER.n) { this.time -= dt; if (this.time <= 0) { this.time = 0; if (this.periodEnd()) return; } } if (this.per > PER.n && this.pause <= 0) this.msg = 'OVERTIME'; }
    else { this.time -= dt; if (this.time <= 0) { this.time = 0; if (this.sc[0] !== this.sc[1]) { this.over = this.sc[0] > this.sc[1] ? 0 : 1; return; } this.msg = 'SUDDEN DEATH'; } }
    if (this.swing) this.swing[1] -= dt; if (this.gr) for (var gq = 0; gq < 2; gq++) if (this.gr[gq]) { this.gr[gq].t -= dt; if (this.gr[gq].t <= 0) this.gr[gq] = null; } if (this.mw > 0 && !this.pg) this.mw = Math.max(0, this.mw - dt * 1.5);
    if (this.pause > 0) { this.pause -= dt; if (this.pg && this.pause <= 1.1) { this.pg = false; var pl0 = this.pause, fz = this.fz; this.fz = null; this.faceoff(fz); this.pause = Math.max(.02, pl0); this.uv = null; } if (this.pause <= 0) { this.msg = '';
      if (this.launch) { this.launch = false; this.serve(); } } }
    // move players
    var tgt = this.c >= 0 ? this.carryPos() : [this.p[0] + this.v[0] * .18, this.p[1] + this.v[1] * .18], own = this.c >= 0 ? this.team(this.c) : -1;
    for (var i = 0; i < 12; i++) { var tr = TR[i], t = tr.t, want, spd;
      if (this.pg) { this.uv = this.uv || this.u.map(function () { return 0; }); var hv = this.slowS ? cl((.5 - this.u[i]) / Math.max(.8, (this.pause - 1.1) * .75), -.12, .12) : cl((.5 - this.u[i]) * 1.2, -.12, .12), kk0 = 1 - Math.exp(-dt * (this.slowS ? 1.6 : 1.3)); this.uv[i] += (hv - this.uv[i]) * kk0; this.u[i] = cl(this.u[i] + this.uv[i] * dt, 0, 1); want = this.u[i]; spd = 0; }
      else if (this.dn[i] > 0) { want = this.u[i]; spd = 0; }
      else if (this.sn[i] > 0 && this.c !== i) { want = proj(tr, this.p[0], this.p[1]); spd = SNAG.spd; }
      else if ((F = this.fg(i))) { this.mv = this.mv || this.u.map(function () { return 0; }); var wu = proj(tr, F[0], F[1]), w = SPRING.w, vm = 3.2 / tr.len, mvi = this.mv[i] + (w * w * (wu - this.u[i]) - 2 * SPRING.zeta * w * this.mv[i]) * dt; mvi = cl(mvi, -vm, vm); if (!SPRING.on) { mvi = dt > 0 ? (wu - this.u[i]) / dt : 0; mvi = cl(mvi, -vm * 3, vm * 3); } this.mv[i] = mvi; this.u[i] = cl(this.u[i] + mvi * dt, 0, 1); want = this.u[i]; spd = 0; }
      else if (i === this.c && this.ai[t]) { want = this.safeU(i); spd = .35 * AISPD; }
      else if (i === this.c) { want = this.u[i]; spd = 0; this.side *= Math.exp(-dt * 2); }
      else { want = this.aiWant(i, tgt, own, dt); spd = AISPD * (this.ai[t] ? .75 + this.diff * .35 : 1.0) * (tr.k === 'G' ? 1.6 : tr.k === 'D' && own >= 0 && own !== t ? .8 : 1); }
      if (this.mv && !this.fg(i)) this.mv[i] = this.lu ? this.lu[i] || 0 : 0;
      var du = want - this.u[i], mx = spd * dt / tr.len, u0 = this.u[i]; this.u[i] += cl(du, -mx, mx); if (!this.pg && dt > 0) { this.lu = this.lu || this.u.map(function () { return 0; }); this.lu[i] += ((this.u[i] - u0) / dt - this.lu[i]) * Math.min(1, dt * 12); }
      // stretch off the line toward the finger: offset saturates at REACH with an inverse-cube pull back
      if (this.sn[i] > 0) this.sn[i] -= dt; if (this.ln[i] > 0) this.ln[i] -= dt;
      var oo = this.o[i], kv = this.ko[i]; if (tr.k === 'G') { kv[0] = kv[1] = 0; this.gd = this.gd || [0, 0]; var gt = this.pg ? 0 : this.gDepth(i), gdv = this.gd[t], rt = this.fg(i) ? GD.rateHand : GD.rateAI; gdv += (gt - gdv) * (1 - Math.exp(-dt * rt)); this.gd[t] = gdv; oo[0] = 0; oo[1] = face(t) * gdv; }   // goalie: lateral on his crease line + depth in/out
      else if (kv[0] || kv[1] || this.dn[i] > 0 || (this.koff && this.koff[i])) { var kof = this.koff && this.koff[i]; oo[0] += kv[0] * dt; oo[1] += kv[1] * dt; var kd = Math.exp(-dt * 3.5); kv[0] *= kd; kv[1] *= kd; if (Math.abs(kv[0]) + Math.abs(kv[1]) < .01) kv[0] = kv[1] = 0;
        var om = Math.hypot(oo[0], oo[1]), mO = kof ? KO.maxO : CHK.maxO; if (om > mO) { oo[0] *= mO / om; oo[1] *= mO / om; kv[0] *= -.4; kv[1] *= -.4; this.ev = 'thud'; }   // springs/bounces back at the max knockback
        var bp = pos(tr, this.u[i]), wx = bp[0] + oo[0], wy = bp[1] + oo[1]; /* v0.9.24: side boards handled by the BRD clamp + ping below */
        for (var gs2 = 0; gs2 < 2; gs2++) { var gl2 = gs2 ? L - GY : GY, dr2 = gs2 ? 1 : -1, ps2 = (wy - gl2) * dr2; if (Math.abs(wx - .5) < GW + .02 && ps2 > -.02 && ps2 < .07) { kv[1] = -kv[1] * .6; kv[0] = kv[0] * .6 + (wx > .5 ? .3 : -.3); oo[1] += (ps2 < .025 ? -1 : 1) * dr2 * .01; this.ev = 'netbang'; } }
        if (this.dn[i] > 0) { this.dn[i] -= dt; var sl2 = Math.exp(-dt * (kof ? .5 : 1.2)); oo[0] *= sl2; oo[1] *= sl2; } else if (kof) { var bk = Math.exp(-dt * KO.back); oo[0] *= bk; oo[1] *= bk; if (Math.hypot(oo[0], oo[1]) < .004) this.koff[i] = 0; } else { /* v0.9.35: knocked off the peg -> gets up and glides back on */ var dk0 = Math.exp(-dt * 5); oo[0] *= dk0; oo[1] *= dk0; } }
      else if (!this.pg && V20.pivot && i === this.c && (F = this.fg(i))) { var bqp = pos(tr, this.u[i]), cd2 = R * .5 + tr.sl * SL * .75 + PR * .9, aP = this.ang[i], bx2 = F[0] - Math.cos(aP) * cd2 - bqp[0], by2 = F[1] - Math.sin(aP) * cd2 - bqp[1], bm2 = Math.hypot(bx2, by2) || 1e-6, be = Math.min(bm2, PIVOT.stretch), kk3 = Math.min(1, dt * 10); oo[0] += (bx2 / bm2 * be - oo[0]) * kk3; oo[1] += (by2 / bm2 * be - oo[1]) * kk3; }
      else if (!this.pg && (F = this.fg(i))) { var bq = pos(tr, this.u[i]), ddx = F[0] - bq[0], ddy = F[1] - bq[1], m = Math.hypot(ddx, ddy) || 1e-6, mj = m * JUT, eff = mj / Math.cbrt(1 + Math.pow(mj / (REACH * JUT), 3)), kk = Math.min(1, dt * 18);
        oo[0] += (ddx / m * eff - oo[0]) * kk; oo[1] += (ddy / m * eff - oo[1]) * kk; } else if (this.pk && this.pk[i]) { var pk = this.pk[i], bq2 = pos(tr, this.u[i]), ex = pk[0] - bq2[0], ey = pk[1] - bq2[1], em = Math.hypot(ex, ey) || 1e-6, ef = Math.min(em, AI.dStretch), k2 = Math.min(1, dt * 6); oo[0] += (ex / em * ef - oo[0]) * k2; oo[1] += (ey / em * ef - oo[1]) * k2; } else { var dk = Math.exp(-dt * 9); oo[0] *= dk; oo[1] *= dk; }
      { var bq9 = pos(tr, this.u[i]), lo = [BRD.m, .05 + BRD.m], hi = [1 - BRD.m, L - .05 - BRD.m];   // v0.9.24 board clamp + ping
        for (var ax = 0; ax < 2; ax++) { var w9 = bq9[ax] + oo[ax], sd9 = w9 < lo[ax] ? 1 : w9 > hi[ax] ? -1 : 0; if (!sd9) continue; oo[ax] = (sd9 > 0 ? lo[ax] : hi[ax]) - bq9[ax];
          if (tr.k === 'G') continue; this.bpT = this.bpT || TR.map(function () { return -9; }); var inV = Math.max(0, -kv[ax] * sd9);
          if ((inV > BRD.minIn || this.dn[i] > 0) && (this.clk || 0) - this.bpT[i] > BRD.cd) { this.bpT[i] = this.clk || 0; kv[ax] = sd9 * Math.max(BRD.v, inV * BRD.e); this.bpg = [((this.bpg || [0])[0] + 1) % 1000, i, ax === 0 ? sd9 : 0, ax === 1 ? sd9 : 0]; this.ev = 'boardping'; var bs = this.stat = this.stat || {}; bs.bping = (bs.bping || 0) + 1; }
          else if (kv[ax] * sd9 < 0) kv[ax] = 0; }
        var cx9 = cl(bq9[0] + oo[0], BRD.cr, 1 - BRD.cr), cy9 = cl(bq9[1] + oo[1], .05 + BRD.cr, L - .05 - BRD.cr), ex9 = bq9[0] + oo[0] - cx9, ey9 = bq9[1] + oo[1] - cy9, ed9 = Math.hypot(ex9, ey9), rr9 = BRD.cr - BRD.m;   // rounded corners
        if (ed9 > rr9) { var nx9 = ex9 / ed9, ny9 = ey9 / ed9; oo[0] = cx9 + nx9 * rr9 - bq9[0]; oo[1] = cy9 + ny9 * rr9 - bq9[1];
          if (tr.k !== 'G') { this.bpT = this.bpT || TR.map(function () { return -9; }); var vin = kv[0] * nx9 + kv[1] * ny9;
            if ((vin > BRD.minIn || this.dn[i] > 0) && (this.clk || 0) - this.bpT[i] > BRD.cd) { this.bpT[i] = this.clk || 0; var out = Math.max(BRD.v, vin * BRD.e); kv[0] += -nx9 * (vin + out); kv[1] += -ny9 * (vin + out); this.bpg = [((this.bpg || [0])[0] + 1) % 1000, i, -nx9, -ny9]; this.ev = 'boardping'; var bs2 = this.stat = this.stat || {}; bs2.bping = (bs2.bping || 0) + 1; }
            else if (vin > 0) { kv[0] -= nx9 * vin; kv[1] -= ny9 * vin; } } } }
      var P = this.pp(i), ta;
      var fF = !this.pg && tr.k !== 'G' ? this.fg(i) : null; if (fF && i === this.c && V20.pivot) { var pv = this.pvF = this.pvF && this.pvI === i ? this.pvF : [fF[0], fF[1]], kp = 1 - Math.exp(-dt * PIVOT.k); this.pvI = i; pv[0] += (fF[0] - pv[0]) * kp; pv[1] += (fF[1] - pv[1]) * kp; ta = Math.atan2(pv[1] - P[1], pv[0] - P[0]); if (V20.face) this.shieldA(i, P, dt); }   // pivot: stick (puck) points at the thumb
      else if (fF && !V20.face && Math.hypot(fF[0] - P[0], fF[1] - P[1]) > R * .8) ta = Math.atan2(fF[1] - P[1], fF[0] - P[0]);
      else if (i === this.c && V20.face) ta = this.shieldA(i, P, dt);
      else if (i === this.c) ta = this.aimA != null && this.ai[t] ? this.aimA : Math.atan2(goalOf(t) - P[1], .5 - P[0]) + Math.sin(this.hold * 6 + i) * .6;
      else ta = Math.atan2(tgt[1] - P[1], tgt[0] - P[0]);
      if (V20.hands && i === this.c) { this.dekeStep(i, dt); var hv2 = Math.abs((this.lu && this.lu[i]) || 0) * tr.len + Math.hypot(this.cpv ? this.cpv[0] : 0, this.cpv ? this.cpv[1] : 0) * .3, hk = cl((hv2 - HANDS.vmin) / HANDS.vmin, 0, 1); this.hm = (this.hm || 0) + (hk - (this.hm || 0)) * Math.min(1, dt * HANDS.ease); this.hph = (this.hph || 0) + dt * HANDS.f * Math.PI * 2; var dkb = this.hm * Math.sin(this.hph) * HANDS.amp + (1 - this.hm) * HANDS.side * (t ? -1 : 1), dkk = this.dk || 0; ta += (1 - dkk) * dkb + dkk * -(this.dz ? this.dz.d : 0) * DEKE.wide * Math.sin(ta); }   // stickhandling rock / hold on the forehand
      var rate = i === this.c ? 7 : 10; this.ang[i] += cl(adiff(ta, this.ang[i]), -rate * dt, rate * dt);
      var tf = !V20.face ? this.ang[i] : i === this.c ? (this.faT != null ? this.faT : ta) : tr.k === 'G' ? face(t) * Math.PI / 2 * -1 + Math.PI : Math.atan2(tgt[1] - P[1], tgt[0] - P[0]); if (tr.k === 'G') { var Pf = this.c >= 0 ? this.carryPos() : this.p, fo = face(t) > 0 ? Math.PI / 2 : -Math.PI / 2, fd = adiff(Math.atan2(Pf[1] - P[1], Pf[0] - P[0]), fo); if ((Pf[1] - (t ? GY : L - GY)) * face(t) < 0) fd *= GK.yawBehind; tf = fo + cl(fd, -Math.PI * .5, Math.PI * .5); } /* v0.9.52: square to the real puck; behind the net only half the turn */ this.faT = null; this.fa[i] += cl(adiff(tf, this.fa[i]), -FACE.turn * dt, FACE.turn * dt); if (i !== this.c) this.sh[i] *= Math.exp(-dt * 6); }
    this.gBody(dt); if (!this.pg) this.checks(dt);
    if (this.pause > 0 && !this.pg) return;
    if (this.pg) { this.puckPG(dt); return; }
    if (this.c >= 0 && this.c !== this.lastC) { this.touch(this.c); this.onCatch(this.c); } this.lastC = this.c;
    if (this.coolT > 0) { this.coolT -= dt; if (this.coolT <= 0) this.cool = -1; }
    if (this.c >= 0 && TR[this.c].k === 'G' && this.hold >= FREEZE.t) { this.freeze(); return; }
    if (this.c >= 0) { this.lt = 0; var ct = this.team(this.c);
      if (this.ai[ct] && !this.held(ct)) this.aiCarrier(dt); else { this.hold += dt; if (this.hold > 6) { this.ev = 'auto'; this.pass([0, face(ct)], 1.6); } }
      if (this.c >= 0) { var cp = this.carryPos(); if (this.lcp && this.lcpI === this.c && dt > 0) { var nv = [(cp[0] - this.lcp[0]) / dt, (cp[1] - this.lcp[1]) / dt], kv0 = Math.min(1, dt * 15); this.cpv = this.cpv ? [this.cpv[0] + (nv[0] - this.cpv[0]) * kv0, this.cpv[1] + (nv[1] - this.cpv[1]) * kv0] : nv; } else this.cpv = [0, 0]; this.lcp = cp; this.lcpI = this.c; this.p = cp; this.v = [0, 0]; this.z = 0; this.vz = 0;
        for (i = (1 - ct) * 6; i < (1 - ct) * 6 + 6; i++) { var q = this.tip(i); if (Math.hypot(q[0] - cp[0], q[1] - cp[1]) < PR + .02) { var gk = (TR[this.c].k === 'G' ? FREEZE.hack : 1) * (V20.face ? (FACE.pokeOpen + (FACE.pokeShield - FACE.pokeOpen) * (this.sh[this.c] || 0)) / FACE.pokeOpen : 1); if (Math.random() < dt * 2.2 * gk) { this.c = i; this.hold = 0; this.side = 0; this.ev = 'steal'; } else if (Math.random() < dt * 2 * gk) { var n = [cp[0] - q[0], cp[1] - q[1]], m = Math.hypot(n[0], n[1]) || 1; this.cool = this.c; this.coolT = .3; this.c = -1; this.v = [n[0] / m * .7, n[1] / m * .7]; this.ev = 'poke'; this.touch(i); } break; } } }
      if (this.c >= 0) return; }
    // loose puck. v0.9.18 dead-puck clock (reset by any stick touch; paused while airborne / stopped play)
    if (this.pause > 0 || this.pg || this.launch || this.air || this.z > 0) this.lt = 0; else { this.lt = (this.lt || 0) + dt; var lst = this.stat = this.stat || {}; lst.ltMax = Math.max(lst.ltMax || 0, this.lt); if (this.lt >= DEAD.t) { this.dead(); return; } }
    var sub = 3; for (var k = 0; k < sub; k++) { var h = dt / sub, p0x = this.p[0], p0y = this.p[1]; this.p[0] += this.v[0] * h; this.p[1] += this.v[1] * h; var f = Math.exp(-.55 * h); this.v[0] *= f; this.v[1] *= f;
      // tight inverse-square magnet around each stick blade so the puck isn't lost on tight edges
      for (var mg = 0; mg < 12 && this.z < .016; mg++) { if (mg === this.cool) continue; var bt = this.tip(mg), mx2 = bt[0] - this.p[0], my2 = bt[1] - this.p[1], md = Math.hypot(mx2, my2); var mr = Math.max(MAGR, TR[mg].sl * MAGOUT); if (md > mr || md < .004) continue; var acc = Math.min(6, MAGK / (md * md) + MAG2K / (md * md) * (1 - md / mr)); this.v[0] += mx2 / md * acc * h; this.v[1] += my2 / md * acc * h; }
      if (V20.grav && this.z < .016 && !this.air) { var gsp = Math.hypot(this.v[0], this.v[1]); this.slowT = gsp < GRAV.vslow ? Math.min(GRAV.ramp, (this.slowT || 0) + h) : Math.max(0, (this.slowT || 0) - h * 4); var gst = Math.pow(Math.max(0, 1 - gsp / GRAV.vslow), 3), grr = this.slowT / GRAV.ramp, grm = grr * grr * (3 - 2 * grr); grm = grm * grm * grm;
        if (gst * grm > .001) { var gb = -1, gbd = GRAV.r, gbt = null; for (var gq = 0; gq < 12; gq++) { if (gq === this.cool || this.dn[gq] > 0) continue; var gt2 = this.tip(gq), gd0 = Math.hypot(gt2[0] - this.p[0], gt2[1] - this.p[1]); if (gd0 < gbd) { gbd = gd0; gb = gq; gbt = gt2; } }
          if (gb >= 0 && gbd > .004) { var ga = GRAV.k * gst * grm * (1 - gbd / GRAV.r); this.v[0] += (gbt[0] - this.p[0]) / gbd * ga * h; this.v[1] += (gbt[1] - this.p[1]) / gbd * ga * h; } } }   // v0.9.21 puck gravity toward the nearest player
      // 3D puck height: gravity, strong pull back to the ice (upward motion damped), low bounce on landing
      if (this.z > 0 || this.vz > 0) { this.vz -= 3.5 * h; if (this.vz > 0) this.vz *= Math.exp(-h * 1.4); this.z += this.vz * h; if (this.z <= 0) { this.z = 0; if (this.vz < -.18 && (!BNC.hops || (this.hop = (this.hop || 0) + 1) <= BNC.hops)) { this.vz = -this.vz * (BNC.land || ((this.wild != null ? this.wild : WILD.on) ? WILD.bounce : .32)); this.ev = this.ev || 'land'; } else { this.vz = 0; this.hop = 0; } } this.dome(); }
      if (this.arc) { var A = this.arc; A.t += h; var af = Math.min(1, A.t / A.T); this.p = [A.a[0] + (A.b[0] - A.a[0]) * af, A.a[1] + (A.b[1] - A.a[1]) * af]; this.v = A.v.slice(); if (this.z <= 0 || af >= 1) { var ca = Math.cos(A.sp), sa = Math.sin(A.sp); this.v = [(A.v[0] * ca - A.v[1] * sa) * .12, (A.v[0] * sa + A.v[1] * ca) * .12]; this.arc = null; } }
      if (this.fire > 0) { this.fire -= h; if (this.c >= 0 || Math.hypot(this.v[0], this.v[1]) < RIP.minSp * .5) this.fire = 0; if (this.fire <= 0) { this.fire = 0; this.rt = 0; } }
      var x = this.p[0], y = this.p[1], NH = .045, ND = .05, sp0 = Math.hypot(this.v[0], this.v[1]);
      // goal only when the puck centre (50% of it) is past the goal line, under the crossbar, inside the posts
      // v0.9.35 solid cage: if the puck got into the cage footprint this sub-step but did NOT come through the mouth (it was behind or beside the net), push it back out the way it came and bounce
      for (var gs = 0; gs < 2; gs++) { var gl = gs ? L - GY : GY, dir = gs ? 1 : -1, past = (y - gl) * dir, inM = Math.abs(x - .5) < GW - PR * .3, pp0 = (p0y - gl) * dir, bx0 = Math.abs(p0x - .5);
        if (this.z < NH && past > 0 && past < ND + PR && Math.abs(x - .5) < GW + PR && !(pp0 <= 0 && bx0 < GW)) { if (pp0 >= ND + PR - .001 || (pp0 > ND * .5 && bx0 < GW + PR)) { this.p[1] = y = gl + dir * (ND + PR); past = ND + PR; this.v[1] = Math.abs(this.v[1]) * dir * Math.max(NET.mesh, .3); this.v[0] *= .7; }
          else { var sg0 = (pp0 > 0 ? p0x : x) > .5 ? 1 : -1; this.p[0] = x = .5 + sg0 * (GW + PR); this.v[0] = Math.abs(this.v[0]) * sg0 * Math.max(NET.mesh, .3); this.v[1] *= .7; }
          inM = false; this.ev = this.ev || 'mesh'; this.mw = Math.min(1, sp0 * .6); var sn = this.stat = this.stat || {}; sn.cageBlock = (sn.cageBlock || 0) + 1; }
        if (inM && past > 0 && past < ND) { if (this.z < NH) { if (!(pp0 <= .0005 || this.gm === gs)) { var sb = this.stat = this.stat || {}; sb.behindBlock = (sb.behindBlock || 0) + 1; continue; } this.goal(gs); return; } if (this.v[1] * dir > 0) { this.v[1] = -this.v[1] * BNC.n; this.v[0] *= BNC.t; this.bnc(sp0); this.vz = Math.abs(this.vz) * .5 + .08; this.ev = 'bar'; } }
        // back/sides of the net cage: bounce off from outside
        var bx = Math.abs(x - .5); if (this.z < NH && bx < GW + PR && past > ND - .004 && past < ND + PR) { this.p[1] = gl + dir * (ND + PR); this.v[1] = Math.abs(this.v[1]) * dir * NET.mesh; this.v[0] *= .5; this.ripHit('mesh', sp0); this.ev = this.ev === 'netoff' ? 'netoff' : 'mesh'; this.mw = Math.min(1, sp0 * .6); }
        if (this.z < NH && past > 0 && past < ND && bx > GW - PR * .3 && bx < GW + PR) { var sg = x > .5 ? 1 : -1; this.p[0] = .5 + sg * (GW + PR); this.v[0] = Math.abs(this.v[0]) * sg * NET.mesh; this.v[1] *= .5; this.ripHit('mesh', sp0); this.ev = this.ev === 'netoff' ? 'netoff' : 'mesh'; this.mw = Math.min(1, sp0 * .6); } }
      if (this.fire > 0 && (x < PR || x > 1 - PR || y < .05 + PR || y > L - .05 - PR)) { this.ripHit('board', sp0); if (this.rxStop) { this.rxStop = 0; return; } }
      if (x < PR) { this.p[0] = PR; this.v[0] = Math.abs(this.v[0]) * BNC.n; this.v[1] *= BNC.t; this.bnc(sp0); this.lift(sp0); } if (x > 1 - PR) { this.p[0] = 1 - PR; this.v[0] = -Math.abs(this.v[0]) * BNC.n; this.v[1] *= BNC.t; this.bnc(sp0); this.lift(sp0); }
      if (y < .05 + PR) { this.p[1] = .05 + PR; this.v[1] = Math.abs(this.v[1]) * BNC.n; this.v[0] *= BNC.t; this.bnc(sp0); this.lift(sp0); } if (y > L - .05 - PR) { this.p[1] = L - .05 - PR; this.v[1] = -Math.abs(this.v[1]) * BNC.n; this.v[0] *= BNC.t; this.bnc(sp0); this.lift(sp0); }
      // posts
      [[.5 - GW, GY], [.5 + GW, GY], [.5 - GW, L - GY], [.5 + GW, L - GY]].forEach(function (po) { var dx = me.p[0] - po[0], dy = me.p[1] - po[1], d = Math.hypot(dx, dy); if (d < PR + .008) { var nx = dx / d, ny = dy / d, vn = me.v[0] * nx + me.v[1] * ny; me.p = [po[0] + nx * (PR + .008), po[1] + ny * (PR + .008)]; if (vn < 0) { var tx = me.v[0] - vn * nx, ty = me.v[1] - vn * ny; me.v[0] = tx * BNC.t - vn * BNC.n * nx; me.v[1] = ty * BNC.t - vn * BNC.n * ny; me.bnc(sp0); } me.lift(sp0 * 1.3); me.ev = 'post'; me.ripHit('post', sp0); } });
      if (this.rxStop) { this.rxStop = 0; return; }
      var off = Math.random() < .5 ? 0 : 6; for (var n = 0; n < 12; n++) { i = (n + off) % 12; if (this.air && this.vz < 0 && this.z < FO.grabZ) this.air = false; if (!this.air && this.z < .016 && this.dn[i] <= 0) { var rt = this.tip(i); if (Math.hypot(rt[0] - this.p[0], rt[1] - this.p[1]) < PR + SCR.reach) { if (this.scramble(i)) return; } } if (CAP.on && !this.air && this.z > CAP.z0 && i !== this.cool && this.dn[i] <= 0) { var Pc = this.pp(i), spc = Math.hypot(this.v[0], this.v[1]), rc = TR[i].k === 'G' ? CAP.rG : CAP.r; if (Math.hypot(this.p[0] - Pc[0], this.p[1] - Pc[1]) < rc && this.z < CAP.h && spc < (TR[i].k === 'G' ? CAP.vG : CAP.v)) { var hz = this.z; this.z = 0; this.vz = 0; this.c = i; this.hold = 0; this.side = 0; this.to = -1; this.aimA = null; this.ev = TR[i].k === 'G' ? 'glove' : 'hcatch'; this.hcN = (this.hcN || 0) + 1; this.hc = [i, this.hcN, Math.round(hz * 1000) / 1000]; this.touch(i); return; } }   // v0.9.51 capture sphere: an airborne loose puck inside a player's catch sphere is caught and brought to the ice
        if (i === this.cool || this.z > .05 || this.air || this.dn[i] > 0) continue; var Pb = this.pp(i), Tp = this.tip(i), sx = Tp[0] - Pb[0], sy = Tp[1] - Pb[1], sl2 = sx * sx + sy * sy, ff = cl(((this.p[0] - Pb[0]) * sx + (this.p[1] - Pb[1]) * sy) / sl2, 0, 1), cx = Pb[0] + sx * ff, cy = Pb[1] + sy * ff, ddx = this.p[0] - cx, ddy = this.p[1] - cy, dd = Math.hypot(ddx, ddy);
        if (ff > .45 && dd < PR + (i === this.to ? .018 : .006) && this.z < .016) { var sp3 = Math.hypot(this.v[0], this.v[1]); if (sp3 < (i === this.to ? 9 : TR[i].k === 'G' ? 1.6 : 1.2)) { this.c = i; this.hold = 0; this.to = -1; this.aimA = null; if (TR[i].k === 'G') this.ev = 'save'; return; }
          var nx2 = ddx / (dd || 1), ny2 = ddy / (dd || 1), vn2 = this.v[0] * nx2 + this.v[1] * ny2; this.p = [cx + nx2 * (PR + .006), cy + ny2 * (PR + .006)]; if (vn2 < 0) { this.v[0] -= 1.7 * vn2 * nx2; this.v[1] -= 1.7 * vn2 * ny2; } this.lt = 0; this.ev = TR[i].k === 'G' ? 'save' : 'bump'; this.touch(i); continue; }
        var Q = this.pp(i), grq = TR[i].k === 'G' && this.gr && this.gr[TR[i].t]; if (grq) { var ge = (grq.ext || GREACH.ext) * Math.min(1, grq.t / (grq.T || GREACH.t) * 2.5); if ((this.p[0] - Q[0]) * grq.d > 0) Q = [Q[0] + grq.d * Math.min(ge, Math.abs(this.p[0] - Q[0])), Q[1]]; }
        var dx = this.p[0] - Q[0], dy = this.p[1] - Q[1], d = Math.hypot(dx, dy); if (d >= R * .5 + PR) continue;
        var spd2 = Math.hypot(this.v[0], this.v[1]), catchV = i === this.to ? 9 : TR[i].k === 'G' ? 1.7 : 1.25;
        if (TR[i].k === 'G' && spd2 >= catchV && spd2 < FREEZE.gloveMax && (this.p[0] - Q[0]) * (TR[i].t ? -1 : 1) > R * .15 && Math.random() < FREEZE.glove) { this.c = i; this.hold = 0; this.side = 0; this.to = -1; this.ev = 'glove'; this.freeze(); return; }
        if (spd2 < catchV) { this.c = i; this.hold = 0; this.side = 0; this.to = -1; this.aimA = null; if (TR[i].k === 'G') this.ev = 'save'; return; }
        var nx = dx / d, ny = dy / d, vn = this.v[0] * nx + this.v[1] * ny; this.p = [Q[0] + nx * (R * .5 + PR), Q[1] + ny * (R * .5 + PR)]; if (vn < 0) { this.v[0] -= 1.7 * vn * nx; this.v[1] -= 1.7 * vn * ny; this.v[0] *= .8; this.v[1] *= .8; this.lift(spd2); } this.ev = TR[i].k === 'G' ? 'save' : 'bump'; this.touch(i); } }
  };
  // held player moving fast into an opponent body-checks him: knockback off his track, hard hits knock him down sliding
  // v0.9.17 helpers: bounce stats, dome, check knock, scramble pop-up
  // v0.9.20 shield: returns the stick angle for carrier i; sets body facing target (faT) and shield amount sh[i]
  Sim.prototype.shieldA = function (i, P, dt) { var t = this.team(i), aiA = this.ai[t] && !this.fg(i) && this.aimA != null, up = aiA ? this.aimA : Math.atan2(goalOf(t) - P[1], .5 - P[0]), best = -1, bd = FACE.r;
    for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { if (this.dn[j] > 0 || TR[j].k === 'G') continue; var q = this.pp(j), d = Math.hypot(q[0] - P[0], q[1] - P[1]); if (d < bd) { bd = d; best = j; } }
    var w = best < 0 ? 0 : cl(1 - (bd - R) / (FACE.r - R), 0, 1); this.sh[i] += (w - this.sh[i]) * Math.min(1, dt * 6); var k = this.sh[i];
    if (best < 0 || k < .02) { this.faT = up; return up + (aiA ? 0 : Math.sin((this.hold || 0) * 6 + i) * .25); }
    var Q = this.pp(best), th = Math.atan2(Q[1] - P[1], Q[0] - P[0]), away = th + Math.PI, s1 = th + Math.PI / 2, s2 = th - Math.PI / 2, side = Math.abs(adiff(s1, up)) < Math.abs(adiff(s2, up)) ? s1 : s2;
    this.faT = up + adiff(side, up) * k; return up + adiff(away, up) * k * FACE.reach; };
  Sim.prototype.pokeOK = function () { if (!V20.face || this.c < 0) return true; var k = this.sh[this.c] || 0; return Math.random() < FACE.pokeOpen + (FACE.pokeShield - FACE.pokeOpen) * k; };
  Sim.prototype.bnc = function (sp0) { if (sp0 > .3) { var s = this.stat = this.stat || {}; s.bn = (s.bn || 0) + 1; s.br = (s.br || 0) + Math.hypot(this.v[0], this.v[1]) / sp0; } };
  Sim.prototype.dome = function () { var dx = (this.p[0] - .5) / DOME.a, dy = (this.p[1] - L / 2) / DOME.b, dz = this.z / DOME.c, q = dx * dx + dy * dy + dz * dz; if (q < 1 || this.z <= 0) return;
    var k = 1 / Math.sqrt(q); this.z *= k; var nx = dx / DOME.a, ny = dy / DOME.b, nz = dz / DOME.c, nm = Math.hypot(nx, ny, nz); nx /= nm; ny /= nm; nz /= nm; var vn = this.v[0] * nx + this.v[1] * ny + this.vz * nz;
    if (vn > 0) { var f = (1 + DOME.e) * vn; this.v[0] -= f * nx; this.v[1] -= f * ny; this.vz -= f * nz; } this.ripHit('dome', Math.hypot(this.v[0], this.v[1])); if (this.ev !== 'glass') this.ev = 'dome'; var s = this.stat = this.stat || {}; s.dome = (s.dome || 0) + 1; };
  Sim.prototype.knock = function (j, vx, vy) { var Pj = this.pp(j), loose = this.c < 0 && this.z < .05 && !this.air && Math.hypot(this.p[0] - Pj[0], this.p[1] - Pj[1]) < KNOCK.r; if (!(loose || this.c === j) || Math.random() >= KNOCK.p) return;
    var m = Math.hypot(vx, vy); if (m < 1e-6) return; var sp = Math.min(KNOCK.max, KNOCK.sp + KNOCK.k * m); if (this.c === j) { this.p = this.carryPos(); this.c = -1; } this.cool = j; this.coolT = .35; this.v = [vx / m * sp, vy / m * sp]; this.to = -1; this.pf = -1; this.lt = 0; this.ev = 'knock'; var s = this.stat = this.stat || {}; s.knock = (s.knock || 0) + 1; };
  Sim.prototype.scramble = function (i) { if (this.clk - (this.scrT || -9) < SCR.cd) return false; var t = TR[i].t, nr = PR + SCR.reach + SCR.dt * SCR.v, hit = false; for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { if (this.dn[j] > 0) continue; var q = this.tip(j); if (Math.hypot(q[0] - this.p[0], q[1] - this.p[1]) < nr) hit = true; } if (!hit) return false; var s0 = this.stat = this.stat || {}; s0.scr = (s0.scr || 0) + 1; this.scrT = this.clk; if (Math.random() >= SCR.p) return false;
    this.v = [(Math.random() - .5) * SCR.side, (Math.random() - .5) * SCR.side]; this.z = .002; this.vz = SCR.vz * (.95 + Math.random() * .1); this.air = true; this.cool = -1; this.to = -1; this.pf = -1; this.ev = 'popup'; this.touch(-2); var s = this.stat = this.stat || {}; s.pop = (s.pop || 0) + 1; return true; };
  Sim.prototype.checks = function (dt) { var pv = this.prevP, P = []; for (var i = 0; i < 12; i++) P.push(this.pp(i)); this.prevP = P; if (!pv.length || dt <= 0) return;
    for (var i = 0; i < 12; i++) { if (!this.fg(i) && this.sn[i] <= 0) continue; var ix = (P[i][0] - pv[i][0]) / dt, iy = (P[i][1] - pv[i][1]) / dt, vh = (this.vh = this.vh || [])[i] || [0, 0], hd = Math.exp(-dt * 7); if (Math.hypot(ix, iy) > Math.hypot(vh[0], vh[1]) * hd) vh = [ix, iy]; else vh = [vh[0] * hd, vh[1] * hd]; this.vh[i] = vh; var vx = vh[0], vy = vh[1], sp = Math.max(Math.hypot(vx, vy), Math.hypot(ix, iy)); if (sp < CHK.min) continue;
      for (var j = (1 - TR[i].t) * 6; j < (1 - TR[i].t) * 6 + 6; j++) { var dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy) || 1e-6, key = i * 12 + j; if (d > R * 2.1 || (this.cd[key] || 0) > this.clk) continue;
        var nx = dx / d, ny = dy / d, into = Math.max(vx * nx + vy * ny, ix * nx + iy * ny); if (into < CHK.min * .7) continue; this.cd[key] = this.clk + CHK.cd; var cks = this.stat = this.stat || {}; cks.chk = (cks.chk || 0) + 1;
        var kb = CHK.kb * (TR[j].k === 'G' ? .5 : 1) * into; this.ko[j][0] += nx * kb + vx * .15; this.ko[j][1] += ny * kb + vy * .15;
        var kos = cl((into - CHK.min) / (CHK.hard - CHK.min), 0, 1); if (KO.on && TR[j].k !== 'G' && this.dn[j] <= 0 && Math.random() < KO.p0 + (KO.p1 - KO.p0) * kos) { this.koff = this.koff || TR.map(function () { return 0; }); this.koff[j] = 1; this.dn[j] = CHK.down; this.ko[j][0] += nx * KO.push * into; this.ko[j][1] += ny * KO.push * into; if (this.c === j) { this.c = -1; this.cool = j; this.coolT = .4; this.v = [nx * 1.2 + vx * .3, ny * 1.2 + vy * .3]; } this.kdn = [((this.kdn || [0])[0] + 1) % 1000, j, i]; var ko2 = this.stat = this.stat || {}; ko2.koff = (ko2.koff || 0) + 1; this.ev = 'bigcheck'; }
        else if (KD.on && into <= CHK.hard && TR[j].k !== 'G' && this.dn[j] <= 0 && Math.random() < KD.p * cl((into - KD.min) / (CHK.hard - KD.min), 0, 1)) { var kt = KD.t0 + Math.random() * (KD.t1 - KD.t0); this.dn[j] = kt; this.kdT = this.kdT || TR.map(function () { return 0; }); this.kdT[j] = kt; this.ko[j][0] += nx * KD.push * into; this.ko[j][1] += ny * KD.push * into; if (this.c === j) { this.c = -1; this.cool = j; this.coolT = .4; this.v = [nx * 1.0 + vx * .3, ny * 1.0 + vy * .3]; } this.kdn = [((this.kdn || [0])[0] + 1) % 1000, j, i]; var ks = this.stat = this.stat || {}; ks.kd = (ks.kd || 0) + 1; this.ev = 'knockdown'; }
        else if (into > CHK.hard && TR[j].k !== 'G') { this.dn[j] = CHK.down; this.ev = 'bigcheck'; if (this.c === j) { this.c = -1; this.cool = j; this.coolT = .4; this.v = [nx * 1.2 + vx * .3, ny * 1.2 + vy * .3]; } } else this.ev = 'check';
        this.knock(j, vx, vy);
        this.fx = [((this.fx || [0])[0] + 1) % 1000, this.ev === 'bigcheck' ? 'B' : this.ev === 'knockdown' ? 'K' : 'C', i, Math.round(nx * 100) / 100, Math.round(ny * 100) / 100];
        this.hit = { j: j, s: Math.min(1, into / 3) }; this.ln[i] = .35; this.ko[i][0] += nx * kb * .3; this.ko[i][1] += ny * kb * .3; } } };
  // armed one-timer: next own player to touch the puck fires it at the net, error cone grows with pressure / bouncing puck
  // v0.9.34 AUTO ONE-TIMER: a human team's winger -> center pass that the center receives is shot at once (same aim as the armed one-timer),
  // unless a finger is already holding that center (then he keeps it). ?auto1t=0 turns it off.
  var AUTO1T = !qoff('auto1t');
  Sim.prototype.onCatch = function (i) { var t = this.team(i), A = this.ot[t], pf = this.pf; this.pf = -1; this.ot[1 - t] = null;
    if (!A && AUTO1T && !this.ai[t] && pf >= 0 && pf !== i && this.team(pf) === t && TR[pf].k === 'W' && TR[i].k === 'C') A = { auto: 1 };
    if (!A) return; this.ot[t] = null; for (var fh = t; fh < 10; fh += 2) if (this.grab[fh] === i && (this.fing[fh] || A.auto)) { this.ev = 'catch'; return; }   // auto: thumb down on him (even still) = keep it
    if (A.auto) { var st = this.stat = this.stat || {}; st.auto1t = (st.auto1t || 0) + 1; }
    var cp = this.carryPos(), gy = goalOf(t), pres = Math.max(0, 1 - this.clear(cp, t) / .08), bounce = this.z > .003 || Math.hypot(this.v[0], this.v[1]) > 2.2 ? 1 : 0, err = Math.min(OT.max, OT.base + OT.press * pres + OT.bounce * bounce) * Math.PI / 180 * (Math.random() * 2 - 1);
    var a = Math.atan2(gy - cp[1], .5 + (Math.random() - .5) * GW * .6 - cp[0]) + err; this.release([Math.cos(a), Math.sin(a)], OT.sp); this.ev = 'onetimer'; this.otFx = 1; };
  // v0.9.16 poke aim: the poke (fx dir, stick angle afterwards, phone red bar) points at the opposing carrier; the reach test still uses the stick toward the puck (unchanged steal odds)
  Sim.prototype.stickCheck = function (team, allow, who) { var best = who != null ? who : -1, bd = who != null ? -1 : 9; for (var i = team * 6; i < team * 6 + 6; i++) { if (allow && allow.indexOf(i) < 0) continue; if (bd < 0) break; if (this.dn[i] > 0 || TR[i].k === 'G') continue; var q = this.pp(i), d = Math.hypot(q[0] - this.p[0], q[1] - this.p[1]); if (d < bd) { bd = d; best = i; } }
    if (best < 0) return; var P = this.pp(best), oc = this.c >= 0 && this.team(this.c) !== team ? this.pp(this.c) : null, aim = oc || this.p; this.pkAim = aim; this.ang[best] = Math.atan2(this.p[1] - P[1], this.p[0] - P[0]); var aa = Math.atan2(aim[1] - P[1], aim[0] - P[0]); this.fx = [((this.fx || [0])[0] + 1) % 1000, 'P', best, Math.round(Math.cos(aa) * 100) / 100, Math.round(Math.sin(aa) * 100) / 100]; this.ln[best] = .25; this.swing = [best, .15]; var T = this.tip(best), dd = Math.hypot(T[0] - this.p[0], T[1] - this.p[1]), reach = (PR + .02) * POKEX;
    if (oc) this.ang[best] = Math.atan2(oc[1] - P[1], oc[0] - P[0]);   // stick (and the phone's red poke bar) point at the opposing carrier
    if (dd > reach || this.air) return; if (this.c >= 0 && this.team(this.c) !== team && !this.pokeOK()) { this.ev = 'shielded'; return; } if (this.c >= 0) { var n = [this.p[0] - T[0], this.p[1] - T[1]], m = Math.hypot(n[0], n[1]) || 1; this.cool = this.c; this.coolT = .3; this.c = -1; this.v = [n[0] / m * .9, n[1] / m * .9]; this.ev = 'poke'; this.touch(best); }
    else { var gy = goalOf(team), a = Math.atan2(gy - this.p[1], .5 - this.p[0]) + (Math.random() - .5) * .8; this.v[0] += Math.cos(a) * 1.1; this.v[1] += Math.sin(a) * 1.1; this.lt = 0; this.ev = 'jab'; this.touch(best); } };
  Sim.prototype.hack = function (team, allow) { var me = this, ids = []; for (var i = team * 6; i < team * 6 + 6; i++) { if (allow && allow.indexOf(i) < 0) continue; if (this.dn[i] > 0) continue; var q = this.pp(i), d = Math.hypot(q[0] - this.p[0], q[1] - this.p[1]); if (d < HACK.r) ids.push([d, i]); }
    ids.sort(function (a, b) { return a[0] - b[0]; }); ids = ids.slice(0, HACK.max); var gy = goalOf(team);
    ids.forEach(function (e) { var i = e[1], P = me.pp(i); me.ang[i] = Math.atan2(me.p[1] - P[1], me.p[0] - P[0]) + (Math.random() - .5) * .5; me.ln[i] = .22; me.swing = [i, .15]; var T = me.tip(i), dd = Math.hypot(T[0] - me.p[0], T[1] - me.p[1]);
      if (dd < HACK.reach + PR && !me.air) { if (me.c >= 0 && Math.random() < HACK.steal) { me.c = i; me.hold = 0; me.ev = 'steal'; return; } if (me.c < 0) { var a = Math.atan2(gy - me.p[1], .5 - me.p[0]) + (Math.random() - .5) * 1.2; me.v[0] += Math.cos(a) * HACK.kick; me.v[1] += Math.sin(a) * HACK.kick; me.lt = 0; me.ev = 'jab'; me.touch(i); } } }); };
  // v0.9.23 touch log for replays: tk = [counter, player] on every stick contact (catch, bump/redirect, poke, jab); -2 = scramble (contested)
  Sim.prototype.touch = function (i) { this.tk = [((this.tk || [0])[0] + 1) % 1000, i]; };
  Sim.prototype.puckPG = function (dt) { if (this.fz) { this.v = [0, 0]; return; } if (this.mw > 0) this.mw = Math.max(0, this.mw - dt * 1.5); var h = dt / 3; for (var k = 0; k < 3; k++) { this.p[0] += this.v[0] * h; this.p[1] += this.v[1] * h; var f = Math.exp(-1.4 * h); this.v[0] *= f; this.v[1] *= f;
      if (this.z > 0 || this.vz > 0) { this.vz -= 3.5 * h; this.z += this.vz * h; if (this.z <= 0) { this.z = 0; this.vz = this.vz < -.15 ? -this.vz * .3 : 0; } }
      var bot = this.p[1] > L / 2, gl = bot ? L - GY : GY, dir = bot ? 1 : -1, past = (this.p[1] - gl) * dir, ND = .05, x = this.p[0];
      if (past > -PR) { var sp = Math.hypot(this.v[0], this.v[1]);
        if (past < PR * .6) { this.p[1] = gl + dir * PR * .6; this.v[1] = Math.abs(this.v[1]) * dir * NET.post; }   // mouth: back off the posts (hard)
        if (past > ND - PR && this.v[1] * dir > 0) { this.p[1] = gl + dir * (ND - PR); this.v[1] = -this.v[1] * NET.mesh; this.v[0] *= NET.give; if (this.z > .004) this.vz = Math.min(this.vz, -.05); this.mw = Math.max(this.mw || 0, Math.min(1, sp * .7)); this.ev = 'mesh'; }   // soft back: catches it, drops it
        if (Math.abs(x - .5) > GW - PR && (x - .5) * this.v[0] > 0) { var sg = x > .5 ? 1 : -1; this.p[0] = .5 + sg * (GW - PR); this.v[0] = -this.v[0] * NET.mesh; this.v[1] *= NET.give; this.mw = Math.max(this.mw || 0, Math.min(1, sp * .7)); this.ev = 'mesh'; } }
      if (this.p[1] < .05 + PR) { this.p[1] = .05 + PR; this.v[1] = Math.abs(this.v[1]) * .7; } if (this.p[1] > L - .05 - PR) { this.p[1] = L - .05 - PR; this.v[1] = -Math.abs(this.v[1]) * .7; } if (this.p[0] < PR) { this.p[0] = PR; this.v[0] = Math.abs(this.v[0]) * .7; } if (this.p[0] > 1 - PR) { this.p[0] = 1 - PR; this.v[0] = -Math.abs(this.v[0]) * .7; } } };
  Sim.prototype.dead = function () { this.lt = 0; this.freeze(); if (Math.abs(this.p[1] - L / 2) <= DEAD.zone) this.fz = [.5, L / 2]; this.ev = 'whistle'; var s = this.stat = this.stat || {}; s.dead = (s.dead || 0) + 1; };
  Sim.prototype.freeze = function () { var g = this.c, P = g >= 0 ? this.pp(g) : this.p, end = P[1] < L / 2; this.fz = [P[0] < .5 ? .25 : .75, end ? .36 : L - .36];   // faceoff dot in that defensive zone, on the puck's side
    this.pg = true; this.fzk = 1; this.uv = (this.lu || this.u.map(function () { return 0; })).slice(); this.c = -1; this.to = -1; this.ot = [null, null]; this.v = [0, 0]; this.vz = 0; this.msg = 'WHISTLE'; this.pause = FREEZE.pause + 1.1; this.ev = this.ev === 'glove' ? 'glove' : 'whistle'; this.wh = (this.wh || 0) + 1; };
  Sim.prototype.lift = function (sp) { var on = this.wild != null ? this.wild : WILD.on; if (sp > 1.3 && Math.random() < .25) this.vz = Math.max(this.vz, Math.min(.4, (sp - 1.3) * .3 * Math.random()));
    if (on && sp > 1.0 && Math.random() < WILD.p) this.vz = Math.max(this.vz, Math.min(WILD.max, (sp - 1.0) * WILD.k * Math.random())); };
  // goalie depth target (rink units, + = out toward the play)
  Sim.prototype.gDepth = function (i) { var t = TR[i].t, W = GD.wPx, mx = GD.out * W, mn = -GD.back * W, F = this.fg(i);
    if (F) { var Q = pos(TR[i], this.u[i]); return cl((F[1] - Q[1]) * face(t), mn, mx); }
    var gl = goalOf(1 - t), along = (this.p[1] - gl) * face(t), wide = Math.abs(this.p[0] - .5);
    if (along < .02 || wide > GD.wide || along > GD.quiet) return 0;   // behind the net / wide / quiet: settle back on the line
    var k = cl((GD.quiet - along) / .6, 0, 1) * (1 - wide / GD.wide), brk = this.c >= 0 && this.team(this.c) !== t && this.clear(this.carryPos(), 1 - t) > .12;
    return mx * GSAFE.outK * k * (brk ? GD.brk : GD.norm) * (this.shotLikely(t) ? GSAFE.shotK : 1); };
  Sim.prototype.shotLikely = function (t) { if (this.c < 0 || this.team(this.c) === t) return false; var P = this.pp(this.c), gy = goalOf(1 - t); return Math.abs(P[1] - gy) < GSAFE.shotRange && Math.abs(P[0] - .5) < .42; };   // opposing carrier in range of OUR net (t defends goalOf(1-t))
  // goalie <-> skater bodies: shove each other for space (skaters can't skate through him)
  Sim.prototype.gBody = function (dt) { for (var t = 0; t < 2; t++) { var g = t * 6, G = this.pp(g); for (var j = 0; j < 12; j++) { if (j === g || TR[j].k === 'G') continue; var Q = this.pp(j), dx = Q[0] - G[0], dy = Q[1] - G[1], d = Math.hypot(dx, dy) || 1e-6; if (d >= R) continue;
      var nx = dx / d, ny = dy / d, ov = R - d; this.o[j][0] += nx * ov * GD.push; this.o[j][1] += ny * ov * GD.push; this.ko[j][0] += nx * ov * GD.shove; this.ko[j][1] += ny * ov * GD.shove; if (this.gd) this.gd[t] = Math.max(-GD.back * GD.wPx, this.gd[t] - ny * face(t) * ov * (1 - GD.push)); } } };
  Sim.prototype.periodEnd = function () { var sc = this.sc, ORD = ['1ST', '2ND', '3RD', '4TH', '5TH'];
    if (this.per >= PER.n && sc[0] !== sc[1]) { this.over = sc[0] > sc[1] ? 0 : 1; this.msg = ''; this.ev = 'final'; return true; }
    var m = this.per < PER.n ? 'END OF ' + ORD[this.per - 1] + ' \u00b7 LINE CHANGE' : 'TIED \u00b7 OVERTIME'; this.per++; this.time = this.per <= PER.n ? PER.len : 0;
    this.pg = true; this.fz = null; this.uv = this.u.map(function () { return 0; }); this.c = -1; this.to = -1; this.ot = [null, null]; this.v = [0, 0]; this.vz = 0; this.z = 0; this.air = false; this.arc = null; this.fire = 0; this.rt = 0;
    for (var i = 0; i < 12; i++) { this.dn[i] = 0; this.ko[i] = [0, 0]; } this.koff = null; this.line = (this.line || 0) + 1;   // line change: fresh legs, everyone glides back to his spot
    this.msg = m; this.pause = PER.brk + 1.1; this.srvK = 'open'; this.ev = 'period'; this.wh = (this.wh || 0) + 1; return false; };
  Sim.prototype.goal = function (t) { this.sc[t]++; this.ev = 'goal' + t; if ((!PER.on && this.sc[t] >= WIN) || (!PER.on && this.time <= 0) || (PER.on && this.per > PER.n)) { this.over = t; this.msg = ''; return; } this.pg = true; this.fz = null; this.uv = (this.lu || this.u.map(function () { return 0; })).slice(); this.c = -1; this.to = -1; this.ot = [null, null]; this.ev = 'goal' + t; this.msg = 'GOAL!'; this.pause = GOALP; this.lastGoal = t; this.gIn = t; if (this.fire > 0 && this.rt >= 2) this.rx = [(this.rx ? this.rx[0] : 0) + 1, 'tear', t]; this.fire = 0; this.rt = 0; this.srvK = 'reg'; };
  // ---- v0.9.25 max rip + dispenser serves ----
  Sim.prototype.ripT = function (sp) { var t = !RIP.on ? 0 : sp >= RIP.glass ? 3 : sp >= RIP.net ? 2 : sp >= RIP.fire ? 1 : 0; this.rt = t; this.fire = t ? RIP.t : 0; this.rg = t >= 3 && Math.random() < (RIP.glassP == null ? 1 : RIP.glassP); if (t) { this.rx = [(this.rx ? this.rx[0] : 0) + 1, 'fire', t]; var s = this.stat = this.stat || {}; s.rip = (s.rip || 0) + 1; } };
  Sim.prototype.ripHit = function (k, sp) { if (!RIP.on || !(this.fire > 0) || sp < RIP.minSp || this.pg) return; var s = this.stat = this.stat || {}, n = this.rx ? this.rx[0] : 0;
    if (this.rt >= 3 && this.rg && (k === 'board' || k === 'dome')) { this.rx = [n + 1, 'glass', Math.round(this.p[0] * 1000) / 1000, Math.round(this.p[1] * 1000) / 1000, Math.round(Math.max(this.z, .06) * 1000) / 1000]; this.out(3.4, 'arc', 'GLASS!'); this.ev = 'glass'; s.glass = (s.glass || 0) + 1; }
    else if (this.rt >= 2 && (k === 'post' || k === 'mesh')) { this.rx = [n + 1, 'netoff', this.p[1] > L / 2 ? 1 : 0]; this.out(2.6, 'reg', 'NET OFF!'); this.ev = 'netoff'; s.netoff = (s.netoff || 0) + 1; } };
  Sim.prototype.out = function (pz, k, msg) { this.pg = true; this.fz = null; this.uv = (this.lu || this.u.map(function () { return 0; })).slice(); this.c = -1; this.to = -1; this.ot = [null, null]; this.v = [0, 0]; this.vz = 0; this.z = 0; this.air = false; this.arc = null;
    this.pause = pz; this.srvK = k; this.fire = 0; this.rt = 0; this.gone = 1; this.msg = msg; this.wh = (this.wh || 0) + 1; this.p = [.5, L / 2]; this.rxStop = 1; };
  function airT(vz) { var z = .002, h = 1 / 480, t = 0; while (t < 4) { vz -= 3.5 * h; if (vz > 0) vz *= Math.exp(-h * 1.4); z += vz * h; t += h; if (z <= 0) break; } return t; }
  Sim.prototype.serve = function () { var fo = this.fo || [.5, L / 2], k = this.srvK || 'reg', R0 = Math.random, ctr = Math.abs(fo[0] - .5) < .01 && Math.abs(fo[1] - L / 2) < .01, c = 0, dx = 0, dy = 0;
    this.srvK = 'reg'; if (!ctr) k = 'dot'; this.p = fo.slice(); this.z = .002; this.air = true; this.ev = 'launch'; this.arc = null; this.gone = 0;
    if (k === 'open' || k === 'dot') { var j = k === 'open' ? SRV.open : .08; this.v = [(R0() - .5) * j * 2, (R0() - .5) * j * 2]; this.vz = FO.vz * (k === 'open' ? .97 + R0() * .06 : .92 + R0() * .16); }
    else if (k === 'arc') { var d = SRV.dots[Math.floor(R0() * 4)], vz = SRV.arcVz[0] + (SRV.arcVz[1] - SRV.arcVz[0]) * R0(), T = airT(vz); this.vz = vz; this.v = [(d[0] - fo[0]) / T, (d[1] - fo[1]) / T]; this.arc = { a: fo.slice(), b: d.slice(), T: T, t: 0, v: this.v.slice(), sp: (R0() - .5) * 2 * SRV.spin }; dx = d[0]; dy = d[1]; }
    else { var an = []; for (var i = 0; i < 12; i++) { var q = this.tip(i), dd = Math.hypot(q[0] - fo[0], q[1] - fo[1]); if (dd < SRV.r) { c += 1 - dd / SRV.r; an.push(Math.atan2(q[1] - fo[1], q[0] - fo[0])); } }
      if (c >= SRV.tight) { k = 'blast'; this.v = [(R0() - .5) * .04, (R0() - .5) * .04]; this.vz = FO.vz * SRV.blast * (.96 + R0() * .08); }
      else { k = 'diag'; var a;
        if (an.length < 2) a = (R0() < .5 ? 1 : -1) * (R0() < .5 ? Math.PI / 4 : 3 * Math.PI / 4);   // nobody close: either diagonal
        else { an.sort(function (x, y) { return x - y; }); var bg = -1; for (var m = 0; m < an.length; m++) { var a0 = an[m], a1 = m + 1 < an.length ? an[m + 1] : an[0] + 2 * Math.PI, g = a1 - a0; if (g > bg) { bg = g; a = a0 + g / 2; } } }
        a += (R0() - .5) * .35; var f = Math.min(1, c / SRV.tight), spd = (SRV.side[0] + (SRV.side[1] - SRV.side[0]) * f) * (.85 + R0() * .3);
        this.v = [Math.cos(a) * spd, Math.sin(a) * spd]; this.vz = (SRV.vzReg[0] + (SRV.vzReg[1] - SRV.vzReg[0]) * f) * FO.vz * (.95 + R0() * .1); dx = Math.cos(a); dy = Math.sin(a); } }
    var r3 = function (x) { return Math.round(x * 1000) / 1000; }; this.srv = [(this.srv ? this.srv[0] : 0) + 1, k, r3(c), r3(dx), r3(dy)]; var s = this.stat = this.stat || {}; s['srv_' + k] = (s['srv_' + k] || 0) + 1; };
  Sim.prototype.snap = function () { var me = this; function r(x) { return Math.round(x * 1000) / 1000; } return { t: 's', u: this.u.map(r), o: this.o.map(function (q) { return [r(q[0]), r(q[1])]; }), p: this.p.map(r), c: this.c, sd: r(this.side), a: this.ang.map(r), sw: this.swing && this.swing[1] > 0 ? this.swing[0] : -1, sc: this.sc, tm: Math.ceil(this.time), per: this.per || 1, pon: PER.on ? 1 : 0, ov: this.over, msg: this.msg, pz: r(Math.max(0, this.pause)), z: r(this.z || 0), dn: this.dn.map(function (x) { return x > 0 ? r(x) : 0; }), ln: this.ln.map(function (x) { return x > 0 ? r(x) : 0; }), ot: this.ot.map(function (x) { return x ? 1 : 0; }), g: this.grab.slice(), ev: this.ev, fx: this.fx || [0], pg: this.pg ? 1 : 0, wh: this.wh || 0, gr: this.gr ? this.gr.map(function (g) { return g ? Math.round(g.d * Math.min(1, g.t / GREACH.t * 2.5) * 100) / 100 : 0; }) : [0, 0], mw: Math.round((this.mw || 0) * 100) / 100, iev: this.iev || null, fa: this.fa ? this.fa.map(r) : null, sh: this.c >= 0 && this.sh ? r(this.sh[this.c]) : 0, kdn: this.kdn || null, tk: this.tk || [0, -1], bpg: this.bpg || null, fi: this.fire > 0 ? this.rt : 0, dk: r(this.dk || 0), dke: this.dke || null, dks: this.dks || null, rx: this.rx || null, srv: this.srv || null, gone: this.gone ? 1 : 0, arc: this.arc ? 1 : 0, kd: this.kdT ? this.kdT.map(function (k, j) { return k > 0 && me.dn[j] > 0 ? r(me.dn[j] / k) : 0; }) : null }; };
  root.Bubble = { GM: GM, CAP: CAP, GEO: { L: L, GY: GY, GW: GW, R: R, PR: PR }, PER: PER, GK: GK, KO: KO, DEKE: DEKE, RIP: RIP, SRV: SRV, BRD: BRD, V20: V20, FACE: FACE, PIVOT: PIVOT, HANDS: HANDS, GRAV: GRAV, BNC: BNC, SPRING: SPRING, WILD: WILD, GD: GD, Sim: Sim, TR: TR, L: L, BL: BL, GOALP: GOALP, PR: PR, R: R, GW: GW, GY: GY, pos: pos, proj: proj };
})(window);
/* BUBBLE HOCKEY v0.9.40 FIGHT MODE (sim side). Patches Bubble.Sim: a skater who takes N body checks inside a window (?fightn=3, FT.win s) drops the gloves with the
   last checker. Whistle, play freezes, side-view fight (view3d_v0940.js), 6 phone buttons (fightpad_v0940.js). Core hockey untouched; ?fight=0 off, ?fightnow=1 starts one right away.
   Inputs: {t:'fight', a:'hi'|'lo'|'grab'|'dh'|'dl'|'esc'}. Simple timing: an attack lands after its wind-up unless the defender is in the matching dodge (hi<->dh, lo<->dl) or leaning back (esc).
   Hits drain balance; first to 0 falls, then a centre face-off. Grab: holder's hits count more and can't be dodged; the grabbed player swings blind (weak) and must Escape to pull away. */
(function (root) {
  'use strict';
  var B = root.Bubble, S = B.Sim.prototype, Q = typeof location !== 'undefined' ? location.search : '';
  function qn(k, d) { var m = new RegExp('[?&]' + k + '=([\\d.]+)').exec(Q); return m ? parseFloat(m[1]) : d; }
  var FT = { on: !/[?&]fight=0/.test(Q), now: /[?&]fightnow=1/.test(Q), n: Math.max(1, qn('fightn', 3)), win: 25, intro: 1.6, end: 2.6, cd: 20,
    wind: { hi: .30, lo: .26, grab: .32, esc: .22 }, busy: { hi: .55, lo: .5, grab: .6, dh: .5, dl: .5, esc: .55 }, dodge: .45,
    dmg: { hi: .2, lo: .14 }, held: 1.35, blind: .4, escP: .75, aiRate: [.35, .8], aiDodge: .5, fcd: qn('fcd', .5), fhp: Math.max(.1, qn('fhp', 2)) };
  B.FT = FT;
  var oReset = S.reset, oStep = S.step, oInput = S.input0, oChecks = S.checks, oSnap = S.snap;
  S.reset = function () { oReset.call(this); this.ft = null; this.ftLog = TR().map(function () { return []; }); this.ftNow = FT.now; this.ftEnd = -99; this.ftN = 0; };
  function TR() { return B.TR; }
  S.checks = function (dt) { var f0 = this.fx ? this.fx[0] : 0; oChecks.call(this, dt); var f = this.fx;
    if (!FT.on || !f || f[0] === f0 || 'CBK'.indexOf(f[1]) < 0 || !this.hit) return; var j = this.hit.j, i = f[2], now = this.clk || 0; if (TR()[j].k === 'G' || this.team(i) === this.team(j)) return;
    var L = this.ftLog[j] = (this.ftLog[j] || []).filter(function (t) { return now - t < FT.win; }); L.push(now);
    if (L.length >= FT.n && !this.ft && !this.ftQ && now - this.ftEnd > FT.cd) { this.ftQ = [i, j]; this.ftLog[j] = []; } };
  S.fightStart = function (a, b) { var s = this.stat = this.stat || {}; s.fights = (s.fights || 0) + 1; this.ftN++;
    this.ft = { a: a, b: b, ph: 'intro', t: 0, hp: [1, 1], k: ['', ''], kt: [0, 0], n: [0, 0], side: [0, 0], done: [1, 1], gr: -1, w: -1, ai: [0, 0], res: '', rn: 0, id: this.ftN };
    this.c = -1; this.v = [0, 0]; this.vz = 0; this.z = 0; this.air = false; this.arc = null; this.to = -1; this.ot = [null, null]; this.fire = 0; this.rt = 0;
    for (var h = 0; h < 10; h++) { this.grab[h] = -1; this.fing[h] = null; } this.msg = 'FIGHT!'; this.ev = 'fight'; this.wh = (this.wh || 0) + 1; this.dn[a] = this.dn[b] = 0; };
  S.fighter = function (team) { var F = this.ft; if (!F) return -1; return this.team(F.a) === team ? 0 : this.team(F.b) === team ? 1 : -1; };
  S.fightAct = function (s, a) { var F = this.ft; if (!F || F.ph !== 'fight' || F.w >= 0) return; if (F.t - F.kt[s] < (FT.busy[F.k[s]] || 0) * (1 + FT.fcd)) return;   // v0.9.41: move + cooldown (fcd x move length), CPU too
    if (a === 'grab' && F.gr >= 0) a = 'hi';   // already tangled up: grab = another shot
    F.k[s] = a; F.kt[s] = F.t; F.n[s]++; F.done[s] = 0; if (a === 'hi' || a === 'lo') F.side[s] = 1 - F.side[s]; };
  S.fightStep = function (dt) { var F = this.ft, me = this; F.t += dt; this.clk = (this.clk || 0) + dt;
    if (F.ph === 'intro') { if (F.t >= FT.intro) { F.ph = 'fight'; F.t = 0; F.kt = [-9, -9]; this.msg = ''; } return; }
    if (F.ph === 'end') { if (F.t >= FT.end) this.fightOver(); return; }
    for (var s = 0; s < 2; s++) { var who = s ? F.b : F.a, t = this.team(who);
      if (this.ai[t] && !this.held(t)) { F.ai[s] -= dt; if (F.ai[s] <= 0) { F.ai[s] = FT.aiRate[0] + Math.random() * (FT.aiRate[1] - FT.aiRate[0]); var o = 1 - s, ok = F.k[o], inc = !F.done[o] && (ok === 'hi' || ok === 'lo' || ok === 'grab'), r = Math.random(), a;
          if (F.gr === (o ? F.b : F.a)) a = r < .6 ? 'esc' : r < .8 ? 'hi' : 'lo';
          else if (inc && r < FT.aiDodge * this.diff) a = ok === 'hi' ? 'dh' : ok === 'lo' ? 'dl' : 'esc';
          else a = r < .42 ? 'hi' : r < .82 ? 'lo' : 'grab';
          this.fightAct(s, a); } } }
    for (s = 0; s < 2; s++) { var k = F.k[s]; if (F.done[s] || !FT.wind[k] || F.t - F.kt[s] < FT.wind[k]) continue; F.done[s] = 1;
      var o2 = 1 - s, me2 = s ? F.b : F.a, op = s ? F.a : F.b, dk = F.k[o2], dAct = F.t - F.kt[o2] < FT.dodge, iHold = F.gr === me2, iHeld = F.gr === op;
      if (k === 'esc') { if (iHeld) { if (Math.random() < FT.escP) { F.gr = -1; this.fightRes('pull', s); } else this.fightRes('stuck', s); } continue; }
      var dodged = !iHold && dAct && ((k === 'hi' && dk === 'dh') || (k === 'lo' && dk === 'dl') || (dk === 'esc' && F.gr < 0) || (k === 'grab' && (dk === 'dh' || dk === 'dl')));
      if (dodged) { this.fightRes('miss', s); continue; }
      if (k === 'grab') { F.gr = me2; this.fightRes('grab', s); continue; }
      var d = FT.dmg[k] / FT.fhp * (iHold ? FT.held : 1) * (iHeld ? FT.blind : 1) * (.85 + Math.random() * .3); F.hp[o2] = Math.max(0, F.hp[o2] - d); this.fightRes(k === 'hi' ? 'hitH' : 'hitL', s);
      if (F.hp[o2] <= 0) { F.w = s; F.ph = 'end'; F.t = 0; F.gr = -1; this.dn[op] = FT.end + .2; this.koff = this.koff || TR().map(function () { return 0; }); this.msg = 'DOWN!'; this.ev = 'fightko'; } } };
  S.fightRes = function (r, s) { var F = this.ft; F.res = r; F.rs = s; F.rn++; this.ev = 'f_' + r; };
  S.fightOver = function () { var F = this.ft; this.ft = null; this.ftEnd = this.clk || 0; this.dn[F.a] = this.dn[F.b] = 0; this.c = -1; this.freeze(); this.fz = [.5, B.L / 2]; this.msg = 'FACE OFF'; this.pause = 2.6; };
  S.step = function (dt) { if (this.ft) { this.ev = ''; this.fightStep(dt); return; }
    oStep.call(this, dt);
    if (!FT.on || this.over >= 0) return;
    if (this.ftNow && (this.clk || 0) > 1.2) { this.ftNow = false; var ca = -1, cb = -1; for (var i = 0; i < 12; i++) { if (B.TR[i].k === 'C') { if (i < 6) ca = i; else cb = i; } } this.ftQ = [ca >= 0 ? ca : 3, cb >= 0 ? cb : 9]; }
    if (this.ftQ && !(this.pause > 0) && !this.pg) { var q = this.ftQ; this.ftQ = null; this.fightStart(q[0], q[1]); } };
  S.input0 = function (team, m, hand, allow) { if (this.ft) { if (m.t === 'fight') { var s = this.fighter(team); if (s >= 0) this.fightAct(s, m.a); } else if (m.t === 'rel') { if (hand == null) hand = team; this.grab[hand] = -1; this.fing[hand] = null; } return; }
    if (m.t === 'fight') return; oInput.call(this, team, m, hand, allow); };
  S.gmStep = function (dt) { var GM = B.GM, E = B.GEO; if (!GM.on) return; this.gm = this.gm || [[0, .5, 0], [0, .5, 0]]; this.gmH = this.gmH || [0, 0]; this.gmN = this.gmN || 0;
    for (var t = 0; t < 2; t++) { var g = t * 6, G = this.pp(g), gy = t ? E.GY : E.L - E.GY, dir = gy > E.L / 2 ? 1 : -1, cur = this.gm[t], m = 0, tx = G[0];
      if ((this.gmH[t] -= dt) > 0 && cur[0] >= 2) continue;
      var own = (this.p[1] - E.L / 2) * dir > 0, vy = this.v[1] * dir, sp = Math.hypot(this.v[0], this.v[1]);
      if (this.pause > 0 || this.pg) m = 1 * own;
      else if (this.c === g) m = 1;
      else if (!own) m = 0;
      else { m = 1; var dG = Math.hypot(this.p[0] - G[0], this.p[1] - G[1]);
        if (this.c < 0 && dG < GM.smR && sp < GM.smV && this.z < .02) { m = 5; tx = this.p[0]; }
        else if (this.c < 0 && sp > GM.shotV && vy > GM.shotV * .3) { var tt = (gy - this.p[1]) * dir / vy;
          if (tt > 0 && tt < GM.tMax) { var px = this.p[0] + this.v[0] * tt, off = px - G[0], ao = Math.abs(off), hz = this.z + (this.vz || 0) * tt;
            if (ao < E.GW * GM.wide) { tx = px; var R0 = E.R;
              if (hz > GM.highZ) m = ao > R0 * GM.pad ? 4 : 1;
              else m = ao < R0 * GM.low ? 3 : ao < R0 * GM.pad ? 2 : 4;
              if (m >= 2) { this.gr = this.gr || [null, null]; var ext = m === 4 ? GM.extLaunch : m === 2 ? GM.extPad : GM.extLow; this.gr[t] = { d: off > 0 ? 1 : -1, t: GM.T, T: GM.T, ext: ext }; } } } } }
      if (m < 2 && this.gr && this.gr[t] && !this.gr[t].ext) { m = 2; tx = G[0] + this.gr[t].d * .05; }   // player-driven reach swipe shows as a pad drop
      if (m !== cur[0] || (m >= 2 && Math.abs(tx - cur[1]) > .02)) { this.gm[t] = [m, Math.round(tx * 1000) / 1000, ++this.gmN]; this.gmH[t] = m >= 2 ? GM.hold : GM.holdN; } } };
  var oStep51 = S.step; S.step = function (dt) { oStep51.call(this, dt); try { this.gmStep(dt); } catch (e) { } };
  S.snap = function () { var o = oSnap.call(this), F = this.ft; o.gm = this.gm ? [this.gm[0].slice(), this.gm[1].slice()] : null; o.hc = this.hc || null; if (F) { var r = function (x) { return Math.round(x * 100) / 100; };
      o.ft = { a: F.a, b: F.b, ph: F.ph, t: r(F.t), hp: F.hp.map(r), k: F.k.slice(), n: F.n.slice(), sd: F.side.slice(), gr: F.gr, w: F.w, res: F.res, rs: F.rs, rn: F.rn, id: F.id, cd: [0, 1].map(function (q) { return r(Math.max(0, (FT.busy[F.k[q]] || 0) * (1 + FT.fcd) - (F.t - F.kt[q]))); }) }; } return o; };
})(window);

/* v0.9.41 add-ons. slowS: set by the TV during the after-goal settle; players drift to their spots so they arrive as the pause ends (cleared when the pause hands over to the face-off).
   cpuChk: watch mode (AI vs AI) - every CHKW.min..max s a CPU skater near the opposing puck carrier lunges (snag) at him, so body checks and fights happen without phones. */
(function (root) { var B = root.Bubble, S = B.Sim.prototype, oStep = S.step, CHKW = { min: 2, max: 5, r: .3, sp: 1.1 }; B.CHKW = CHKW;
  S.step = function (dt) { var wi = this.cwI; if (this.cpuChk && wi != null && this.sn[wi] > 0 && this.c >= 0 && this.team(this.c) !== this.team(wi) && !this.pg) { var a0 = this.pp(wi), b0 = this.pp(this.c), dx = b0[0] - a0[0], dy = b0[1] - a0[1], dd = Math.hypot(dx, dy) || 1e-6; if (dd < B.R * 2.4) { this.vh = this.vh || []; this.vh[wi] = [dx / dd * CHKW.sp, dy / dd * CHKW.sp]; } }   // the lunge carries real body speed into the carrier
    oStep.call(this, dt); if (this.slowS && (!this.pg || !(this.pause > 1.1))) this.slowS = false;
    if (!this.cpuChk || this.ft || this.pause > 0 || this.pg || this.over >= 0) return; this.cwT = (this.cwT == null ? CHKW.min : this.cwT) - dt; if (this.cwT > 0 || this.c < 0) return;
    this.cwT = CHKW.min + Math.random() * (CHKW.max - CHKW.min); var cp = this.pp(this.c), t = this.team(this.c), best = -1, bd = CHKW.r;
    for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { if (B.TR[j].k === 'G' || this.dn[j] > 0 || !this.ai[1 - t]) continue; var q = this.pp(j), d = Math.hypot(q[0] - cp[0], q[1] - cp[1]), rq = B.pos(B.TR[j], B.proj(B.TR[j], cp[0], cp[1])); if (d < bd && Math.hypot(rq[0] - cp[0], rq[1] - cp[1]) < B.R * 1.8) { bd = d; best = j; } }   // his track must actually reach the carrier
    if (best < 0) this.cwT = .4; else { this.cwI = best; this.sn[best] = .6; this.ln[best] = .4; } };
})(window);

/* v0.9.53 (sim): fight combos + hold-to-defend, goalie butterfly / pad rebounds / smother whistle / post lock. Data-driven tables, all on Bubble.CB / Bubble.GKX.
   CB.mv: one entry per move: wind (s to impact), busy (s before the next chained tap is accepted), dmg (x base), lead ('lead' = thrown with the lead hand, 'rear'),
   foot ('swap' = the landing changes stance: lead hand flips), twist (chance the landing twists into a scramble), poses {anticipation, hit, recovery} = pose names the view
   blends in when they exist (Justin's 1-3 keyframes). seq = chain order. Tap within CB.chain s of the last tap = next step; within CB.beat = resume from the step before; later = restart. */
(function (root) {
  'use strict';
  var B = root.Bubble, S = B.Sim.prototype, FT = B.FT, TR = function () { return B.TR; };
  var CB = B.CB = { on: !/[?&]combo=0/.test(location.search), chain: .42, beat: 1.1, seq: ['jab', 'jab', 'swing'], grace: 2, graze: .25,
    mv: { jab: { wind: .16, busy: .22, dmg: .55, lead: 'lead', foot: '', twist: 0, poses: { anticipation: 'F_jab_ant', hit: 'F_jab_hit', recovery: 'F_jab_rec' } },
          swing: { wind: .3, busy: .42, dmg: 1.35, lead: 'rear', foot: 'swap', twist: .3, poses: { anticipation: 'F_swing_ant', hit: 'F_swing_hit', recovery: 'F_swing_rec' } } } };
  var oAct = S.fightAct, oFStep = S.fightStep, oIn = S.input0, oSnap = S.snap, oStart = S.fightStart;
  S.fightStart = function (a, b) { oStart.call(this, a, b); var F = this.ft; F.cs = [-1, -1]; F.la = [-9, -9]; F.mv = ['', '']; F.wd = [0, 0]; F.st = [0, 1]; F.hd = [-1, -1]; F.hc = [0, 0]; F.scr = 0; F.scd = 0; F.byN = 0; };
  S.fightAct = function (s, a, hold) { var F = this.ft; if (!F) return; if (F.hd && (a === 'dh' || a === 'dl' || a === 'esc')) F.hd[s] = hold ? F.t : -1;
    if (!CB.on || !F.cs || (a !== 'hi' && a !== 'lo') || F.gr >= 0) return oAct.call(this, s, a);
    if (F.ph !== 'fight' || F.w >= 0) return; var cur = CB.mv[F.mv[s]], gap = F.t - F.la[s]; if (cur && gap < cur.busy) { F.qa = F.qa || ['', '']; F.qa[s] = a; return; }   // still throwing: buffer one tap
    if (cur) gap -= cur.busy;   // chain / beat windows count from the end of the last move
    var oc = F.mv[s] ? (FT.busy[F.k[s]] || 0) : 0; if (!cur && F.t - F.kt[s] < oc * (1 + FT.fcd)) return;   // after a non-combo move: old cooldown
    var n = CB.seq.length, st = gap < CB.chain ? (F.cs[s] + 1) % n : gap < CB.beat ? Math.max(0, F.cs[s]) : 0; if (st < 0) st = 0;
    if (gap >= CB.chain) F.hc[s] = 0;   // chain broken: the defender's grace counter restarts
    var nm = CB.seq[st], M = CB.mv[nm]; F.cs[s] = st; F.la[s] = F.t; F.mv[s] = nm; F.wd[s] = M.wind;
    F.k[s] = a; F.kt[s] = F.t - ((FT.wind[a] || .3) - M.wind); F.n[s]++; F.done[s] = 0; F.side[s] = M.lead === 'lead' ? F.st[s] : 1 - F.st[s]; };
  S.fightStep = function (dt) { var F = this.ft; if (!F || !F.cs) return oFStep.call(this, dt); if (F.qa) for (var q = 0; q < 2; q++) { var cq = CB.mv[F.mv[q]]; if (F.qa[q] && cq && F.t - F.la[q] >= cq.busy) { var qa = F.qa[q]; F.qa[q] = ''; this.fightAct(q, qa); } } var hp0 = F.hp.slice(), rn0 = F.rn;
    oFStep.call(this, dt); F = this.ft; if (!F || F.rn === rn0 || (F.res !== 'hitH' && F.res !== 'hitL')) return;
    var s = F.rs, o = 1 - s, M = CB.mv[F.mv[s]]; if (!M) return; F.hc[s]++; var d = hp0[o] - F.hp[o], gz = F.hd[o] >= 0 && F.hc[s] > CB.grace;
    var nd = d * M.dmg * (gz ? CB.graze : 1); F.hp[o] = Math.max(0, hp0[o] - nd); if (gz) this.fightRes('graze', s);
    if (F.hp[o] > 0 && F.ph === 'end' && F.w === s) { F.ph = 'fight'; F.w = -1; this.msg = ''; this.dn[o ? F.b : F.a] = 0; }
    if (F.hp[o] <= 0 && F.ph !== 'end') { var op = o ? F.b : F.a; F.w = s; F.ph = 'end'; F.t = 0; F.gr = -1; this.dn[op] = FT.end + .2; this.koff = this.koff || TR().map(function () { return 0; }); this.msg = 'DOWN!'; this.ev = 'fightko'; return; }
    if (M.foot === 'swap') F.st[s] = 1 - F.st[s];
    if (M.twist && Math.random() < M.twist) { F.scr++; F.scd = Math.random() < .5 ? 1 : -1; F.byN++; this.ev = 'f_scr'; } };
  S.input0 = function (team, m, hand, allow) { if (this.ft && m.t === 'fight') { var s = this.fighter(team); if (s < 0) return; if (m.a === 'up') { if (this.ft.hd) this.ft.hd[s] = -1; return; } this.fightAct(s, m.a, m.h); return; } return oIn.call(this, team, m, hand, allow); };

  // ---- goalie ----
  // long (dist > lng) shots along the ice (z < gz) -> straight butterfly (mode 3) on the puck-net line; saves off the pads in mode 2/3 rebound flat (no lift) at rb x speed,
  // spread sideways. Goalie covering with an attacker within smR: whistle after smT s; a stick on the covered puck pops it loose (no clean steal) at poke chance x FREEZE.
  // Body check on a covering goalie: no effect, st.gst = [serial, goalie] stumble hook. Puck wide (angle > postA rad) or behind the goal line, within postR: mode 6 post lock.
  var E = B.GEO, GKX = B.GKX = { on: !/[?&]gkx=0/.test(location.search), lng: .5, gz: .012, rb: .7, spread: .5, smR: .09, smT: 3, postA: 1.05, postR: .6 };
  var oGm = S.gmStep, oStepG = S.step, oChk = S.checks, gs = 0;
  S.gmStep = function (dt) { oGm.call(this, dt); if (!GKX.on || !this.gm) return;
    for (var t = 0; t < 2; t++) { var g = t * 6, G = this.pp(g), gy = t ? E.GY : E.L - E.GY, dir = gy > E.L / 2 ? 1 : -1, cur = this.gm[t], m = cur[0], tx = cur[1];
      var Pk = this.c >= 0 ? this.carryPos() : this.p, ex = Pk[0] - .5, ey = (gy - Pk[1]) * dir, dG = Math.hypot(ex, ey);
      if (this.c === g && this.gsm && this.gsm[t] > 0) { m = 5; tx = G[0]; }
      else if (m >= 2 && m <= 4 && this.c < 0 && this.z < GKX.gz && dG > GKX.lng) m = 3;
      else if (m === 1 && this.c !== g && dG < GKX.postR && (ey < .01 || Math.atan2(Math.abs(ex), ey) > GKX.postA)) { m = 6; tx = .5 + (ex > 0 ? 1 : -1) * E.GW; }
      if (m !== cur[0]) this.gm[t] = [m, Math.round(tx * 1000) / 1000, ++this.gmN]; } };
  S.step = function (dt) { var c0 = this.c, gm0 = this.gm ? [this.gm[0][0], this.gm[1][0]] : [1, 1]; oStepG.call(this, dt); if (!GKX.on || this.ft) return;
    if (this.ev === 'save' && this.c < 0 && (gm0[c0 >= 0 ? 0 : 0] >= 0)) { var tg = this.p[1] < E.L / 2 ? 1 : 0, gmode = gm0[tg]; if (gmode === 2 || gmode === 3) { this.z = 0; this.vz = 0; this.air = false; var sp = Math.hypot(this.v[0], this.v[1]) * GKX.rb; var a = Math.atan2(this.v[1], this.v[0]) + (Math.random() - .5) * GKX.spread; this.v = [Math.cos(a) * sp, Math.sin(a) * sp]; this.ev = 'padsave'; } }
    if (this.ev === 'steal' && c0 >= 0 && TR()[c0].k === 'G' && this.c >= 0) { var q = this.pp(this.c); this.c = -1; this.cool = c0; this.coolT = .3; this.v = [(this.p[0] - q[0]) * 8, (this.p[1] - q[1]) * 8]; this.ev = 'poke'; }   // poke pops it loose, never a clean steal off the goalie
    if ((this.ev === 'shot' || this.ev === 'onetimer') && c0 >= 0) this.sht = [((this.sht || [0])[0] + 1) % 1000, c0, this.ev];   // v0.9.53 shot hook for arrival-timed shot poses
    this.gsm = this.gsm || [0, 0];
    for (var t = 0; t < 2; t++) { var g = t * 6; if (this.c !== g || this.pause > 0 || this.pg) { this.gsm[t] = 0; continue; } var G = this.pp(g), near = 0; for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { var P = this.pp(j); if (Math.hypot(P[0] - G[0], P[1] - G[1]) < GKX.smR) near = 1; }
      if (near || this.gsm[t] > 0) this.gsm[t] += dt; if (this.gsm[t] >= GKX.smT) { this.gsm[t] = 0; this.freeze(); } } };
  S.checks = function (dt) { var f0 = this.fx ? this.fx[0] : 0; oChk.call(this, dt); var f = this.fx; if (!f || f[0] === f0 || 'CBK'.indexOf(f[1]) < 0 || !this.hit) return; var j = this.hit.j;
    if (TR()[j].k === 'G' && this.c === j) { this.gst = [++gs % 1000, j]; this.ev = 'gk_stumble'; } };
  S.snap = function () { var o = oSnap.call(this), F = this.ft; if (this.gst) o.gst = this.gst; o.pv = [Math.round(this.v[0] * 1000) / 1000, Math.round(this.v[1] * 1000) / 1000]; o.to = this.to; if (this.sht) o.sht = this.sht; if (this.gsm) o.gsm = this.gsm.map(function (x) { return Math.round(x * 10) / 10; });
    if (F && F.cs && o.ft) { o.ft.cs = F.cs.slice(); o.ft.mv = F.mv.slice(); o.ft.st = F.st.slice(); o.ft.scr = F.scr; o.ft.scd = F.scd; o.ft.hd = [F.hd[0] >= 0 ? 1 : 0, F.hd[1] >= 0 ? 1 : 0]; o.ft.wd = F.wd.slice(); o.ft.la = F.la.map(function (x) { return Math.round(x * 100) / 100; }); } return o; };
  // ---- v0.9.54 content mode (ZTP.sessionMode): kid mode = no fights. Goalie untouched. ----
  (function () { var S = root.Bubble.Sim.prototype, oS = S.fightStart, oN = S.snap;
    S.zmode = function () { return this.zm || (root.ZTP ? root.ZTP.mode() : 'family'); };
    S.setMode = function (m) { var was = this.zmode(); this.zm = m; if (was === m) return; if (m === 'kid') { this.ftQ = null; if (this.ft) this.fightOver(); }
      if (root.ZTP && (was === 'kid') !== (m === 'kid')) root.ZTP.note(m === 'kid' ? 'Kid mode: fights are off' : 'Fights are back on'); };
    S.fightStart = function (a, b) { if (this.zmode() === 'kid') { this.ftQ = null; return; } return oS.call(this, a, b); };
    S.snap = function () { var o = oN.call(this); o.zm = this.zmode(); return o; }; })();
})(window);
