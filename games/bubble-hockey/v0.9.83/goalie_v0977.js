/* v0.9.77: pose-blend-driven goalie library. Register a named slot and blend to it over a
   per-transition frame count. Existing Ready/pad/launch/smother poses fill those slots;
   glove / kick / slash / shove slots use procedural placeholders until Justin's hand-posed
   files arrive. Pads, stick and body colliders follow the current pose. Glove capture uses
   a proximity radius around the catcher (Hand_L). The goalie stick visual is left unchanged. */
(function (root) {
  'use strict';
  var FPS = 30, GLOVE_R = .05;
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

  // Slot names Justin can drop posed JSON onto (register or a file named <slot>_v01.json).
  var SLOTS = {
    G_stance:     { frames: 6, alias: 'G_ready',    kind: 'stance' },
    G_ready:      { frames: 6, kind: 'stance' },
    G_neutral:    { frames: 8, kind: 'stance' },
    G_padL:       { frames: 4, kind: 'pad' },
    G_padR:       { frames: 4, kind: 'pad' },
    G_lowblock:   { frames: 4, kind: 'block' },
    G_launchL:    { frames: 3, kind: 'launch' },
    G_launchR:    { frames: 3, kind: 'launch' },
    G_smother:    { frames: 6, kind: 'smother' },
    G_gloveHighL: { frames: 4, kind: 'glove', side: 'L', height: 'high' },
    G_gloveHighR: { frames: 4, kind: 'glove', side: 'R', height: 'high' },
    G_gloveMidL:  { frames: 4, kind: 'glove', side: 'L', height: 'mid' },
    G_gloveMidR:  { frames: 4, kind: 'glove', side: 'R', height: 'mid' },
    G_gloveLowL:  { frames: 4, kind: 'glove', side: 'L', height: 'low' },
    G_gloveLowR:  { frames: 4, kind: 'glove', side: 'R', height: 'low' },
    G_kickL:      { frames: 5, kind: 'kick', side: 'L' },
    G_kickR:      { frames: 5, kind: 'kick', side: 'R' },
    G_slashL:     { frames: 4, kind: 'slash', side: 'L' },
    G_slashR:     { frames: 4, kind: 'slash', side: 'R' },
    G_shoveL:     { frames: 4, kind: 'shove', side: 'L' },
    G_shoveR:     { frames: 4, kind: 'shove', side: 'R' }
  };

  var poses = {};   // name -> { Name: [qx,qy,qz,qw(,px,py,pz)] }
  var srcOf = {};   // name -> 'authored' | 'placeholder' | 'alias'

  function clonePose(src) {
    var out = {}, n, a;
    if (!src) return out;
    for (n in src) { a = src[n]; out[n] = a.slice(); }
    return out;
  }

  function rotBone(pose, name, ax, ay, az, ang) {
    var a = pose[name]; if (!a) return;
    _q.set(a[0], a[1], a[2], a[3]);
    _q2.setFromAxisAngle(_v.set(ax, ay, az), ang);
    _q.premultiply(_q2);
    a[0] = _q.x; a[1] = _q.y; a[2] = _q.z; a[3] = _q.w;
  }

  function placeholder(kind, side, height, base) {
    var P = clonePose(base); if (!P || !Object.keys(P).length) return P;
    var sgn = side === 'R' ? -1 : 1;
    if (kind === 'glove') {
      var lift = height === 'high' ? .9 : height === 'low' ? .15 : .5;
      var out = height === 'low' ? .35 : .55;
      rotBone(P, 'Shoulder_L', 1, 0, 0, -lift * .7);
      rotBone(P, 'Arm_L', 0, 0, 1, sgn * out);
      rotBone(P, 'ForeArm_L', 0, 1, 0, -lift * .4);
      rotBone(P, 'Hand_L', 0, 0, 1, sgn * .25);
      if (side === 'R') {
        rotBone(P, 'Shoulder_R', 1, 0, 0, -lift * .35);
        rotBone(P, 'Spine1', 0, 1, 0, -sgn * .15);
      } else {
        rotBone(P, 'Spine1', 0, 1, 0, sgn * .2);
      }
    } else if (kind === 'kick') {
      rotBone(P, side === 'R' ? 'Thigh_R' : 'Thigh_L', 1, 0, 0, -.85);
      rotBone(P, side === 'R' ? 'Shin_R' : 'Shin_L', 1, 0, 0, .35);
      rotBone(P, 'Hips', 0, 0, 1, sgn * .12);
    } else if (kind === 'slash') {
      // Body/arm pose only — do not retarget or hide the goalie stick mesh.
      rotBone(P, 'Shoulder_R', 0, 0, 1, sgn * .4);
      rotBone(P, 'Arm_R', 0, 1, 0, sgn * .55);
      rotBone(P, 'Spine1', 0, 1, 0, -sgn * .2);
    } else if (kind === 'shove') {
      rotBone(P, 'Spine1', 0, 1, 0, -sgn * .28);
      rotBone(P, 'Shoulder_L', 0, 0, 1, sgn * .2);
      rotBone(P, 'Shoulder_R', 0, 0, 1, -sgn * .2);
      rotBone(P, 'Hips', 0, 0, 1, sgn * .1);
    }
    return P;
  }

  function register(name, pose, opt) {
    opt = opt || {};
    if (!SLOTS[name]) SLOTS[name] = { frames: opt.frames || 6, kind: opt.kind || 'custom' };
    if (opt.frames) SLOTS[name].frames = opt.frames;
    poses[name] = pose;
    srcOf[name] = opt.source || 'authored';
    return name;
  }

  function ensureLib(view) {
    var L = (view && view.poses) || {}, n, sl, base, aliased;
    base = L.G_ready || poses.G_ready || L.G_neutral;
    for (n in SLOTS) {
      sl = SLOTS[n];
      if (poses[n] && srcOf[n] === 'authored') continue;
      if (L[n]) { register(n, L[n], { source: 'authored', frames: sl.frames, kind: sl.kind }); continue; }
      aliased = sl.alias && (L[sl.alias] || poses[sl.alias]);
      if (aliased) { register(n, aliased, { source: 'alias', frames: sl.frames, kind: sl.kind }); continue; }
      if (base && (sl.kind === 'glove' || sl.kind === 'kick' || sl.kind === 'slash' || sl.kind === 'shove')) {
        register(n, placeholder(sl.kind, sl.side, sl.height, base), { source: 'placeholder', frames: sl.frames, kind: sl.kind });
      }
    }
    return poses;
  }

  function applyBlend(bb, from, to, w) {
    if (!to || !bb) return;
    var n, b, a, f;
    w = Math.max(0, Math.min(1, w));
    for (n in to) {
      b = bb[n]; if (!b) continue;
      a = to[n]; f = (from && from[n]) || a;
      _q.set(f[0], f[1], f[2], f[3]);
      _q2.set(a[0], a[1], a[2], a[3]);
      if (_q.dot(_q2) < 0) _q2.set(-_q2.x, -_q2.y, -_q2.z, -_q2.w);
      b.quaternion.copy(_q).slerp(_q2, w);
      if (a.length > 4) {
        var fx = f[4] || 0, fy = f[5] || 0, fz = f[6] || 0;
        b.position.set(fx + (a[4] - fx) * w, fy + (a[5] - fy) * w, fz + (a[6] - fz) * w);
      }
    }
  }

  function blendTo(k, name, frames) {
    if (!k || !k.gk) return;
    var sl = SLOTS[name] || { frames: 6 };
    var g = k.gk;
    g.bhFrom = {};
    if (g.out) { for (var n in g.out) g.bhFrom[n] = g.out[n].slice(); }
    g.bhSlot = name;
    g.bhT = 0;
    g.bhDur = Math.max(1, frames != null ? frames : sl.frames) / FPS;
  }

  function boneOf(k, names) {
    var bb = (k.gk && k.gk.b) || {};
    for (var i = 0; i < names.length; i++) if (bb[names[i]]) return bb[names[i]];
    return null;
  }

  function worldRink(view, obj) {
    if (!obj || !view || !view.G) return null;
    obj.getWorldPosition(_v);
    view.G.worldToLocal(_v2.copy(_v));
    // L3(x, y, h) = (y, h, x)  =>  rink x = local.z, rink y = local.x, h = local.y
    return [_v2.z, _v2.x, _v2.y];
  }

  function gloveRink(i) {
    var view = root.BH_GK || (root.BHT && root.BHT.R3);
    if (!view || !view.pl || !view.pl[i]) return null;
    var k = view.pl[i].userData.sk; if (!k || !k.gk) return null;
    var b = boneOf(k, ['GK_Catcher', 'GK_Catch', 'Catcher', 'Glove', 'Hand_L']);
    return b ? worldRink(view, b) : null;
  }

  function colliders(i) {
    var view = root.BH_GK || (root.BHT && root.BHT.R3);
    if (!view || !view.pl || !view.pl[i]) return null;
    var k = view.pl[i].userData.sk; if (!k || !k.gk) return null;
    function sph(names, r) {
      var b = boneOf(k, names), q = b && worldRink(view, b);
      return q ? [q[0], q[1], q[2], r] : null;
    }
    return {
      glove: sph(['GK_Catcher', 'GK_Catch', 'Catcher', 'Glove', 'Hand_L'], GLOVE_R),
      padL: sph(['GK_Pad_L', 'Pad_L', 'Shin_L'], .03),
      padR: sph(['GK_Pad_R', 'Pad_R', 'Shin_R'], .03),
      // collision only — does not move or restyle the stick mesh
      stick: sph(['GK_Stk_Blade', 'STK_Blade', 'Blade'], .018),
      body: sph(['Spine1', 'Hips', 'COG'], .04)
    };
  }

  function hook(R3) {
    if (!R3 || R3.__gk977) return; R3.__gk977 = 1;
    var proto = R3.prototype;
    var oGk = proto.gkPose;
    proto.gkPose = function (st, dt) {
      ensureLib(this);
      if (oGk) oGk.call(this, st, dt);
      var rd = (dt || 0) * (this.rep && root.BH_RSPD ? root.BH_RSPD : 1);
      for (var i = 0; i < 12; i++) {
        var k = this.pl && this.pl[i] && this.pl[i].userData.sk;
        if (!k || !k.gk || k.pegged) continue;
        var g = k.gk, want = null, fr;
        // optional test/override: BH_GKSLOT = 'G_gloveHighL' (or [name, frames])
        var ov = root.BH_GKSLOT;
        if (ov) want = Array.isArray(ov) ? ov[0] : ov, fr = Array.isArray(ov) ? ov[1] : null;
        if (want && want !== g.bhSlot) blendTo(k, want, fr);
        if (g.bhSlot && poses[g.bhSlot]) {
          g.bhT = (g.bhT || 0) + rd;
          var a = Math.min(1, g.bhT / (g.bhDur || .05));
          var ez = a * a * (3 - 2 * a);
          applyBlend(g.b, g.bhFrom, poses[g.bhSlot], ez);
          // keep g.out in sync so the next authored GM2 fade starts from this pose
          var P = poses[g.bhSlot], n, o;
          for (n in P) {
            var b = g.b[n]; if (!b) continue;
            o = g.out[n] || (g.out[n] = []);
            o[0] = b.quaternion.x; o[1] = b.quaternion.y; o[2] = b.quaternion.z; o[3] = b.quaternion.w;
            if (P[n].length > 4) { o[4] = b.position.x; o[5] = b.position.y; o[6] = b.position.z; }
          }
          g.lab = g.bhSlot;
        }
        if (k.mm && k.mm.updateMatrixWorld) k.mm.updateMatrixWorld(true);
      }
      this._gkCol = this._gkCol || [];
      for (var j = 0; j < 12; j++) this._gkCol[j] = colliders(j);
    };

    // Keep the visual puck at PR0 even though sim collision uses 88% of that.
    var oPlace = proto.place;
    proto.place = function (st) {
      var r = oPlace ? oPlace.call(this, st) : undefined;
      var B = root.Bubble, pk = this.puck;
      var visR = B && (B.PR0 || B.PR_VIS || (B.GEO && B.GEO.PR0) || .0176);
      var colR = B && (B.PR || (B.GEO && B.GEO.PR) || visR);
      if (pk && visR && colR) {
        var vis = visR / colR, h = (st && st.z) || 0, gs = 1 + h * 7;
        pk.scale.set(gs * vis, 1, gs * vis);
        if (this.pshad) this.pshad.scale.setScalar((1 + h * 2.5) * vis);
      }
      return r;
    };
  }

  hook(root.Bubble3D);
  root.BH_GOALIE = {
    slots: SLOTS,
    poses: poses,
    src: srcOf,
    register: register,
    blendTo: function (view, i, name, frames) {
      var k = view && view.pl && view.pl[i] && view.pl[i].userData.sk;
      ensureLib(view);
      blendTo(k, name, frames);
    },
    gloveRadius: GLOVE_R,
    gloveRink: gloveRink,
    colliders: colliders,
    hook: hook,
    names: function () { return Object.keys(SLOTS); }
  };
})(window);
