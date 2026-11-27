/* v0.9.82: mixed closer bar cine with the table always framed; bar darkened
   from the outside in (radial falloff on the room, not a post overlay);
   post-goal chill / light skate / drift, then a gradual gather for the faceoff;
   first-replay camera clamp (981 widenShot was compounding every frame);
   phone double-tap / pinch zoom lock.
   Built on v0.9.81. Do not overwrite earlier versioned sources.
   Flags: ?bardark=0  ?pgchill=0  ?repclamp=0  ?padzoom=0  ?cineorbit=0 */
(function (root) {
  'use strict';
  var R3 = root.Bubble3D; if (!R3) return;
  var B = root.Bubble, L = (B && B.L) || 2;
  function qoff(n) { return new RegExp('[?&]' + n + '=0').test(location.search); }
  var BARDARK = !qoff('bardark'), PGCHILL = !qoff('pgchill');
  var REPCLAMP = !qoff('repclamp'), CINEORB = !qoff('cineorbit');
  var PADZOOM = !qoff('padzoom');

  function L3(x, y, h) { return new root.THREE.Vector3(y, h || 0, x); }

  // ---- 1. Distant bar cine: mix closer distances, always frame the table ----
  // v0.9.66 defaults were orbitR [6.5, 8.5], orbitH 2.0, look height -0.4, 300°.
  // The long y-radius plus a look point under the cabinet swung onto the end-wall
  // TV / pool table and left the bubble table a small side subject.
  var CINE = root.BubbleCINE;
  if (CINE && CINEORB) {
    CINE.orbitR = [4.2, 5.2];
    CINE.orbitH = 1.42;
    CINE.orbitDeg = 200;
  }

  function pickOrbit() {
    if (Math.random() < 0.55) {
      return { rx: 3.5 + Math.random() * 0.9, ry: 4.1 + Math.random() * 0.9, h: 1.12 + Math.random() * 0.28, lookH: 0.08, deg: 185 + Math.random() * 25 };
    }
    return { rx: 4.8 + Math.random() * 0.7, ry: 5.2 + Math.random() * 0.7, h: 1.42 + Math.random() * 0.28, lookH: 0.07, deg: 195 + Math.random() * 30 };
  }

  // Keep the camera in the bar around the table, short of the end-wall screen (~13.9)
  // and the far-side pool table. Look stays on the lit ice.
  function frameTable(view, cam, look) {
    if (!view || !view.G || !cam) return look;
    var G = view.G, loc = G.worldToLocal(cam.position.clone());
    // local = (game y, height, game x)
    var cy = L / 2, cx = 0.5;
    loc.x = Math.max(cy - 6.0, Math.min(cy + 6.0, loc.x));
    loc.z = Math.max(cx - 6.2, Math.min(cx + 6.2, loc.z));
    loc.y = Math.max(0.35, Math.min(3.2, loc.y));
    cam.position.copy(G.localToWorld(loc));
    if (!look) look = G.localToWorld(L3(0.5, L / 2, 0.08));
    else {
      var ll = G.worldToLocal(look.clone());
      // if the look has drifted off the table toward a wall prop, pull it back
      if (Math.abs(ll.x - cy) > 1.2 || Math.abs(ll.z - cx) > 1.1) {
        ll.x = cy + (ll.x - cy) * 0.15;
        ll.z = cx + (ll.z - cx) * 0.15;
      }
      ll.y = Math.max(0.02, ll.y);
      look = G.localToWorld(ll);
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    return look;
  }

  // ---- Replay camera: 981 called widenShot (×1.08 / ×1.10) every frame on
  // the persistent Rp.cs.p. camLim could not pull back faster than the 8–10%
  // push, so over the 50%-longer first angle the camera ran away to infinity
  // and the world shrank to a pinprick. The second angle starts with cut=true
  // and resets cs, which is why it usually looked fine. ----
  var WIDEN = { top: 1.10, other: 1.08 };
  var MAX_REP_DIST = 3.8;     // ice-level replay shots
  var MAX_CINE_DIST = 9.5;    // distant bar orbit
  var MAX_FOV = 68, MIN_FOV = 24;

  function dist3(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function scaleOff(cam, look, k) {
    if (!cam || !look || !(k > 0)) return;
    cam.x = look.x + (cam.x - look.x) * k;
    cam.y = look.y + (cam.y - look.y) * k;
    cam.z = look.z + (cam.z - look.z) * k;
  }
  function clampDist(cam, look, maxD) {
    if (!cam || !look) return;
    var d = dist3(cam, look);
    if (d > maxD && d > 1e-6) scaleOff(cam, look, maxD / d);
  }
  function clampFov(cam) {
    if (!cam) return;
    if (cam.fov > MAX_FOV) cam.fov = MAX_FOV;
    if (cam.fov < MIN_FOV) cam.fov = MIN_FOV;
    if (cam.updateProjectionMatrix) cam.updateProjectionMatrix();
  }
  function clampReplayCam(view, Rp, mode) {
    if (!REPCLAMP || !view) return;
    var cam = view.persp, look = (Rp && Rp.ls && Rp.ls.p) || (view.focusPt);
    if (!cam) return;
    var cine = mode === 'cine' || (Rp && Rp.cine);
    clampDist(cam.position, look, cine ? MAX_CINE_DIST : MAX_REP_DIST);
    if (Rp && Rp.cs && Rp.cs.p) clampDist(Rp.cs.p, look, cine ? MAX_CINE_DIST : MAX_REP_DIST);
    clampFov(cam);
    if (look) { cam.up.set(0, 1, 0); cam.lookAt(look); }
  }

  // ---- 2. Bar darker from the outside in (room meshes only) ----
  function afterRoom(view) {
    if (!BARDARK || !view || !view.room || view._barDark) return;
    var THREE = root.THREE; if (!THREE) return;
    var uC = { value: new THREE.Vector3(L / 2, 0, 0.5) };
    var uR0 = { value: 2.35 }, uR1 = { value: 10.4 }, uEdge = { value: 0.11 };
    view._barU = { uC: uC, uR0: uR0, uR1: uR1, uEdge: uEdge };
    view.room.traverse(function (o) {
      if (o.isLight) return;
      if (o.isSprite && o.material) {
        var sm = o.material, base = sm.color ? sm.color.clone() : new THREE.Color(0xffffff);
        o.userData.barBase = base;
        o.onBeforeRender = function () {
          var w = o.getWorldPosition(new THREE.Vector3());
          var d = Math.hypot(w.x - uC.value.x, w.z - uC.value.z);
          var t = d <= uR0.value ? 1 : d >= uR1.value ? 0 : 1 - (d - uR0.value) / (uR1.value - uR0.value);
          t = t * t * (3 - 2 * t);
          var f = uEdge.value + (1 - uEdge.value) * t;
          sm.color.copy(base).multiplyScalar(f);
        };
        return;
      }
      if (!o.isMesh || !o.material) return;
      var orig = o.material, col = orig.color ? orig.color.clone() : new THREE.Color(0x221108);
      var mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: col },
          uC: uC, uR0: uR0, uR1: uR1, uEdge: uEdge,
          uOp: { value: orig.opacity != null ? orig.opacity : 1 },
          uMap: { value: orig.map || null },
          uUseMap: { value: orig.map ? 1 : 0 }
        },
        transparent: !!orig.transparent || (orig.opacity != null && orig.opacity < 1),
        depthWrite: orig.depthWrite !== false,
        side: orig.side != null ? orig.side : THREE.FrontSide,
        lights: false,
        vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'uniform vec3 uColor,uC; uniform float uR0,uR1,uEdge,uOp,uUseMap; uniform sampler2D uMap; varying vec3 vW; varying vec2 vUv; void main(){ float d = length(vW.xz - uC.xz); float f = mix(uEdge, 1.0, smoothstep(uR1, uR0, d)); vec3 c = uColor; if (uUseMap > 0.5) c *= texture2D(uMap, vUv).rgb; gl_FragColor = vec4(c * f, uOp); }'
      });
      if (orig.map) { mat.uniforms.uMap.value = orig.map; mat.uniforms.uUseMap.value = 1; }
      o.material = mat;
    });
    view._barDark = 1;
  }
  function updateBarCenter(view) {
    if (!view || !view._barU || !view.G) return;
    view._barU.uC.value.copy(view.G.localToWorld(new root.THREE.Vector3(L / 2, 0, 0.5)));
  }

  // ---- 3. Post-goal loco: standing chill, light SkateSlow, floating, then gather ----
  function isLinger(view) {
    return !!(view && view.rep && view.rep.t < (view.rep.wait || 0) && !view.rep.cine);
  }
  function boneMap(k) {
    var m = {}, rootO = k && (k.m || k.g);
    if (!rootO || !rootO.traverse) return m;
    rootO.traverse(function (o) { if (o && o.name) m[o.name] = o; });
    return m;
  }
  function applyBones(k, bones) {
    if (!k || !bones) return;
    var bb = boneMap(k), n, b, a;
    for (n in bones) {
      b = bb[n]; a = bones[n];
      if (!b || !a || !b.quaternion) continue;
      b.quaternion.set(a[0], a[1], a[2], a[3]);
    }
  }
  function prepPgLoco(view, st) {
    if (!PGCHILL || !st || !st.pg || isLinger(view)) return;
    var sim = root.BHT && root.BHT.sim;
    view._pgStyle = view._pgStyle || [];
    view.r14V = view.r14V || [];
    for (var i = 0; i < 12; i++) {
      var k = view.pl && view.pl[i] && view.pl[i].userData.sk;
      if (!k || k.gk) continue;
      if (view._pgStyle[i] == null) view._pgStyle[i] = i % 3; // 0 idle, 1 tense, 2 slow
      var style = view._pgStyle[i];
      var len = (B.TR && B.TR[i] && B.TR[i].len) || 1;
      var v = style === 2 ? 0.30 : 0;          // just inside the slow band, never fast
      view.r14V[i] = v;
      if (sim && sim.lu) sim.lu[i] = v / len;
      if (sim && sim.fg && sim.fg(i) && sim.mv) sim.mv[i] = 0;
    }
  }
  function restorePgPose(view, st) {
    if (!PGCHILL || !st || !st.pg || isLinger(view)) return;
    for (var i = 0; i < 12; i++) {
      var k = view.pl && view.pl[i] && view.pl[i].userData.sk;
      if (!k || k.gk) continue;
      var P = k.r14Pose, Loco = view.r14Loco && view.r14Loco[i];
      if (Loco && (Loco.to === 'skateFast' || Loco.name === 'skateFast')) {
        Loco.to = view._pgStyle && view._pgStyle[i] === 2 ? 'skateSlow' : (view._pgStyle[i] === 1 ? 'tenseGlide' : 'idleGlide');
        Loco.band = Loco.to === 'skateSlow' ? 'slow' : 'hold';
        Loco.rate = Loco.to === 'skateSlow' ? 0.45 : 0;
      }
      if (P && P.A && P.A.bones) {
        applyBones(k, P.A.bones);
        if (P.B && P.tw > 0 && P.B.bones) {
          var bb = boneMap(k), n, b, a, t = P.tw, q = new root.THREE.Quaternion(), q2 = new root.THREE.Quaternion();
          for (n in P.B.bones) {
            b = bb[n]; a = P.B.bones[n];
            if (!b || !a) continue;
            q.copy(b.quaternion); q2.set(a[0], a[1], a[2], a[3]);
            if (q.dot(q2) < 0) q2.set(-q2.x, -q2.y, -q2.z, -q2.w);
            q.slerp(q2, t); b.quaternion.copy(q);
          }
        }
      }
    }
  }

  // ---- Phone zoom lock (pad page). Does not hook visibility / blur / music. ----
  function installPadZoom() {
    if (!PADZOOM || root.__BH_PADZOOM) return;
    var onPad = /pad[_v.]/i.test(location.pathname) || !!root.ZTP_TABLE;
    if (!onPad) return;
    root.__BH_PADZOOM = 1;
    var META = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    function meta() {
      var m = document.querySelector('meta[name=viewport]');
      if (!m) { m = document.createElement('meta'); m.name = 'viewport'; (document.head || document.documentElement).appendChild(m); }
      m.setAttribute('content', META);
    }
    function reset() {
      meta();
      try { document.documentElement.style.zoom = '1'; } catch (e) {}
      try { window.scrollTo(0, 0); } catch (e2) {}
    }
    function maybe() { var vv = window.visualViewport; if (vv && vv.scale > 1.001) reset(); }
    function pd(e) { e.preventDefault(); }
    meta();
    document.addEventListener('dblclick', pd, { capture: true });
    document.addEventListener('gesturestart', pd, { capture: true, passive: false });
    document.addEventListener('gesturechange', pd, { capture: true, passive: false });
    document.addEventListener('gestureend', pd, { capture: true, passive: false });
    document.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { capture: true, passive: false });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', maybe);
      window.visualViewport.addEventListener('scroll', maybe);
    }
    window.addEventListener('resize', maybe);
    setInterval(maybe, 400);
  }
  try { installPadZoom(); } catch (e) {}

  function hook(R) {
    if (!R || R.__v0982) return; R.__v0982 = 1;
    var proto = R.prototype;

    var oBuild = proto.build;
    proto.build = function () {
      var r = oBuild ? oBuild.call(this) : undefined;
      afterRoom(this);
      return r;
    };

    var oGB = proto.glideBase;
    proto.glideBase = function (st) {
      prepPgLoco(this, st);
      var r = oGB ? oGB.call(this, st) : undefined;
      restorePgPose(this, st);
      if (!(st && st.pg)) this._pgStyle = null;
      return r;
    };

    // Undo 981's per-frame widen before camLim, then let 981 apply it once.
    // During a cut, cs is rebuilt from `want`, so leave it. After the last
    // source frame (held tail / 50% longer first angle) the same once-wide
    // framing is held instead of extrapolating out.
    var oShot = proto.shot;
    proto.shot = function (kind, fr, Rp, dt, cut) {
      if (REPCLAMP && Rp && Rp.cs && Rp._widK && !cut && kind !== 'rail' && kind !== 'railchase') {
        var look0 = Rp.ls && Rp.ls.p;
        if (look0) scaleOff(Rp.cs.p, look0, 1 / Rp._widK);
        Rp._widK = 0;
      }
      if (oShot) oShot.call(this, kind, fr, Rp, dt, cut);
      if (REPCLAMP && Rp && kind !== 'rail' && kind !== 'railchase') {
        Rp._widK = kind === 'top' ? WIDEN.top : WIDEN.other;
      } else if (Rp) {
        Rp._widK = 0;
      }
      clampReplayCam(this, Rp, 'shot');
    };

    var oStep = proto.cineStep;
    if (oStep) {
      proto.cineStep = function (Rp, st, dt, W, H) {
        if (CINEORB && Rp && Rp.cine && !Rp._orb982) Rp._orb982 = pickOrbit();
        var C = root.BubbleCINE, prev = null;
        if (C && Rp && Rp._orb982) {
          prev = { orbitR: C.orbitR, orbitH: C.orbitH, orbitDeg: C.orbitDeg };
          C.orbitR = [Rp._orb982.rx, Rp._orb982.ry];
          C.orbitH = Rp._orb982.h;
          C.orbitDeg = Rp._orb982.deg;
        }
        var out = oStep.call(this, Rp, st, dt, W, H);
        if (prev && C) { C.orbitR = prev.orbitR; C.orbitH = prev.orbitH; C.orbitDeg = prev.orbitDeg; }
        var cam = this.persp, zone = Rp && Rp.zone, G = this.G;
        if (CINEORB && cam && G && Rp && (zone === 'orbit' || zone === 'zoom')) {
          var o = Rp._orb982 || { lookH: 0.08 };
          var look = Rp.ls && Rp.ls.p;
          if (look) {
            var ll = G.worldToLocal(look.clone());
            if (zone === 'orbit') ll.y = o.lookH;
            else ll.y = Math.max(ll.y, o.lookH * 0.5);
            look = G.localToWorld(ll);
            Rp.ls.p.copy(look);
          }
          look = frameTable(this, cam, look || (Rp.ls && Rp.ls.p));
          if (look && Rp.ls) Rp.ls.p.copy(look);
          if (Rp.cs && Rp.cs.p) Rp.cs.p.copy(cam.position);
        }
        clampReplayCam(this, Rp, 'cine');
        return out;
      };
    }

    var oCS = proto.cineShot;
    if (oCS) {
      proto.cineShot = function (sh, u, f) {
        var s = oCS.call(this, sh, u, f);
        if (!s || !sh) return s;
        if (sh.n === 'bar') {
          if (sh._bar982 == null) sh._bar982 = Math.random() < 0.5 ? 0.46 + Math.random() * 0.16 : 0.72 + Math.random() * 0.5;
          s.p[0] = -sh._bar982;
          s.p[2] = Math.max(0.18, Math.min(0.62, s.p[2] + (sh._bar982 - 0.62) * 0.15));
          s.l[2] = Math.max(0.03, s.l[2]);
          s.fov = sh._bar982 < 0.62 ? 38 : 36;
        }
        // never let a live cine look wander off the table toward a wall prop
        if (s.l) {
          s.l[0] = 0.5 + (s.l[0] - 0.5) * 0.85;
          if (s.l[1] < 0.15) s.l[1] = 0.15;
          if (s.l[1] > L - 0.15) s.l[1] = L - 0.15;
        }
        return s;
      };
    }

    var oRen = proto.render;
    proto.render = function (st, dt, opt) {
      if (this.room && !this._barDark) afterRoom(this);
      updateBarCenter(this);
      var out = oRen ? oRen.call(this, st, dt, opt) : undefined;
      if (this.rep && this.persp) clampReplayCam(this, this.rep, this.rep.cine ? 'cine' : 'shot');
      return out;
    };
  }

  hook(R3);
  if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
  root.BH_V0982 = {
    hook: hook,
    WIDEN: WIDEN,
    MAX_REP_DIST: MAX_REP_DIST,
    MAX_CINE_DIST: MAX_CINE_DIST,
    scaleOff: scaleOff,
    clampDist: clampDist,
    dist3: dist3
  };
})(window);
