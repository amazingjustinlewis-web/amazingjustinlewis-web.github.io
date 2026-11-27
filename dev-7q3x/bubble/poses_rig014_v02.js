/* v0.9.75: Justin's hand-made Rig014 locomotion poses (IdleGlide, FaceoffTense, SkateFast 0-12 cycle)
   layered under existing upper-body actions (shots, catches, puck control). Root is never tilted or lifted.
   Stick is placed in Hand_R after the authored COG is applied (v0.9.74 applied COG after stickAttach,
   leaving the stick floating at the idle-clip hand, often up in the armpit). Shots/passes/one-timers still
   write stick swings on top via stkA. ?r14=0 disables.
   Locomotion: IdleGlide (slow/still) -> SkateSlow (medium, 18-frame cycle) -> SkateFast (quick), crossfaded by speed; playback rate scales with speed.
   ?loco=idleGlide|skateSlow|skateFast|faceoffTense forces a state. */
(function (root) {
  'use strict';
  if (/[?&]r14=0/.test(location.search)) return;
  var DIR = 'anim/poses_rig014_v01/';
  var FILES = { HP_idleGlide: 'HP_idleGlide_v01.json', HP_faceoffTense: 'HP_faceoffTense_v01.json', HP_skateSlow: 'HP_skateSlow_v01.json', HP_skateFast: 'HP_skateFast_v01.json' };
  var FPS = 24, XFADE = 6 / 24, FO_MIN = 3 / 24, FO_MAX = 10 / 24, FO_DEF = 6 / 24;
  var V_IN = .055, V_OUT = .04, V_REF = .10, RATE_MIN = .6, RATE_MAX = 2.2, FO_NEAR = .03, FO_BLEND = .12;
  // three-band locomotion with hysteresis: idle <-> slow <-> fast
  var V_SLOW_IN = .028, V_IDLE_OUT = .016, V_REF_SLOW = .045;
  var FORCE = (location.search.match(/[?&]loco=(idleGlide|skateSlow|skateFast|faceoffTense)/) || [])[1] || null;
  var LEGS = /^(Thigh|Shin|Foot|Toe|IK_Thigh|IK_Shin|IKC_Foot|POLE_Leg|MCH_(Heel|Tip|Ball|FootIK|ToeIK))/;
  // only deform + COG + hand-IK helpers (same set as HP_glide). Control/IKC/POLE/AX bones would double-transform the body.
  var SKIP = /^(Root|AX_|IKC_|POLE_|IK_|MCH_(Ball|FootIK|Heel|Tip|ToeIK|Lead|IKT|HandTwist))/;
  var _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

  function boneMap(k) {
    var bb = (k.lb && k.lb.b) || k.r14b;
    if (!bb) { bb = {}; k.m.traverse(function (o) { if (o.name && !bb[o.name]) bb[o.name] = o; }); k.r14b = bb; if (k.lb) k.lb.b = bb; }
    return bb;
  }

  function slerpBones(bb, bones, w, legs) {
    if (!bones || !(w > 0)) return;
    for (var n in bones) {
      if (n === 'Root' || SKIP.test(n)) continue;
      var isLeg = LEGS.test(n);
      if (legs === 'body' && isLeg) continue;
      if (legs === 'legs' && !isLeg) continue;
      var b = bb[n], a = bones[n]; if (!b || !a) continue;
      if (n === 'COG') continue;   // applied after upright so the wrap/root stays flat
      b.quaternion.slerp(_q.set(a[0], a[1], a[2], a[3]), w);
      if (a.length > 4 && n !== 'Hips') b.position.lerp(_v.set(a[4], a[5], a[6]), w);
    }
  }

  function mixStick(k, stick, w) {
    if (!stick) return;
    w = w == null ? 1 : Math.max(0, Math.min(1, w)); if (!(w > 0)) return;
    var A = k.stkA;
    if (!A) {
      A = k.stkA = { a: w, b: {} };
      for (var n in stick) { var v = stick[n]; A.b[n] = { q: new THREE.Quaternion(v[0], v[1], v[2], v[3]), t: new THREE.Vector3(v[4], v[5], v[6]) }; }
    } else {
      for (var n2 in stick) {
        var v2 = stick[n2], c = A.b[n2]; if (!c) continue;
        c.q.slerp(_q.set(v2[0], v2[1], v2[2], v2[3]), w);
        c.t.lerp(_v.set(v2[4], v2[5], v2[6]), w);
      }
      A.a += (1 - A.a) * w;
    }
  }

  function cogOf(bones) {
    var a = bones && bones.COG; if (!a || a.length < 7) return null;
    return { q: [a[0], a[1], a[2], a[3]], t: [a[4], a[5], a[6]] };
  }

  function sampleCycle(clip, ph) {
    var per = clip.period || 12, frs = clip.frames, f = ((ph % 1) + 1) % 1 * per, i0 = Math.floor(f), t = f - i0, i1 = i0 + 1;
    if (i0 >= frs.length) i0 = frs.length - 1;
    if (i1 >= frs.length) i1 = 0;
    var a = frs[i0], b = frs[i1];
    if (t < 1e-4) return { bones: a.bones, stick: a.stick, cog: cogOf(a.bones) };
    var bones = {}, n, va, vb, qa, qb, s;
    var keys = {};
    for (n in a.bones) keys[n] = 1; for (n in b.bones) keys[n] = 1;
    for (n in keys) {
      va = a.bones[n] || b.bones[n]; vb = b.bones[n] || va;
      qa = _q.set(va[0], va[1], va[2], va[3]); qb = _q2.set(vb[0], vb[1], vb[2], vb[3]);
      if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
      qa.slerp(qb, t);
      s = [qa.x, qa.y, qa.z, qa.w];
      if (va.length > 4 || vb.length > 4) {
        var ax = va[4] || 0, ay = va[5] || 0, az = va[6] || 0, bx = vb[4] || 0, by = vb[5] || 0, bz = vb[6] || 0;
        s.push(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
      }
      bones[n] = s;
    }
    var stick = {}, sk = {};
    if (a.stick) for (n in a.stick) sk[n] = 1;
    if (b.stick) for (n in b.stick) sk[n] = 1;
    for (n in sk) {
      va = (a.stick && a.stick[n]) || (b.stick && b.stick[n]); vb = (b.stick && b.stick[n]) || va;
      qa = _q.set(va[0], va[1], va[2], va[3]); qb = _q2.set(vb[0], vb[1], vb[2], vb[3]);
      if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
      qa.slerp(qb, t);
      stick[n] = [qa.x, qa.y, qa.z, qa.w, va[4] + (vb[4] - va[4]) * t, va[5] + (vb[5] - va[5]) * t, va[6] + (vb[6] - va[6]) * t];
    }
    return { bones: bones, stick: stick, cog: cogOf(bones) };
  }

  function stillOf(P, name) {
    var j = P[name]; if (!j) return null;
    return { bones: j.bones, stick: j.stick && j.stick.bones, cog: cogOf(j.bones) };
  }

  function hook(R3) {
    if (!R3 || R3.__r14) return; R3.__r14 = 1;
    var proto = R3.prototype;

    function loadOnto(view) {
      if (view._r14Ready) return;
      var pack = root.BH_R14 && root.BH_R14.pack;
      if (pack) { view.r14 = pack; view._r14Ready = 1; installPoses(view, pack); return; }
      if (view._r14Load) return;
      view._r14Load = 1;
      var names = Object.keys(FILES);
      Promise.all(names.map(function (n) {
        return fetch(DIR + FILES[n] + '?b=975').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      })).then(function (arr) {
        var pack = {}; names.forEach(function (n, i) { if (arr[i]) pack[n] = arr[i]; });
        if (!pack.HP_idleGlide || !pack.HP_faceoffTense || !pack.HP_skateSlow || !pack.HP_skateFast) { console.warn('[r14] pose files missing', pack); return; }
        root.BH_R14 = root.BH_R14 || {}; root.BH_R14.pack = pack;
        view.r14 = pack; view._r14Ready = 1; installPoses(view, pack);
        console.log('[r14] locomotion poses on (IdleGlide / SkateSlow / SkateFast / FaceoffTense)');
      });
    }

    function installPoses(view, pack) {
      view.poses = view.poses || {};
      view.poseMeta = view.poseMeta || {};
      view.poseStick = view.poseStick || {};
      ['HP_idleGlide', 'HP_faceoffTense'].forEach(function (n) {
        var j = pack[n]; if (!j || !j.bones) return;
        view.poses[n] = j.bones; view.poseMeta[n] = j;
        if (j.stick && j.stick.bones) view.poseStick[n] = j.stick.bones;
      });
    }

    function slotDist(view, st, i) {
      if (!st || !root.Bubble || !view.pl[i]) return 0;
      var B = root.Bubble, u = st.u && st.u[i] != null ? st.u[i] : .5, q = B.pos(B.TR[i], u), p = view.pl[i].position;
      return Math.hypot(p.z - q[0], p.x - q[1]);
    }

    function pickState(view, st, i, v, L) {
      if (FORCE) return { name: FORCE, fade: XFADE, tense: FORCE === 'faceoffTense' ? 1 : 0 };
      var foWait = st && st.pz > 0 && !st.pg, settling = !!(st && st.pg);
      if (foWait || settling) {
        var d = slotDist(view, st, i), tense = 0;
        if (foWait && d <= FO_NEAR && v < V_IN) tense = 1;
        else if (foWait && d < FO_BLEND) tense = Math.max(0, Math.min(1, 1 - (d - FO_NEAR) / (FO_BLEND - FO_NEAR)));
        else if (foWait && v < V_OUT && d < FO_BLEND * 1.4) tense = .5;
        if (tense > .01) {
          var fade = FO_DEF;
          if (v > .002) fade = Math.max(FO_MIN, Math.min(FO_MAX, d / v));
          return { name: tense >= .97 ? 'faceoffTense' : 'idleGlide', fade: fade, tense: tense, skate: 0 };
        }
        if (settling) return { name: 'idleGlide', fade: XFADE, tense: 0 };
      }
      var Lc = L || (view.r14Loco && view.r14Loco[i]), cur = (Lc && (Lc.to || Lc.name)) || 'idleGlide';
      var name;
      if (cur === 'skateFast') {
        name = v >= V_OUT ? 'skateFast' : (v >= V_IDLE_OUT ? 'skateSlow' : 'idleGlide');
      } else if (cur === 'skateSlow') {
        name = v >= V_IN ? 'skateFast' : (v >= V_IDLE_OUT ? 'skateSlow' : 'idleGlide');
      } else {
        name = v >= V_IN ? 'skateFast' : (v >= V_SLOW_IN ? 'skateSlow' : 'idleGlide');
      }
      return { name: name, fade: XFADE, tense: 0, skate: name !== 'idleGlide' ? 1 : 0 };
    }

    var oGB = proto.glideBase;
    proto.glideBase = function (st) {
      loadOnto(this);
      if (!this._r14Ready) return oGB.call(this, st);
      var pack = this.r14, dt = this.lastDt || this._dt || .016, rd = this.rep && root.BH_RSPD ? root.BH_RSPD : 1;
      this.r14Loco = this.r14Loco || [];
      this.r14Cog = this.r14Cog || [];
      for (var i = 0; i < 12; i++) {
        var p = this.pl[i], k = p && p.userData.sk;
        if (!k || k.gk || k.pegged || !k.av) continue;
        if (this.ftIdx && this.ftIdx[i] != null) continue;
        if (st && ((st.kd && st.kd[i] > 0) || (st.dn && st.dn[i] > 0))) continue;
        var sp = this.spr && this.spr[i], v = sp ? Math.hypot(sp.vx, sp.vz) : 0;
        var want = pickState(this, st, i, v, this.r14Loco[i]);
        var L = this.r14Loco[i] || (this.r14Loco[i] = { name: want.name, w: 1, ph: (FORCE === 'skateFast' || FORCE === 'skateSlow') ? .5 : Math.random(), from: null, to: want.name, fade: XFADE, tense: 0 });
        if (want.name !== L.to) { L.from = L.name; L.to = want.name; L.w = 0; L.fade = want.fade || XFADE; }
        L.fade = want.fade || L.fade || XFADE;
        L.w = Math.min(1, L.w + (dt * rd) / Math.max(.06, L.fade));
        if (L.w >= 1) { L.name = L.to; L.from = null; }
        L.tense = want.tense || 0;
        if (/^skate/.test(L.to) || /^skate/.test(L.name)) {
          var tgt = /^skate/.test(L.to) ? L.to : L.name;
          var clip = tgt === 'skateFast' ? pack.HP_skateFast : pack.HP_skateSlow;
          var vref = tgt === 'skateFast' ? V_REF : V_REF_SLOW;
          var rate = Math.max(RATE_MIN, Math.min(RATE_MAX, (v || vref) / vref));
          if (FORCE === 'skateFast' || FORCE === 'skateSlow') rate = 1;
          L.ph = (L.ph + dt * rd * rate * FPS / ((clip && clip.period) || (tgt === 'skateFast' ? 12 : 18))) % 1;
        }
        var A, B, tw = L.w;
        function poseOf(name) {
          if (name === 'skateFast') return sampleCycle(pack.HP_skateFast, L.ph);
          if (name === 'skateSlow') return sampleCycle(pack.HP_skateSlow, L.ph);
          return stillOf(pack, name === 'faceoffTense' ? 'HP_faceoffTense' : 'HP_idleGlide');
        }
        if (L.from && tw < 1) { A = poseOf(L.from); B = poseOf(L.to); }
        else { A = poseOf(L.name); B = null; tw = 1; }
        if (L.tense > 0 && L.to !== 'faceoffTense' && L.name !== 'faceoffTense') {
          B = stillOf(pack, 'HP_faceoffTense'); tw = L.tense; A = A || poseOf('idleGlide');
        }
        var bb = boneMap(k);
        if (A) { slerpBones(bb, A.bones, 1, 'body'); mixStick(k, A.stick, 1); }
        if (B && tw > 0) { slerpBones(bb, B.bones, tw, 'body'); mixStick(k, B.stick, tw); }
        var cogA = A && A.cog, cogB = B && B.cog, cog = null;
        if (cogA && cogB && tw > 0) {
          _q.set(cogA.q[0], cogA.q[1], cogA.q[2], cogA.q[3]);
          _q2.set(cogB.q[0], cogB.q[1], cogB.q[2], cogB.q[3]);
          if (_q.dot(_q2) < 0) _q2.set(-_q2.x, -_q2.y, -_q2.z, -_q2.w);
          _q.slerp(_q2, tw);
          cog = { q: [_q.x, _q.y, _q.z, _q.w], t: [cogA.t[0] + (cogB.t[0] - cogA.t[0]) * tw, cogA.t[1] + (cogB.t[1] - cogA.t[1]) * tw, cogA.t[2] + (cogB.t[2] - cogA.t[2]) * tw] };
        } else cog = (tw > .5 && cogB) ? cogB : cogA;
        this.r14Cog[i] = cog;
        k.r14Pose = { A: A, B: B, tw: tw, name: L.to, lower: 1 };
        // apply authored COG now so later layers (legs, shots, stickAttach) see the correct Hand_R world
        applyCog(k, cog);
      }
    };

    var oLP = proto.legPose;
    proto.legPose = function (st, dt) {
      if (this._r14Ready) {
        for (var i = 0; i < 12; i++) {
          var k0 = this.pl[i] && this.pl[i].userData.sk;
          if (k0 && k0.r14Pose && !k0.gk) {
            k0.fm = k0.fm || {}; k0.fm.lower = 1; k0.fm.at = this.clock || 0;
            if (k0.lb) k0.lb.W = 0;
          }
        }
      }
      if (oLP) oLP.call(this, st, dt);
      if (!this._r14Ready) return;
      for (var i = 0; i < 12; i++) {
        var k = this.pl[i] && this.pl[i].userData.sk, P = k && k.r14Pose; if (!P || !P.A) continue;
        if (k.pegged || k.gk) continue;
        if (this.ftIdx && this.ftIdx[i] != null) continue;
        if (st && ((st.kd && st.kd[i] > 0) || (st.dn && st.dn[i] > 0))) continue;
        var bb = boneMap(k);
        slerpBones(bb, P.A.bones, 1, 'legs');
        if (P.B && P.tw > 0) slerpBones(bb, P.B.bones, P.tw, 'legs');
        // re-apply Hips after the procedural layer (it may have leaned them)
        if (P.A.bones && P.A.bones.Hips) {
          var h = P.A.bones.Hips, hb = bb.Hips;
          if (hb) { hb.quaternion.set(h[0], h[1], h[2], h[3]); }
          if (P.B && P.tw > 0 && P.B.bones.Hips && hb) hb.quaternion.slerp(_q.set(P.B.bones.Hips[0], P.B.bones.Hips[1], P.B.bones.Hips[2], P.B.bones.Hips[3]), P.tw);
        }
        if (k.fm) { k.fm.lower = 1; k.fm.at = this.clock || 0; }
      }
    };

    var oUp = proto.upright;
    proto.upright = function () {
      if (!oUp) return;
      if (!this._r14Ready) return oUp.call(this);
      var saved = [];
      for (var i = 0; i < (this.pl || []).length; i++) {
        var k = this.pl[i] && this.pl[i].userData.sk;
        if (k && k.r14Pose && k.m) { saved.push([k, k.m]); k.m = { parent: null }; }
      }
      try { oUp.call(this); } finally { saved.forEach(function (s) { s[0].m = s[1]; }); }
    };

    function applyCog(k, cog) {
      if (!k || !cog) return;
      var bb = boneMap(k), cogB = bb.COG; if (!cogB) return;
      // authored COG (usually identity rot + crouch loc). Must overwrite the idle clip's
      // ~52 deg COG pitch or Hips locals (baked against identity COG) lay the body on the ice.
      // Root stays flat. Applied BEFORE stickAttach so Hand_R.matrixWorld matches the posed hands.
      if (cog.q) cogB.quaternion.set(cog.q[0], cog.q[1], cog.q[2], cog.q[3]);
      cogB.position.set(cog.t[0], cog.t[1], cog.t[2]);
      if (k.m && k.m.updateMatrixWorld) k.m.updateMatrixWorld(true);
      else cogB.updateMatrixWorld(true);
    }

    var oSA = proto.stickAttach;
    proto.stickAttach = function () {
      // COG first, then the game's Hand_R-space stick attach (shots/passes already mixed into k.stkA)
      if (this._r14Ready) {
        for (var i = 0; i < (this.pl || []).length; i++) {
          var k = this.pl[i] && this.pl[i].userData.sk, cog = this.r14Cog && this.r14Cog[i];
          if (!k || k.gk || !cog) continue;
          applyCog(k, cog);
        }
      }
      if (oSA) oSA.call(this);
    };

    var oAP = proto.avPose;
    proto.avPose = function (st, dt, chk) {
      this.lastDt = dt;
      if (this._r14Ready) {
        var fo = st && st.pz > 0 ? 1 : 0;
        for (var i = 0; i < 12; i++) { var k = this.pl[i] && this.pl[i].userData.sk; if (k && k.av) k.fo = fo; }
      }
      if (oAP) oAP.call(this, st, dt, chk);
    };

    var oRen = proto.render;
    proto.render = function (st, dt, opt) {
      this.lastDt = dt; this._dt = dt; loadOnto(this);
      return oRen.call(this, st, dt, opt);
    };
  }

  hook(root.Bubble3D);
  root.BH_R14 = root.BH_R14 || {};
  root.BH_R14.force = FORCE;
  root.BH_R14.hook = hook;
})(window);
