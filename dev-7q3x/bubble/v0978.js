/* v0.9.78: remaining punch-list polish (keep it light).
   - Loose-puck gravity ramps in over 0–2 s after last touch (GRAV.ramp).
   - Head look: 5% (neck) / 15% (head) springs, 5% bleed into the upper spine. Goalies + skaters.
   - Stick blade ice clamp (rigid Hand_R attach stays; blade is lifted onto the ice when not shooting).
   - First pass of a 3D metal serve-slot box at centre ice (the painted slot remains).
   - First pass of team-tint on the glass dome (home/away colours at each end).
   ?gravramp=0, ?look=0, ?iceclamp=0, ?slotbox=0, ?teamglass=0 disable each. */
(function (root) {
  'use strict';
  var B = root.Bubble, R3 = root.Bubble3D;
  if (!B || !R3) return;
  var qoff = function (n) { return new RegExp('[?&]' + n + '=0(?:&|$)').test(location.search); };
  var COLS = [0xff5a6e, 0x3aa8ff];
  var L = B.L || 2;
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  var _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _s = new THREE.Vector3();

  // ---- 8. loose-puck 0–2 s gravity ramp ----
  if (!qoff('gravramp') && B.GRAV) {
    var G = B.GRAV;
    if (G.ramp == null) G.ramp = 2;
    if (G.baseScale == null) G.baseScale = G.scale;
    var oStep = B.Sim.prototype.step;
    B.Sim.prototype.step = function (dt) {
      var t = this.lt || 0, k = 0;
      if (this.c < 0 && !this.pg && !this.air && !(this.z > .016) && !this.launch) {
        k = Math.min(1, t / Math.max(.001, G.ramp));
        k = k * k * (3 - 2 * k);
      }
      G.scale = G.baseScale * k;
      return oStep.call(this, dt);
    };
  }

  function hook(R) {
    if (!R || R.__v0978) return; R.__v0978 = 1;
    var proto = R.prototype;

    // ---- 11. head look 5% / 15% spring + 5% bleed ----
    if (!qoff('look')) {
      var LOOK = { on: 1, slow: 0.05, fast: 0.15, bleed: 0.05, cone: 40 * Math.PI / 180, skaterCone: 28 * Math.PI / 180 };
      R.LOOK = LOOK;
      function spring(prev, tgt, pct, dt) {
        var k = -Math.log(1 - pct) * 60;          // pct per frame at 60 fps, frame-rate independent
        var e = 1 - Math.exp(-(dt || 0) * k);
        return prev + (tgt - prev) * e;
      }
      function lookAtPuck(k, neck, head, spine, rd, cone) {
        if (!neck || !head || !k.mm && !k.m) return;
        var rootM = k.mm || k.m, puck = this.puck; if (!puck) return;
        rootM.updateMatrixWorld(true);
        puck.getWorldPosition(_v); rootM.worldToLocal(_v);
        head.getWorldPosition(_v2); rootM.worldToLocal(_v2); _v.sub(_v2);
        var yw = Math.atan2(_v.x, _v.z), pt = Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), mg = Math.hypot(yw, pt);
        if (mg > cone) { yw *= cone / mg; pt *= cone / mg; }
        var L = k.look || (k.look = { n: [0, 0], h: [0, 0] });
        L.n[0] = spring(L.n[0], yw, LOOK.slow, rd); L.n[1] = spring(L.n[1], pt, LOOK.slow, rd);
        L.h[0] = spring(L.h[0], yw, LOOK.fast, rd); L.h[1] = spring(L.h[1], pt, LOOK.fast, rd);
        function apply(b, yaw, pit) {
          if (!b || !b.parent) return;
          b.parent.updateMatrixWorld(true);
          _m.copy(rootM.matrixWorld).invert().multiply(b.parent.matrixWorld);
          _q2.setFromRotationMatrix(_m);
          _q.setFromAxisAngle(_v2.set(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(_v.set(-1, 0, 0), pit));
          var pinv = _q2.clone().invert();
          b.quaternion.premultiply(pinv.multiply(_q).multiply(_q2));
          b.updateMatrixWorld(true);
        }
        apply(neck, L.n[0], L.n[1]);
        apply(head, L.h[0] - L.n[0], L.h[1] - L.n[1]);   // head is the leftover of the faster spring
        if (spine) {
          var by = (L.n[0] + L.h[0]) * .5 * LOOK.bleed, bp = (L.n[1] + L.h[1]) * .5 * LOOK.bleed;
          spine.rotateY(by); spine.rotateX(-bp);
        }
        if (k.gk) k.gk.look = [L.h[0], L.h[1]];
      }
      var oGk = proto.gkLook;
      proto.gkLook = function (k, g, rd) {
        if (!g || !g.b) { if (oGk) return oGk.call(this, k, g, rd); return; }
        var hb = g.b.Head, nb = g.b.Neck, sp = g.b.Spine1 || g.b.Spine || g.b.Chest;
        if (!hb || !nb) { if (oGk) return oGk.call(this, k, g, rd); return; }
        // use the new springs instead of GLOOK.k
        k.mm = k.mm || k.m;
        lookAtPuck.call(this, k, nb, hb, sp, rd, LOOK.cone);
      };
      proto._lookAtPuck = lookAtPuck;
      proto._LOOK = LOOK;
    }

    // ---- 4. stick blade ice clamp (after attach, not during a swing/shot) ----
    if (!qoff('iceclamp')) {
      var oSA = proto.stickAttach;
      proto.stickAttach = function () {
        if (oSA) oSA.call(this);
        var st = (root.BHT && root.BHT.sim && root.BHT.sim.snap && root.BHT.sim.snap()) || this._lastSt;
        for (var i = 0; i < (this.pl || []).length; i++) {
          var k = this.pl[i] && this.pl[i].userData.sk;
          if (!k || k.gk || k.pegged || !k.stkOn) continue;
          if (st && ((st.sw === i) || (st.ln && st.ln[i] > 0))) continue;
          if (k.one && k.one.isRunning && k.one.isRunning()) continue;
          var bb = k.stkB; if (!bb || !bb.STK_Blade) continue;
          k.m.updateMatrixWorld(true);
          bb.STK_Blade.getWorldPosition(_v);
          var ice = 0.0015, dy = ice - _v.y;
          if (!(dy > 0.0004) || dy > 0.02) continue;   // only small sinks; don't yank a high follow-through
          ['STK_Butt', 'STK_Shaft_0', 'STK_Shaft_1', 'STK_Shaft_2', 'STK_Shaft_3', 'STK_Shaft_4', 'STK_Shaft_5', 'STK_Shaft_6', 'STK_Shaft_7', 'STK_Blade'].forEach(function (n) {
            var b = bb[n]; if (!b || !b.parent) return;
            b.getWorldPosition(_v2); _v2.y += dy;
            b.parent.worldToLocal(_v2); b.position.copy(_v2); b.updateMatrixWorld(true);
          });
        }
      };
    }

    // ---- 10. 3D serve-slot box (first pass) + 6. team glass tint ----
    function addSlotBox(view) {
      if (qoff('slotbox') || view._slotBox) return;
      // Narrow recessed well + raised metal lip. Phong so it reads under the existing lights
      // (Standard + high metalness goes almost black without an env map).
      var wellW = .012, wellL = .08, lip = .0032, h = .0024, depth = .003;
      var g = new THREE.Group(); g.name = 'serve_slot_box';
      var metal = new THREE.MeshPhongMaterial({ color: 0xc5ced6, specular: 0xffffff, shininess: 80 });
      var dark = new THREE.MeshPhongMaterial({ color: 0x14181e, specular: 0x222428, shininess: 12 });
      var well = new THREE.Mesh(new THREE.BoxGeometry(wellL, depth, wellW), dark);
      well.position.y = -depth / 2 + .0002; g.add(well);
      [[wellL / 2 + lip / 2, 0, lip, wellW + lip * 2], [-(wellL / 2 + lip / 2), 0, lip, wellW + lip * 2],
       [0, wellW / 2 + lip / 2, wellL, lip], [0, -(wellW / 2 + lip / 2), wellL, lip]].forEach(function (q) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(q[2], h, q[3]), metal);
        m.position.set(q[0], h / 2, q[1]); g.add(m);
      });
      g.position.copy(new THREE.Vector3(L / 2, 0, .5));   // L3(.5, L/2, 0)
      view.G.add(g); view._slotBox = g;
    }
    function tintGlass(view) {
      if (qoff('teamglass') || !view.arena || view._teamGlass) return;
      view.arena.traverse(function (o) {
        if (!o.isMesh || !/glass_dome/.test(o.name)) return;
        var mat = o.material;
        if (!mat || mat.userData.teamGlass) return;
        mat.userData.teamGlass = 1;
        mat.onBeforeCompile = function (shader) {
          shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
          shader.fragmentShader = 'varying vec3 vWPos;\n' + shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n' +
            'float g = clamp(vWPos.x / ' + L.toFixed(3) + ', 0.0, 1.0);\n' +
            'vec3 t0 = vec3(1.0, 0.353, 0.431);\n' +
            'vec3 t1 = vec3(0.227, 0.659, 1.0);\n' +
            'diffuseColor.rgb = mix(diffuseColor.rgb, mix(t0, t1, g), 0.28);\n'
          );
        };
        mat.needsUpdate = true;
        view._teamGlass = 1;
      });
      // leave arena serve_slot hidden — it is almost flush and stacks with the procedural box
    }
    var oBuild = proto.build;
    proto.build = function () {
      var r = oBuild.call(this);
      if (!this.phone) addSlotBox(this);
      return r;
    };
    var oLoad = proto.loadArena;
    proto.loadArena = function (proc) {
      var self = this, fn = oLoad.call(this, proc);
      // loadArena is async; poll once the arena is on
      var n = 0, t = setInterval(function () {
        n++; if (self.arena || n > 80) { clearInterval(t); if (self.arena) tintGlass(self); if (!self._slotBox && !self.phone) addSlotBox(self); }
      }, 100);
      return fn;
    };
    // if this instance already built (script loaded after construct) — hook via render once
    var oRen2 = proto.render;
    proto.render = function (st, dt, opt) {
      this._lastSt = st;
      if (!this._v0978Init && this.G) {
        this._v0978Init = 1;
        if (!this.phone && !this._slotBox) addSlotBox(this);
        if (this.arena) tintGlass(this);
      }
      if (this._slotBox && this.srvPulse > 0) {
        var pf = Math.max(0, this.srvPulse / .5);
        this._slotBox.position.y = 0.001 * pf;
      } else if (this._slotBox) this._slotBox.position.y = 0;
      var LOOK = this._LOOK || (R && R.LOOK);
      if (LOOK && LOOK.on && this.puck && this.pl && !this.rep) {
        var rd = dt || this.lastDt || .016;
        for (var i = 0; i < this.pl.length; i++) {
          var p = this.pl[i], sk = p && p.userData.sk;
          if (!sk || sk.gk || sk.pegged || !sk.m) continue;
          if (this.ftIdx && this.ftIdx[i] != null) continue;
          var bb = (sk.lb && sk.lb.b) || sk.r14b || sk.stkB;
          if (!bb || !bb.Head || !bb.Neck) continue;
          var host = sk.mm || (sk.m.children && sk.m.children[0]) || sk.m;
          var saved = sk.mm; sk.mm = host;
          (this._lookAtPuck || lookAtPuck).call(this, sk, bb.Neck, bb.Head, bb.Spine1 || bb.Spine, rd, LOOK.skaterCone);
          sk.mm = saved;
        }
      }
      return oRen2.call(this, st, dt, opt);
    };
  }

  hook(R3);
  if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
  root.BH_V0978 = { hook: hook };
})(window);
