/* v0.9.79: in-net goal funnel, keep + rotate the centre-ice serve slot, pin goalie pad-down root.
   ?goalbox=0, ?funnel=0, ?gkpin=0 disable pieces. The 978 serve slot stays on (rotate only). */
(function (root) {
  'use strict';
  var B = root.Bubble, R3 = root.Bubble3D;
  if (!B || !R3) return;
  var qoff = function (n) { return new RegExp('[?&]' + n + '=0(?:&|$)').test(location.search); };
  var L = B.L || 2, GY = B.GY || .128, GW = B.GW || .07;
  var BOX = B.BOX || { ND: .07, depth: .051, slot: 1.5 * (B.PR0 || .0176) * 2, slotPast: .035, NH: .045 };

  function trap(ax0, ay0, az0, ax1, ay1, az1, bx1, by1, bz1, bx0, by0, bz0) {
    var g = new THREE.BufferGeometry();
    var v = new Float32Array([ax0, ay0, az0, ax1, ay1, az1, bx1, by1, bz1, ax0, ay0, az0, bx1, by1, bz1, bx0, by0, bz0]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }

  function addFunnel(net, dir) {
    if (net.userData.funnel) return;
    var ND = BOX.ND, D = BOX.depth, S = BOX.slot, sp = BOX.slotPast, hh = BOX.NH || .045;
    var g = new THREE.Group(); g.name = 'goal_funnel';
    // local +X = into the net (same convention as the mesh, then scale.x = dir)
    var grey = new THREE.MeshPhongMaterial({ color: 0x8a9098, specular: 0x333333, shininess: 18, side: THREE.DoubleSide });
    var dark = new THREE.MeshPhongMaterial({ color: 0x0b0d10, specular: 0x111111, shininess: 8, side: THREE.DoubleSide });
    var metal = new THREE.MeshPhongMaterial({ color: 0xb4bcc4, specular: 0xffffff, shininess: 70 });
    var hx = S / 2, hy = S / 2, x0 = sp - hy, x1 = sp + hy, z0 = -hx, z1 = hx;
    // four steep hopper faces: rim at y=0 (ice) down to the slot at y=-D
    g.add(new THREE.Mesh(trap(0, 0, -GW, 0, 0, GW, x0, -D, z1, x0, -D, z0), grey));           // mouth side
    g.add(new THREE.Mesh(trap(ND, 0, GW, ND, 0, -GW, x1, -D, z0, x1, -D, z1), grey));         // back
    g.add(new THREE.Mesh(trap(0, 0, GW, ND, 0, GW, x1, -D, z1, x0, -D, z1), grey));           // +Z side
    g.add(new THREE.Mesh(trap(ND, 0, -GW, 0, 0, -GW, x0, -D, z0, x1, -D, z0), grey));         // -Z side
    // dark chute under the slot so the puck falling through reads as a hole
    var chute = new THREE.Mesh(new THREE.BoxGeometry(S * 1.05, D + .04, S * 1.05), dark);
    chute.position.set(sp, -D - .02, 0); g.add(chute);
    // thin metal lip around the slot
    var lip = .0022, lh = .0016;
    [[x0 - lip / 2, S, lip], [x1 + lip / 2, S, lip], [sp, lip, S + lip * 2], [sp, lip, S + lip * 2]].forEach(function (q, i) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(i < 2 ? lip : S + lip * 2, lh, i < 2 ? S + lip * 2 : lip), metal);
      m.position.set(i < 2 ? q[0] : sp, -D + lh / 2, i < 2 ? 0 : (i === 2 ? z1 + lip / 2 : z0 - lip / 2));
      g.add(m);
    });
    // grey box walls (sides + back) so the net reads as a box; mouth stays open
    var wall = new THREE.MeshPhongMaterial({ color: 0x7a8088, specular: 0x222222, shininess: 12, side: THREE.DoubleSide, transparent: true, opacity: .92 });
    var back = new THREE.Mesh(new THREE.BoxGeometry(.003, hh + D, GW * 2), wall); back.position.set(ND, (hh - D) / 2, 0); g.add(back);
    var sideL = new THREE.Mesh(new THREE.BoxGeometry(ND, hh + D, .003), wall); sideL.position.set(ND / 2, (hh - D) / 2, GW); g.add(sideL);
    var sideR = sideL.clone(); sideR.position.z = -GW; g.add(sideR);
    g.scale.x = dir;
    net.add(g); net.userData.funnel = g;
    // hide the old solid mesh box — its bottom face would cover the funnel at ice level
    var mesh = net.userData.mesh;
    if (mesh) mesh.visible = false;
    // faint netting on the top (open mouth, funnel visible from above and the crease)
    var netting = new THREE.MeshPhongMaterial({ color: 0xd8dee6, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false });
    var top = new THREE.Mesh(new THREE.PlaneGeometry(ND, GW * 2), netting);
    top.rotation.x = Math.PI / 2; top.position.set(ND / 2, hh, 0); g.add(top);
  }

  function punchIceHoles(view) {
    if (!view || !view.G || view._iceHoles) return;
    var ice = null;
    view.G.traverse(function (o) {
      if (ice || !o.isMesh || !o.geometry || !o.geometry.parameters) return;
      var p = o.geometry.parameters;
      if (o.material && o.material.map && o.material.alphaTest > 0 && Math.abs((p.width || 0) - L) < .01 && Math.abs((p.height || 0) - 1) < .01) ice = o;
    });
    if (!ice || !ice.material || !ice.material.map || !ice.material.map.image) return;
    var cv = ice.material.map.image, c = cv.getContext('2d'); if (!c) return;
    var CW = cv.width, CH = cv.height;
    var P = function (x, y) { return [y / L * CW, x * CH]; };
    c.save();
    c.globalCompositeOperation = 'destination-out';
    [GY, L - GY].forEach(function (gy, k) {
      var dir = k ? 1 : -1, y0 = k ? gy : gy - BOX.ND, y1 = k ? gy + BOX.ND : gy;
      var a = P(.5 - GW - .006, y0), b = P(.5 + GW + .006, y1);
      var x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
      c.fillStyle = '#000'; c.fillRect(x, y, w, h);
    });
    c.restore();
    ice.material.map.needsUpdate = true;
    view._iceHoles = 1;
  }

  function punchTableWells(view) {
    if (!view) return;
    var ND = BOX.ND, eps = .01;
    var wells = [
      { x0: GY - ND - eps, x1: GY + eps, z0: .5 - GW - eps, z1: .5 + GW + eps },
      { x0: L - GY - eps, x1: L - GY + ND + eps, z0: .5 - GW - eps, z1: .5 + GW + eps }
    ];
    var chunk =
      'varying vec3 vWellPos;\n' +
      'bool bhInWell(vec3 p) {\n' +
      '  if (p.y > 0.008) return false;\n' +
      '  if (p.x > ' + wells[0].x0.toFixed(4) + ' && p.x < ' + wells[0].x1.toFixed(4) +
      ' && p.z > ' + wells[0].z0.toFixed(4) + ' && p.z < ' + wells[0].z1.toFixed(4) + ') return true;\n' +
      '  if (p.x > ' + wells[1].x0.toFixed(4) + ' && p.x < ' + wells[1].x1.toFixed(4) +
      ' && p.z > ' + wells[1].z0.toFixed(4) + ' && p.z < ' + wells[1].z1.toFixed(4) + ') return true;\n' +
      '  return false;\n}\n';
    function punch(o) {
      var mat = o.material; if (!mat || mat.userData.wellPunch) return;
      mat.userData.wellPunch = 1;
      var prev = mat.onBeforeCompile;
      mat.onBeforeCompile = function (shader) {
        if (prev) prev(shader);
        shader.vertexShader = 'varying vec3 vWellPos;\n' + shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\n#ifdef USE_ENVMAP\n#else\n#endif\n vWellPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
        // worldpos_vertex may already exist; also inject after project_vertex as a fallback
        if (shader.vertexShader.indexOf('vWellPos =') < 0) {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\n vWellPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        }
        shader.fragmentShader = chunk + shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\n if (bhInWell(vWellPos)) discard;'
        );
      };
      mat.needsUpdate = true;
    }
    if (view.arena) view.arena.traverse(function (o) {
      if (o.isMesh && /table_top|cabinet|table/i.test(o.name)) punch(o);
    });
    (view.proc || []).forEach(function (o) { if (o && o.isMesh) punch(o); });
    view._tableHoles = 1;
  }

  function rotateServeSlot(view) {
    var g = view && view._slotBox; if (!g) return;
    // 978 built the well long along the rink (goal-to-goal). Real bubble-hockey
    // (and the painted ice texture) run the slot across the rink, along the red line.
    if (!g.userData.rot90) { g.rotation.y = Math.PI / 2; g.userData.rot90 = 1; }
  }

  function pinGoalieRoot(view) {
    if (qoff('gkpin') || !view || !view.pl) return;
    var ready = view.poses && view.poses.G_ready, cx = 0, cz = 0, has = false;
    if (ready && ready.COG && ready.COG.length > 6) { cx = ready.COG[4] || 0; cz = ready.COG[6] || 0; has = true; }
    for (var i = 0; i < 12; i++) {
      var k = view.pl[i] && view.pl[i].userData.sk; if (!k || !k.gk || k.pegged) continue;
      var g = k.gk, b = g.b || {}, lab = g.lab || g.cur || '';
      // Pad-down / low-block is the reported swim; pin every pose so Root/COG never leave the track.
      var cog = b.COG, rootB = b.Root;
      if (cog) {
        if (!g.cogBind) g.cogBind = cog.position.clone();
        var rx = has ? cx : g.cogBind.x, rz = has ? cz : g.cogBind.z;
        cog.position.x = rx; cog.position.z = rz;
        cog.updateMatrixWorld(true);
      }
      if (rootB) {
        if (!g.rootBind) g.rootBind = rootB.position.clone();
        rootB.position.x = g.rootBind.x; rootB.position.z = g.rootBind.z;
        rootB.updateMatrixWorld(true);
      }
    }
  }

  function hook(R) {
    if (!R || R.__v0979) return; R.__v0979 = 1;
    var proto = R.prototype;
    var oBuild = proto.build;
    proto.build = function () {
      var r = oBuild.call(this);
      install(this);
      return r;
    };
    var oGk = proto.gkPose;
    proto.gkPose = function (st, dt) {
      var out = oGk ? oGk.call(this, st, dt) : undefined;
      pinGoalieRoot(this);
      return out;
    };
    var oRen = proto.render;
    proto.render = function (st, dt, opt) {
      if (!this._v0979Init && this.G) { this._v0979Init = 1; install(this); }
      return oRen.call(this, st, dt, opt);
    };
  }
  function install(view) {
    if (!view) return;
    rotateServeSlot(view);
    if (!qoff('funnel') && view.nets) {
      view.nets.forEach(function (n, side) {
        var dir = n.position && n.position.x > L / 2 ? 1 : -1;
        addFunnel(n, dir);
      });
      punchIceHoles(view);
      punchTableWells(view);
      if (!view._wellPoll) {
        view._wellPoll = 1;
        var n = 0, self = view;
        var t = setInterval(function () {
          n++; punchTableWells(self);
          if (self.arena || n > 80) clearInterval(t);
        }, 100);
      }
    }
  }

  hook(R3);
  if (root.BHT && root.BHT.R3) { hook(root.BHT.R3.constructor); install(root.BHT.R3); }
  root.BH_V0979 = { hook: hook, install: install, BOX: BOX };
})(window);
