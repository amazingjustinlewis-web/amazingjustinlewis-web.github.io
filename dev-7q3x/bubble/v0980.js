/* v0.9.80: longer secondary-replay tails, cameras stay above the ice, phone funnel/slot
   + rattle, goalie claw (G_clawL / G_clawR), phone cinematics, 180-rule cine with rare
   Matrix 360s on big moments, mirrored cine set when sides change, puck tumbling.
   ?digout=0, ?tumble=0, ?claw=0, ?camclamp=0, ?phonecine=0, ?loa=0 disable pieces. */
(function (root) {
  'use strict';
  var B = root.Bubble, R3 = root.Bubble3D;
  if (!B || !R3) return;
  var qoff = function (n) { return new RegExp('[?&]' + n + '=0(?:&|$)').test(location.search || ''); };
  var L = B.L || 2, GY = B.GY || .128, GW = B.GW || .07;
  var BOX = (B.BOX || { ND: .07, depth: .051, slot: 1.5 * (B.PR0 || .0176) * 2, slotPast: .035, NH: .045 });
  var CAMMIN = { y: .12, look: .025, slotLook: .012, iceShot: .16 };
  var WR_POST = 2.2, HL_POST = 2.2, REP_POST = 2.4;   // ~1.6–2.0 s more tail than v0.9.79 (WR.post was .6)
  var TUMBLE_ON = !qoff('tumble'), CLAW_ON = !qoff('claw'), CAM_ON = !qoff('camclamp');
  var PHONE_CINE = !qoff('phonecine'), LOA_ON = !qoff('loa');
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

  // ---- 1. longer secondary (and highlight / goal) replay tails ----
  if (R3.WR) R3.WR.post = WR_POST;
  if (typeof WR !== 'undefined' && WR) WR.post = WR_POST;
  // HL / REP_POST live in the view3d closure; hook clipRep + goal segs below.

  // ---- 5. claw slots (placeholders until Justin authors poses) ----
  function clawPlaceholder(side, base) {
    var P = {}, n, a, Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3();
    if (!base) return P;
    for (n in base) { a = base[n]; P[n] = a.slice(); }
    function rot(name, ax, ay, az, ang) {
      var b = P[name]; if (!b) return;
      Q.set(b[0], b[1], b[2], b[3]);
      Q2.setFromAxisAngle(V.set(ax, ay, az), ang);
      Q.premultiply(Q2);
      b[0] = Q.x; b[1] = Q.y; b[2] = Q.z; b[3] = Q.w;
    }
    var sgn = side === 'R' ? -1 : 1;
    // two-handed overhand reach from the crouch/smother: lift one arm high, the other plants
    rot('Spine1', 0, 0, 1, sgn * .18);
    rot('Spine1', 1, 0, 0, -.28);
    rot(side === 'R' ? 'Shoulder_R' : 'Shoulder_L', 1, 0, 0, -1.15);
    rot(side === 'R' ? 'Arm_R' : 'Arm_L', 0, 0, 1, sgn * .45);
    rot(side === 'R' ? 'ForeArm_R' : 'ForeArm_L', 0, 1, 0, -.55);
    rot(side === 'R' ? 'Hand_R' : 'Hand_L', 1, 0, 0, -.35);
    rot(side === 'R' ? 'Shoulder_L' : 'Shoulder_R', 1, 0, 0, -.25);
    rot('Hips', 1, 0, 0, .12);
    return P;
  }
  function ensureClaw(view) {
    var api = root.BH_GOALIE; if (!api || !api.register) return;
    var Lpos = (view && view.poses) || api.poses || {};
    var base = Lpos.G_smother || api.poses.G_smother || Lpos.G_lowblock || Lpos.G_ready;
    if (!base) return;
    if (!api.poses.G_clawL || api.src.G_clawL === 'placeholder') {
      api.register('G_clawL', clawPlaceholder('L', base), { source: Lpos.G_clawL ? 'authored' : 'placeholder', frames: 5, kind: 'claw', side: 'L' });
    }
    if (!api.poses.G_clawR || api.src.G_clawR === 'placeholder') {
      api.register('G_clawR', clawPlaceholder('R', base), { source: Lpos.G_clawR ? 'authored' : 'placeholder', frames: 5, kind: 'claw', side: 'R' });
    }
    if (api.slots) {
      if (!api.slots.G_clawL) api.slots.G_clawL = { frames: 5, kind: 'claw', side: 'L' };
      if (!api.slots.G_clawR) api.slots.G_clawR = { frames: 5, kind: 'claw', side: 'R' };
    }
  }

  // ---- 2 + 8 + 9. camera helpers (stay above ice, 180-rule, side-change mirror) ----
  function L3(x, y, h) { return new THREE.Vector3(y, h || 0, x); }
  function sideFlip(st) { return (LOA_ON && st && (st.per || 1) % 2 === 0) ? -1 : 1; }
  function mx(x, flip) { return flip < 0 ? 1 - x : x; }
  function inFunnel(st, fr) {
    var z = (fr && fr.z != null) ? fr.z : (st && st.z);
    var ib = (fr && fr.inbox != null) ? fr.inbox : (st && st.inbox);
    return (ib != null && ib >= 0) || (z != null && z < -0.002);
  }
  function slotMouth(st, fr) {
    var ib = (fr && fr.inbox != null) ? fr.inbox : (st && st.inbox);
    var p = (fr && fr.p) || (st && st.p) || [.5, L / 2];
    if (!(ib >= 0)) ib = p[1] < L / 2 ? 0 : 1;
    var gl = ib ? L - GY : GY, dir = ib ? 1 : -1;
    return [0.5, gl + dir * 0.008, CAMMIN.slotLook];
  }
  function clampLocal(view, pos, look, st, fr) {
    if (!CAM_ON || !view || !view.G) return look;
    view.G.worldToLocal(_v.copy(pos));
    if (_v.y < CAMMIN.y) { _v.y = CAMMIN.y; pos.copy(view.G.localToWorld(_v)); }
    if (!look) return look;
    view.G.worldToLocal(_v2.copy(look));
    if (inFunnel(st, fr)) {
      var m = slotMouth(st, fr);
      _v2.set(m[1], m[2], m[0]);   // L3: (rinkY, h, rinkX)
    } else if (_v2.y < CAMMIN.look) {
      _v2.y = CAMMIN.look;
    }
    look.copy(view.G.localToWorld(_v2));
    return look;
  }

  function hook(R) {
    if (!R || R.__v0980) return; R.__v0980 = 1;
    var proto = R.prototype;

    // longer tails on whistle / highlight clips
    var oClip = proto.clipRep;
    proto.clipRep = function (c, slowCam, full) {
      var wr = R.WR || root.Bubble3D && root.Bubble3D.WR;
      if (wr && wr.post < WR_POST) wr.post = WR_POST;
      var r = oClip ? oClip.call(this, c, slowCam, full) : null;
      return r;
    };

    // goal replay segs: extend each angle's post-moment tail (REP_POST was 1.8)
    var oGoal = proto.goal;
    proto.goal = function (team) {
      var r = oGoal ? oGoal.call(this, team) : undefined;
      var Rpl = this.rep;
      if (Rpl && Rpl.segs && !Rpl.cine) {
        Rpl.segs = Rpl.segs.map(function (s) {
          var a = s.slice();
          // s = [start, end, rate, kind]; extend end by ~0.6 s of recorded time
          if (a[1] != null) a[1] = a[1] + 0.7;
          return a;
        });
      }
      return r;
    };

    // camera: after shot / cine / inter / cineCam / camGuard, clamp height
    var oShot = proto.shot;
    proto.shot = function (kind, fr, Rp, dt, cut) {
      if (oShot) oShot.call(this, kind, fr, Rp, dt, cut);
      var cam = this.persp, look = Rp && Rp.ls && Rp.ls.p;
      if (cam) clampLocal(this, cam.position, look, this._lastSt, fr);
      if (cam && look) { cam.up.set(0, 1, 0); cam.lookAt(look); }
    };

    var oGuard = proto.camGuard;
    proto.camGuard = function (cam, look) {
      if (oGuard) oGuard.call(this, cam, look);
      if (!CAM_ON || !cam || !cam.isPerspectiveCamera || !this.G) return;
      clampLocal(this, cam.position, look, this._lastSt, null);
    };

    var oCineShot = proto.cineShot;
    proto.cineShot = function (sh, u, f) {
      var s = oCineShot ? oCineShot.call(this, sh, u, f) : null;
      if (!s) return s;
      // ice-level drift was at y=.035 and crashed through the cabinet; keep it up
      if (sh && sh.n === 'ice') { if (s.p[2] < CAMMIN.iceShot) s.p[2] = CAMMIN.iceShot; if (s.l[2] < CAMMIN.look) s.l[2] = CAMMIN.look; }
      if (s.p[2] < CAMMIN.y) s.p[2] = CAMMIN.y;
      if (s.l[2] < CAMMIN.look) s.l[2] = CAMMIN.look;
      var st = this._lastSt, flip = sideFlip(st);
      if (flip < 0) { s.p[0] = mx(s.p[0], flip); s.l[0] = mx(s.l[0], flip); }
      return s;
    };

    // line-change / settle: stay on the line of action, end on a flattering bar+ice angle (no random wrap-under the table)
    var oCineCam = proto.cineCam;
    proto.cineCam = function (cam, st, mode, dt, W, H) {
      var phone = this.phone;
      // 7. allow soft phone cinematics (previously early-returned)
      if (phone && PHONE_CINE && mode) {
        return phoneCine.call(this, cam, st, mode, dt, W, H);
      }
      var out = oCineCam ? oCineCam.call(this, cam, st, mode, dt, W, H) : cam;
      // fix mode-1 settle / line-change ending: if the live SPAN orbit put us too low or through the cabinet, lift and yaw back to the bar side
      if (CAM_ON && out && out.isPerspectiveCamera && this.G) {
        var look = this.focusPt || (this.cn && this.cn.last && this.cn.last.look);
        clampLocal(this, out.position, look, st, null);
        if (look) { out.up.set(0, 1, 0); out.lookAt(look); }
      }
      // 8. 360 Matrix orbit only on big moments (goal / epic save). Line changes stay on the 180 side.
      if (mode === 1 && this.cn && this.cn.pan && st) {
        var msg = st.msg || '', lineCh = /^END OF|LINE CHANGE|OVERTIME/.test(msg);
        var big = msg === 'GOAL!' || st.ev === 'glove' || (st.ev === 'save' && st.z > .02);
        if (lineCh && !big) {
          // keep the settle arc on one side of the line of action and end looking at ice + jumbo / bar
          var o = this.cn.pan, flip = sideFlip(st);
          var u = Math.min(1, (o.t || 0) / 3.6), ee = u * u * (3 - 2 * u);
          // start and end on the bar side (rink x ≈ -0.15 or 1.15 when flipped), 70° sweep only
          var a0 = flip < 0 ? Math.PI * 0.15 : Math.PI * 0.85 + Math.PI;
          // reinterpret: bar cameras live at rink x < 0 (x ≈ -0.62). Legal side is x <= 0.2 (or >= 0.8 when flipped).
          var ang0 = flip < 0 ? 1.85 : -0.35, ang1 = ang0 + 0.95;
          var a = ang0 + ee * (ang1 - ang0);
          var px = mx(0.5 + 1.15 * Math.sin(a), flip), py = L / 2 + 1.35 * Math.cos(a), ph = 0.42;
          if (ph < CAMMIN.y) ph = CAMMIN.y;
          var want = this.G.localToWorld(L3(px, py, ph));
          var look2 = this.G.localToWorld(L3(0.5, L / 2, 0.18));
          out.position.lerp(want, Math.min(1, dt * 2.2));
          out.up.set(0, 1, 0); out.lookAt(look2);
          if (this.cn.last) { this.cn.last.pos = out.position.clone(); this.cn.last.look = look2; }
          this.focusPt = look2;
        } else if (big && !this.cn.mtx && phone === false) {
          this.cn.mtx = { t: 0, a0: sideFlip(st) < 0 ? Math.PI : 0 };
        }
      }
      if (this.cn && this.cn.mtx && mode === 1 && st && (st.msg === 'GOAL!' || st.ev === 'glove')) {
        var M = this.cn.mtx; M.t = (M.t || 0) + dt;
        if (M.t < 3.2) {
          var uf = Math.min(1, M.t / 3.2), a = M.a0 + uf * Math.PI * 2;
          var p3 = this.G.localToWorld(L3(0.5 + 1.25 * Math.sin(a), L / 2 + 1.45 * Math.cos(a), 0.38 + 0.12 * Math.sin(uf * Math.PI)));
          var l3 = this.G.localToWorld(L3(0.5, L / 2, 0.08));
          out.position.copy(p3); out.up.set(0, 1, 0); out.lookAt(l3); this.focusPt = l3;
        }
      }
      return out;
    };

    function phoneCine(cam, st, mode, dt, W, H) {
      if (!this.G) return cam;
      this._pcn = this._pcn || { k: 0, t: 0, a: sideFlip(st) < 0 ? 2.2 : -0.4, fx: [.5, L / 2] };
      var o = this._pcn, want = mode ? 1 : 0;
      o.k += (want - o.k) * (1 - Math.exp(-dt * 0.8));
      if (o.k < .003 && !want) return cam;
      ensurePhoneBar(this);
      var p = st && st.p ? st.p : [.5, L / 2];
      // slowly follow players / puck
      var tx = 0, ty = 0, n = 0;
      if (st && st.u && B.pos && B.TR) {
        for (var i = 0; i < 12; i++) {
          var q = B.pos(B.TR[i], st.u[i]), oo = st.o && st.o[i] ? st.o[i] : [0, 0];
          tx += q[0] + oo[0]; ty += q[1] + oo[1]; n++;
        }
      }
      if (n) { tx /= n; ty /= n; } else { tx = p[0]; ty = p[1]; }
      o.fx[0] += (tx - o.fx[0]) * (1 - Math.exp(-dt * 0.45));
      o.fx[1] += (ty - o.fx[1]) * (1 - Math.exp(-dt * 0.45));
      o.t += dt;
      var flip = sideFlip(st);
      // wide, low ice-POV on the 180 side, monolith behind the far bar
      var a = (flip < 0 ? 2.4 : -0.45) + Math.sin(o.t * 0.12) * 0.18;
      var px = mx(0.5 + 1.05 * Math.sin(a) * 0.15 - 0.55 * (flip < 0 ? -1 : 1), 1);
      // keep camera on legal long side
      px = flip < 0 ? Math.max(0.92, Math.min(1.28, 1.12 + Math.sin(o.t * 0.1) * 0.08))
                    : Math.min(0.08, Math.max(-0.28, -0.12 + Math.sin(o.t * 0.1) * 0.08));
      var py = o.fx[1] + (o.fx[1] - L / 2) * 0.15;
      var ph = 0.18 + 0.04 * Math.sin(o.t * 0.2);
      if (ph < CAMMIN.y) ph = CAMMIN.y;
      var pos = this.G.localToWorld(L3(px, py, ph));
      var look = this.G.localToWorld(L3(o.fx[0], o.fx[1], 0.04));
      // peek the monolith: bias look slightly toward centre-ice height so the tall bar piece reads behind
      var pc = this.persp, e = o.k * o.k * (3 - 2 * o.k);
      pc.aspect = W / H; pc.fov = 54; pc.near = .02; pc.updateProjectionMatrix();
      pc.position.copy(cam.position).lerp(pos, e);
      pc.up.set(0, 1, 0); pc.lookAt(look);
      clampLocal(this, pc.position, look, st, null);
      pc.lookAt(look);
      this.focusPt = look;
      return pc;
    }

    function ensurePhoneBar(view) {
      if (view._phoneBar || !view.G) return;
      var g = new THREE.Group(); g.name = 'phone_bar_set';
      var floor = new THREE.Mesh(new THREE.BoxGeometry(8, .04, 6), new THREE.MeshLambertMaterial({ color: 0x1a1420 }));
      floor.position.set(L / 2, -0.08, .5); g.add(floor);
      // tall monolith behind the bar (legal-side long wall at rink x < 0)
      var mon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.55), new THREE.MeshLambertMaterial({ color: 0x141018 }));
      mon.position.set(L / 2, 0.7, -0.85); g.add(mon);
      var mon2 = mon.clone(); mon2.position.set(L / 2, 0.7, 1.85); g.add(mon2);
      var bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.28), new THREE.MeshLambertMaterial({ color: 0x3a2418 }));
      bar.position.set(L / 2, 0.12, -0.62); g.add(bar);
      var bar2 = bar.clone(); bar2.position.z = 1.62; g.add(bar2);
      view.G.add(g); view._phoneBar = g;
    }

    // 3. phone funnel / dark slot (v0979 already adds the metal hopper if loaded; lighten + guarantee on phone)
    function phoneSlot(view) {
      if (!view || !view.G) return;
      // make sure 979 funnel exists (install is idempotent)
      if (root.BH_V0979 && root.BH_V0979.install) root.BH_V0979.install(view);
      if (view._phoneSlot) return;
      var dark = new THREE.MeshPhongMaterial({ color: 0x07080b, transparent: true, opacity: view.phone ? 0.85 : 0.95, side: THREE.DoubleSide });
      function chute(gy, dir) {
        var grp = new THREE.Group();
        // descending gradient well: stacked darkening planes under the slot mouth
        for (var i = 0; i < 5; i++) {
          var a = 0.25 + i * 0.15, h = -0.008 - i * 0.012;
          var m = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2.05, BOX.ND + .01), new THREE.MeshBasicMaterial({
            color: 0x000000, transparent: true, opacity: (view.phone ? 0.22 : 0.35) * (i + 1) / 5, side: THREE.DoubleSide, depthWrite: false
          }));
          m.rotation.x = Math.PI / 2; m.position.set(gy + dir * (BOX.ND / 2), h, .5); grp.add(m);
        }
        var well = new THREE.Mesh(new THREE.BoxGeometry(BOX.ND + .01, BOX.depth + .06, GW * 2.05), dark);
        well.position.set(gy + dir * (BOX.ND / 2), -BOX.depth / 2 - .01, .5); grp.add(well);
        return grp;
      }
      var g = new THREE.Group(); g.name = 'phone_net_wells';
      g.add(chute(GY, -1)); g.add(chute(L - GY, 1));
      view.G.add(g); view._phoneSlot = g;
    }

    // 10. puck tumbling
    var oPlace = proto.place;
    proto.place = function (st) {
      var r = oPlace ? oPlace.call(this, st) : undefined;
      tumblePuck.call(this, st);
      return r;
    };
    function tumblePuck(st) {
      var pk = this.puck; if (!pk || !st) return;
      var T = this._tumble || (this._tumble = { w: [0, 0, 0], edge: 0, flat: 1, ev: '' });
      if (!TUMBLE_ON) { pk.rotation.set(0, 0, 0); T.w = [0, 0, 0]; T.flat = 1; return; }
      var held = st.c >= 0, z = st.z || 0, inbox = st.inbox != null ? st.inbox : -1;
      var vx = (st.pv && st.pv[0]) || 0, vy = (st.pv && st.pv[1]) || 0;
      // no pv on some snaps: estimate from last p
      if (!st.pv) {
        if (T.lp) { vx = (st.p[0] - T.lp[0]) * 60; vy = (st.p[1] - T.lp[1]) * 60; }
      }
      T.lp = st.p ? st.p.slice() : T.lp;
      var spd = Math.hypot(vx, vy);
      if (held || st.pg && inbox < 0 && z <= 0 && st.msg !== 'GOAL!') {
        // snap flat when captured / dead on the ice
        T.w = [0, 0, 0]; T.edge = 0;
        T.flat += (1 - T.flat) * 0.55;
        pk.quaternion.slerp(_q.identity(), Math.min(1, T.flat));
        if (T.flat > .97) pk.rotation.set(0, 0, 0);
        return;
      }
      T.flat = 0;
      // angular velocity from travel: spin around vertical + tilt from speed
      var yaw = (vx + vy) * 1.8;
      if (inbox >= 0) {
        // keep the rattle's horizontal momentum — spin/tumble but stay mostly on-edge or flat, bouncing off walls
        yaw = (vx * 4 + vy * 4);
        T.w[1] = yaw;
        T.w[0] += (Math.sin((this.clock || 0) * 18) * 2.5 - T.w[0]) * .2;
        T.w[2] += (Math.cos((this.clock || 0) * 14) * 2.2 - T.w[2]) * .2;
      } else {
        if (st.ev && st.ev !== T.ev && /post|bar|board|mesh|land|bump|padsave/.test(st.ev)) {
          T.w[0] += (Math.random() - .5) * 10;
          T.w[2] += (Math.random() - .5) * 10;
          T.w[1] += (Math.random() - .5) * 6;
          if (Math.random() < 0.28) T.edge = 1;
        }
        T.ev = st.ev || T.ev;
        if (T.edge && spd > 0.35) {
          // roll on the rim
          T.w[0] = -vy * 8; T.w[2] = vx * 8; T.w[1] *= 0.9;
        } else {
          T.w[1] = yaw + T.w[1] * 0.85;
          T.w[0] *= Math.exp(-0.8 / 60);
          T.w[2] *= Math.exp(-0.8 / 60);
          if (spd < 0.25 && z <= 0.002) T.edge = 0;
        }
      }
      var dt = this.lastDt || .016;
      pk.rotateX(T.w[0] * dt);
      pk.rotateY(T.w[1] * dt);
      pk.rotateZ(T.w[2] * dt);
      if (T.edge) {
        // hold ~90° tilt so the cylinder rolls on its edge
        pk.rotation.z += (Math.PI / 2 * Math.sign(pk.rotation.z || 1) - pk.rotation.z) * 0.15;
      }
    }

    // 5+6. claw drive + dig-out pose
    var oGk = proto.gkPose;
    proto.gkPose = function (st, dt) {
      ensureClaw(this);
      clawStep.call(this, st, dt);
      if (oGk) return oGk.call(this, st, dt);
    };
    function clawStep(st, dt) {
      if (!CLAW_ON || !st || !root.BH_GOALIE) return;
      var api = root.BH_GOALIE;
      this._claw = this._claw || [{ t: 0, side: 0, on: 0, n: -1 }, { t: 0, side: 0, on: 0, n: -1 }];
      for (var t = 0; t < 2; t++) {
        var g = t * 6, C = this._claw[t], k = this.pl && this.pl[g] && this.pl[g].userData.sk;
        if (!k || !k.gk) continue;
        var G = (st.u && B.pos) ? (function () { var q = B.pos(B.TR[g], st.u[g]), o = st.o && st.o[g] ? st.o[g] : [0, 0]; return [q[0] + o[0], q[1] + o[1]]; })() : [.5, t ? L - GY : GY];
        var p = st.p || [.5, L / 2], d = Math.hypot(p[0] - G[0], p[1] - G[1]);
        var loose = st.c < 0 && !(st.pz > 0 && !st.pg) && !st.gone;
        var near = loose && d < 0.13 && (st.z || 0) < 0.03;
        var digging = st.dig && st.dig[1] === g;
        // team 0 defends the L-GY net (inbox 1); team 1 defends GY (inbox 0)
        var inHisNet = st.inbox === (1 - t);
        if (digging || (inHisNet && loose)) near = true;
        if (near || digging) {
          C.t += dt || .016;
          if (!C.on || C.t > 0.28) {
            C.side = 1 - C.side; C.t = 0; C.on = 1;
            var slot = C.side ? 'G_clawR' : 'G_clawL';
            try { api.blendTo(this, g, slot, 5); } catch (e) {}
          }
          // cover if the puck is right under him and slow
          var sp = st.pv ? Math.hypot(st.pv[0], st.pv[1]) : 0;
          if (!digging && d < 0.05 && sp < 0.45 && (st.z || 0) <= 0.006) {
            try { api.blendTo(this, g, 'G_smother', 6); } catch (e2) {}
            C.on = 0;
          }
        } else if (C.on) {
          C.on = 0; C.t = 0;
        }
      }
    }

    var oBuild = proto.build;
    proto.build = function () {
      var r = oBuild ? oBuild.call(this) : undefined;
      phoneSlot(this);
      if (this.phone) ensurePhoneBar(this);
      return r;
    };

    var oRen = proto.render;
    proto.render = function (st, dt, opt) {
      this._lastSt = st; this.lastDt = dt;
      if (!this._v0980Init && this.G) { this._v0980Init = 1; phoneSlot(this); if (this.phone) ensurePhoneBar(this); ensureClaw(this); }
      return oRen.call(this, st, dt, opt);
    };

    // cineStep orbit was looking at height -0.4 (through the table). Hook after it if present.
    var oStep = proto.cineStep;
    if (oStep) {
      proto.cineStep = function (Rp, st, dt, W, H) {
        var out = oStep.call(this, Rp, st, dt, W, H);
        if (this.persp && CAM_ON) {
          var look = Rp && Rp.ls && Rp.ls.p;
          var fr = null;
          clampLocal(this, this.persp.position, look, st, fr);
          if (look) { this.persp.up.set(0, 1, 0); this.persp.lookAt(look); }
        }
        return out;
      };
    }

    var oInter = proto.interCam;
    if (oInter) {
      proto.interCam = function (cam, st, dt, W, H) {
        var out = oInter.call(this, cam, st, dt, W, H);
        if (out && out.isPerspectiveCamera && this.G && CAM_ON) {
          var look = this.im && this.im.ls && this.im.ls.p;
          clampLocal(this, out.position, look, st, null);
          if (look) { out.up.set(0, 1, 0); out.lookAt(look); }
        }
        return out;
      };
    }
  }

  hook(R3);
  if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
  root.BH_V0980 = { hook: hook, CAMMIN: CAMMIN, WR_POST: WR_POST };
})(window);
