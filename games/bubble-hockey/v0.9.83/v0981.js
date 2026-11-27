/* v0.9.81: holographic board strip, glass wrapped to the boards, BoardHit/GlassBreak
   procedural slots, phone haptics, meatier pad-save thud, 5–8 s live linger + Cheer/Sad,
   longer/wider replays, disc puck (no ice penetration, 2–6 frame flatten),
   scrimmage highlight reel, check reach +8%, rail-chase replay cam,
   game-wide highlight ledger (top 10 at the end, top 30 browsable).
   Flags: ?holo=0 ?glasswrap=0 ?boardhit=0 ?bh=0 ?glassbreak=0 ?haptic=0 ?padsfx=0 ?scrimreel=0 ?reel=0
   (plus existing ?digout=0 ?tumble=0 ?claw=0 ?camclamp=0 ?phonecine=0 ?loa=0
   ?funnel=0 ?goalbox=0 ?cine=0 ?r14=0). Do not import BoardHitFront clips yet. */
(function (root) {
  'use strict';
  var B = root.Bubble, R3 = root.Bubble3D;
  if (!B || !R3) return;
  var qoff = function (n) { return new RegExp('[?&]' + n + '=0(?:&|$)').test(location.search || ''); };
  var L = B.L || 2, UNIT = .62;
  var HOLO_ON = !qoff('holo'), WRAP_ON = !qoff('glasswrap');
  var BH_ON = !qoff('boardhit') && !qoff('bh');
  var HAP_ON = !qoff('haptic'), PADSFX_ON = !qoff('padsfx');
  var SCRIM_ON = !qoff('scrimreel');
  var REEL_ON = !qoff('reel');
  var NEW_H = (0.06142416 / UNIT) * .5;           // ~0.0495 game units (halved boards)
  var STRIP_Y = .105;                             // hover at old board-top so torsos/heads pass through
  var INNER_X = .31, INNER_Z = .62, CORNER = .12 * UNIT;
  var BOARD_TH = .007515, GLASS_GAP = .004;
  var TX = INNER_X + BOARD_TH + GLASS_GAP, TZ = INNER_Z + BOARD_TH + GLASS_GAP;
  var CR = CORNER + BOARD_TH + GLASS_GAP;
  var COL_HOME = 0xff5a6e, COL_AWAY = 0x3aa8ff;
  var HH = .006, PR0 = B.PR0 || .0176;
  var _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();
  var BH_END = 16 / 24, BH_SLAM = 5 / 24, BH_IMPACT = 4 / 24;

  function support(n) {
    var nz = n ? n[2] : 1, a = Math.max(0, Math.min(1, Math.abs(nz)));
    return HH * a + PR0 * Math.sqrt(Math.max(0, 1 - a * a));
  }

  // ---- 13. haptics (guarded; no-op if vibrate missing) ----
  var hapEv = '', hapClk = -1;
  function hap(pattern) {
    if (!HAP_ON) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch (e) {}
  }
  function hapticTick(st) {
    if (!HAP_ON || !st) return;
    var ev = st.ev || '', clk = st.t != null ? st.t : (st.tm != null ? st.tm : ev);
    if (ev && ev !== hapEv) {
      if (ev.indexOf('goal') === 0) hap([70, 60, 70, 60, 120]);          // triple buzz
      else if (ev === 'padsave') hap(40);                               // quick short buzz
      else if (ev === 'onetimer' || ev === 'shot' || ev === 'slap') hap(18); // tiny buzz
    }
    hapEv = ev; hapClk = clk;
  }
  root.BH_HAPTIC = { tick: hapticTick, buzz: hap };

  // ---- 14. meatier pad-save thud (retro sine+triangle, heavier than bthud); hook BHSFX ----
  var sfxAC = null, sfxEv = '';
  function padThud() {
    if (!PADSFX_ON || root.BH_MUTE) return;
    try {
      sfxAC = sfxAC || new (window.AudioContext || window.webkitAudioContext)();
      var t = sfxAC.currentTime, o = sfxAC.createOscillator(), g = sfxAC.createGain();
      var o2 = sfxAC.createOscillator(), g2 = sfxAC.createGain();
      var o3 = sfxAC.createOscillator(), g3 = sfxAC.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + .28);
      g.gain.setValueAtTime(.34, t); g.gain.exponentialRampToValueAtTime(.001, t + .32);
      o2.type = 'triangle'; o2.frequency.setValueAtTime(420, t); o2.frequency.exponentialRampToValueAtTime(110, t + .12);
      g2.gain.setValueAtTime(.16, t); g2.gain.exponentialRampToValueAtTime(.001, t + .14);
      o3.type = 'square'; o3.frequency.setValueAtTime(90, t); o3.frequency.exponentialRampToValueAtTime(40, t + .08);
      g3.gain.setValueAtTime(.07, t); g3.gain.exponentialRampToValueAtTime(.001, t + .09);
      o.connect(g); o2.connect(g2); o3.connect(g3);
      g.connect(sfxAC.destination); g2.connect(sfxAC.destination); g3.connect(sfxAC.destination);
      o.start(t); o2.start(t); o3.start(t); o.stop(t + .34); o2.stop(t + .15); o3.stop(t + .1);
    } catch (e) {}
  }
  function hookSfx() {
    var api = root.BHSFX; if (!api || api.__v0981) return;
    api.__v0981 = 1;
    var oTick = api.tick;
    api.tick = function (s, rep, demo, attract) {
      if (oTick) oTick.call(this, s, rep, demo, attract);
      if (!s || rep || demo || attract) return;
      var ev = s.ev || '';
      if (ev && ev !== sfxEv && ev === 'padsave') padThud();
      sfxEv = ev;
    };
  }
  hookSfx();
  setTimeout(hookSfx, 0);

  // ---- glass wrap: pull glass_dome in to sit just outside the halved boards and wrap the cap ----
  function targetWall(x, z) {
    var ax = Math.abs(x), az = Math.abs(z);
    var sx = x < 0 ? -1 : 1, sz = z < 0 ? -1 : 1;
    var bx = TX - CR, bz = TZ - CR;
    var qx = ax - bx, qz = az - bz;
    var px, pz;
    if (qx > 0 && qz > 0) {
      var len = Math.sqrt(qx * qx + qz * qz) || 1;
      var k = CR / len;
      px = sx * (bx + qx * k); pz = sz * (bz + qz * k);
    } else if (qx > qz) { px = sx * TX; pz = z; }
    else { px = x; pz = sz * TZ; }
    return [px, pz];
  }
  function wrapGlass(A) {
    if (!A || A.userData.g981 || !WRAP_ON) return;
    A.userData.g981 = 1;
    var capY = NEW_H * UNIT, wrapDown = .01, wallTop = .22;
    A.traverse(function (o) {
      if (!o.isMesh || !/glass_dome/.test(o.name)) return;
      var g = o.geometry, pos = g && g.attributes && g.attributes.position; if (!pos) return;
      if (!g.userData) g.userData = {};
      if (g.userData.g981) return;
      g.userData.g981 = 1;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        var tw = targetWall(x, z);
        var ny;
        if (y < capY + .008) {
          // ice flange and lower curtain: wrap over the cap and a centimetre down the outside
          var u = Math.max(0, Math.min(1, y / Math.max(.001, capY)));
          ny = capY - wrapDown * (1 - u * .35);
          pos.setXYZ(i, tw[0], ny, tw[1]);
        } else if (y < wallTop) {
          var f = 1 - (y - capY) / (wallTop - capY);
          f = f * f * (3 - 2 * f);
          pos.setXYZ(i, x + (tw[0] - x) * f, y, z + (tw[1] - z) * f);
        }
      }
      pos.needsUpdate = true;
      if (o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundingSphere();
    });
  }

  function ringShape(pad, th) {
    function rr(w, h, r, x, y) {
      var s = new THREE.Shape();
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
    }
    var o = rr(L + 2 * (pad + th), 1 + 2 * (pad + th), .14 + pad + th, -pad - th, -pad - th);
    var hole = rr(L + 2 * pad, 1 + 2 * pad, .12 + pad, -pad, -pad); o.holes.push(hole);
    return o;
  }
  function addProcGlass(view) {
    if (!WRAP_ON || !view || !view.G || view._procGlass981) return;
    // If the arena model loaded, its wrapped glass is enough. Otherwise add a tight skirt.
    if (view.arena) return;
    view._procGlass981 = 1;
    var hgt = .22;
    var geo = new THREE.ExtrudeGeometry(ringShape(.012, .006), { depth: hgt, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshPhongMaterial({ color: 0xdff0ff, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide, shininess: 90, specular: 0x88aacc });
    var m = new THREE.Mesh(geo, mat);
    m.position.y = hgt; m.name = 'glass_dome_proc'; m.renderOrder = 3;
    view.G.add(m); view._procGlassMesh = m;
  }

  // ---- 12a. holographic team strip ----
  function holoMat(color, sideSign) {
    var uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uRip: { value: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, // 4 ripples × (x, y, age)
      uSide: { value: sideSign }
    };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: [
        'uniform float uTime;',
        'uniform float uRip[12];',
        'varying vec2 vUv; varying float vPulse; varying vec3 vPos;',
        'void main(){',
        '  vUv = uv; vPos = position;',
        '  vec3 p = position;',
        '  float rip = 0.0;',
        '  for (int i = 0; i < 4; i++){',
        '    float rx = uRip[i*3+0], ry = uRip[i*3+1], age = uRip[i*3+2];',
        '    if (age > 0.001 && age < 1.2){',
        '      float d = distance(vec2(p.x, p.z), vec2(ry, rx));',
        '      float env = exp(-age * 2.4) * exp(-abs(d - age * 0.28) * 28.0);',
        '      rip += env * 0.012;',
        '    }',
        '  }',
        '  p.y += rip + sin(uTime * 3.2 + p.x * 18.0 + p.z * 14.0) * 0.0015;',
        '  vPulse = rip;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uTime;',
        'varying vec2 vUv; varying float vPulse; varying vec3 vPos;',
        'void main(){',
        '  float scan = 0.55 + 0.45 * sin(vPos.x * 40.0 + uTime * 6.0);',
        '  float edge = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);',
        '  float a = (0.28 + vPulse * 8.0 + scan * 0.15) * edge;',
        '  gl_FragColor = vec4(uColor * (0.85 + vPulse * 6.0), a);',
        '}'
      ].join('\n')
    });
    mat.userData.u = uniforms;
    return mat;
  }
  function addHoloStrip(view) {
    if (!HOLO_ON || !view || !view.G || view._holo981) return;
    view._holo981 = 1;
    var g = new THREE.Group(); g.name = 'HoloStrip';
    var th = .01, hgt = .012, pad = .001;
    function makeSide(color, sign, y0, y1) {
      // two long-side + end segments as thin boxes so players visibly pass through (no collision)
      var mat = holoMat(color, sign);
      var segs = [];
      function box(lx, lz, w, d) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(d, hgt, w), mat);
        m.position.set(lz, STRIP_Y, lx);
        m.renderOrder = 4;
        g.add(m); segs.push(m);
      }
      // long sides (x=0 and x=1) covering this team's half of the length
      var mid = L / 2, yA = sign < 0 ? 0.06 : mid, yB = sign < 0 ? mid : L - 0.06, len = yB - yA, cy = (yA + yB) / 2;
      box(0, cy, th, len);
      box(1, cy, th, len);
      // end boards of this team
      var ey = sign < 0 ? 0.05 : L - 0.05;
      box(0.5, ey, 1 - .02, th);
      return mat;
    }
    var m0 = makeSide(COL_HOME, -1);
    var m1 = makeSide(COL_AWAY, 1);
    view.G.add(g);
    view._holo = { g: g, mats: [m0, m1], rip: [], lastIn: [] };
  }
  function holoStep(view, st, dt) {
    if (!HOLO_ON || !view._holo || !st) return;
    var H = view._holo, t = (view.clock || 0);
    H.mats.forEach(function (m) { if (m && m.userData.u) m.userData.u.uTime.value = t; });
    var rip = H.rip;
    var arr0 = H.mats[0] && H.mats[0].userData.u && H.mats[0].userData.u.uRip.value;
    var arr1 = H.mats[1] && H.mats[1].userData.u && H.mats[1].userData.u.uRip.value;
    for (var r = 0; r < rip.length; r++) rip[r].age += dt;
    while (rip.length && rip[0].age > 1.2) rip.shift();
    function pack(arr) {
      if (!arr) return;
      for (var i = 0; i < 4; i++) {
        var rp = rip[i];
        arr[i * 3] = rp ? rp.x : 0;
        arr[i * 3 + 1] = rp ? rp.y : 0;
        arr[i * 3 + 2] = rp ? rp.age : 0;
      }
    }
    pack(arr0); pack(arr1);

    function posOf(i) {
      var tr = B.TR && B.TR[i], u = st.u && st.u[i];
      if (!tr || u == null || !B.pos) return null;
      var q = B.pos(tr, u), o = st.o && st.o[i] ? st.o[i] : [0, 0];
      return [q[0] + o[0], q[1] + o[1]];
    }
    function inStrip(p) {
      if (!p) return false;
      var m = .035;
      return p[0] < m || p[0] > 1 - m || p[1] < .05 + m || p[1] > L - .05 - m;
    }
    H.lastIn = H.lastIn || [];
    for (var i = 0; i < 12; i++) {
      var p = posOf(i), now = inStrip(p);
      if (now && !H.lastIn[i] && p) {
        rip.unshift({ x: p[0], y: p[1], age: 0.001 });
        if (rip.length > 8) rip.pop();
        var col = (B.TR && B.TR[i] && B.TR[i].t) ? COL_AWAY : COL_HOME;
        if (view.emit) view.emit(p[0], p[1], STRIP_Y, 14, col, .18, .35, .2);
      }
      H.lastIn[i] = now;
    }
  }

  // ---- 12c + 15. procedural BoardHit / GlassBreak / Cheer / Sad overlays ----
  function bonesOf(k) {
    if (!k) return null;
    if (k.r14b) return k.r14b;
    if (k.lb && k.lb.b) return k.lb.b;
    var bb = {};
    if (k.m) k.m.traverse(function (o) { if (o.name && !bb[o.name]) bb[o.name] = o; });
    k.r14b = bb; return bb;
  }
  function rotB(bb, name, ax, ay, az, ang) {
    var b = bb[name]; if (!b || !ang) return;
    _q2.setFromAxisAngle(_v.set(ax, ay, az), ang);
    b.quaternion.premultiply(_q2);
  }
  function applyBoardHit(view, st) {
    if (!BH_ON || !st || !st.bh || !view.pl) return;
    for (var i = 0; i < 12; i++) {
      var b = st.bh[i]; if (!b || !b.t) continue;
      var k = view.pl[i] && view.pl[i].userData.sk; if (!k || k.gk) continue;
      var bb = bonesOf(k); if (!bb) continue;
      var t = b.t, u, slam, shove;
      if (t <= BH_IMPACT) { slam = t / BH_IMPACT; shove = 0; }
      else if (t <= BH_SLAM) { slam = 1; shove = 0; }
      else if (t < BH_END) { slam = 1 - (t - BH_SLAM) / (BH_END - BH_SLAM); shove = (t - BH_SLAM) / (BH_END - BH_SLAM); }
      else { slam = 0; shove = 1; if (t > BH_END + .2) continue; }
      var dir = b.dir || 'Front', sL = dir === 'Left' ? 1 : dir === 'Right' ? -1 : 0;
      var front = dir === 'Front' ? 1 : dir === 'Back' ? -1 : 0;
      // brace into the boards, squash at impact, shove back out
      rotB(bb, 'Spine1', 1, 0, 0, (-.55 * front + .12 * Math.abs(sL)) * slam + .28 * front * shove);
      rotB(bb, 'Spine2', 1, 0, 0, (-.35 * front) * slam);
      rotB(bb, 'Hips', 1, 0, 0, (.22 * front) * slam);
      rotB(bb, 'Spine1', 0, 0, 1, sL * .7 * slam - sL * .35 * shove);
      rotB(bb, 'Head', 1, 0, 0, -.25 * front * slam);
      rotB(bb, 'Shoulder_L', 1, 0, 0, (-.5 - .2 * slam) * (front >= 0 ? 1 : .4));
      rotB(bb, 'Shoulder_R', 1, 0, 0, (-.45 - .15 * slam) * (front >= 0 ? 1 : .4));
      rotB(bb, 'Arm_L', 0, 0, 1, .35 * slam);
      rotB(bb, 'Arm_R', 0, 0, 1, -.3 * slam);
      if (b.slide) rotB(bb, 'Hips', 0, 0, 1, sL * .25 * slam);
      if (b.glass && t > BH_SLAM) {
        rotB(bb, 'Spine1', 1, 0, 0, -1.1 * front * Math.min(1, (t - BH_SLAM) / .25));
        rotB(bb, 'Head', 1, 0, 0, -.6 * front);
      }
    }
  }
  function applyCele(view, st) {
    if (!st || !view.pl) return;
    var team = st.cel, linger = !!(view.rep && view.rep.t < (view.rep.wait || 0));
    var on = (st.pg || linger || st.msg === 'GOAL!') && team != null;
    if (!on) return;
    for (var i = 0; i < 12; i++) {
      var k = view.pl[i] && view.pl[i].userData.sk; if (!k || k.gk) continue;
      var bb = bonesOf(k); if (!bb) continue;
      var mine = B.TR && B.TR[i] && B.TR[i].t === team;
      if (mine) {
        // Cheer: hands up
        rotB(bb, 'Shoulder_L', 1, 0, 0, -1.35);
        rotB(bb, 'Shoulder_R', 1, 0, 0, -1.35);
        rotB(bb, 'Arm_L', 0, 0, 1, .45);
        rotB(bb, 'Arm_R', 0, 0, 1, -.45);
        rotB(bb, 'ForeArm_L', 0, 1, 0, -.2);
        rotB(bb, 'ForeArm_R', 0, 1, 0, .2);
        rotB(bb, 'Spine1', 1, 0, 0, -.15);
        rotB(bb, 'Head', 1, 0, 0, -.12);
      } else {
        // Sad: head down, arms slack
        rotB(bb, 'Spine1', 1, 0, 0, .28);
        rotB(bb, 'Head', 1, 0, 0, .45);
        rotB(bb, 'Shoulder_L', 1, 0, 0, .25);
        rotB(bb, 'Shoulder_R', 1, 0, 0, .25);
        rotB(bb, 'Arm_L', 0, 0, 1, .2);
        rotB(bb, 'Arm_R', 0, 0, 1, -.2);
      }
    }
  }

  // ---- 17. disc puck visual: support height, pn-driven tilt, 2–6 frame flatten already in sim ----
  function orientPuck(view, st) {
    var pk = view.puck; if (!pk || !st || !st.p) return;
    var n = st.pn || [0, 0, 1];
    var z = st.z || 0;
    var sup = support(n);
    // Three.js Y is height; L3(x,y,h) = (y, h, x)
    pk.position.set(st.p[1], sup + z, st.p[0]);
    // local +Y (cylinder axis) → game normal (nx, ny, nz) → Three (ny, nz, nx)
    var up = _v.set(n[1], n[2], n[0]);
    if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
    else up.normalize();
    _q2.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    if (st.c >= 0 && st.a && st.a[st.c] != null) {
      // yaw the flat disc with the carrier
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.a[st.c]);
      _q2.multiply(_q);
    }
    pk.quaternion.copy(_q2);
  }

  // ---- 15 + 16. linger, longer first/second replay, wider cams ----
  function stretchSegs(segs) {
    if (!segs || segs.length < 2) return segs;
    var a = segs[0].slice(), b = segs[1].slice();
    var play0 = (a[1] - a[0]) / (a[2] || 1);
    var play0b = play0 * 1.5;                         // first replay 50% longer
    a[1] = a[0] + play0b * (a[2] || 1);
    var play1 = play0b + 3;                           // second = first + ~3 s
    b[1] = b[0] + play1 * (b[2] || 1);
    var out = [a, b];
    for (var i = 2; i < segs.length; i++) out.push(segs[i].slice());
    return out;
  }
  function widenShot(kind, cam, look) {
    if (!cam || !look) return;
    var dx = cam.x - look.x, dy = cam.y - look.y, dz = cam.z - look.z;
    var k = kind === 'top' ? 1.10 : 1.08;            // top-down 10% less close; others a little wider
    cam.x = look.x + dx * k;
    cam.y = look.y + dy * k;
    cam.z = look.z + dz * k;
    if (kind === 'top' && cam.y < .55) cam.y = Math.max(cam.y, .55);
  }


  // ---- 18. scrimmage reel: after a 15 s+ live stretch, top 3 distinct highlights, slow-mo ----
  var HLKex = {
    shot: [4.2, 'HARD SHOT'],
    padsave: [5.2, 'PAD SAVE'],
    save: [4.2, 'BIG SAVE'],
    knock: [4.6, 'STICK KNOCKOUT'],
    air: [3.6, 'AIRBORNE'],
    popup: [3.6, 'AIRBORNE'],
    miss: [3.8, 'NEAR MISS'],
    rattle: [12, 'OFF THE POST AND IN'],
    netoff: [7.8, 'NET KNOCK-OFF'],
    tear: [7.2, 'NET TORN OFF'],
    steal: [5, 'INTERCEPTION'],
    chain: [6.2, 'PASSING PLAY'],
    scramble: [5.4, 'FACEOFF SCRAMBLE']
  };
  if (R3.HLK) {
    Object.keys(HLKex).forEach(function (k) { if (!R3.HLK[k]) R3.HLK[k] = HLKex[k]; });
  }
  var RAIL_KINDS = { onetimer: 1, shot: 1, padsave: 1, save: 1, glove: 1, miss: 1, rim: 1, goal: 1 };

  function ledgerBoost(view, c) {
    if (!c) return 0;
    var b = 0, clk = view.clock || 0, k = c.k;
    if (k === 'rattle') b += 8;
    if (k === 'goal' && view._lastOT && clk - view._lastOT < 2.4) b += 6;
    if (k === 'onetimer' && view._goalT && clk - view._goalT < 2.4) b += 6;
    if (k === 'bigcheck' || k === 'knockdown') b += 2;
    if (k === 'steal') b += 2;
    if (k === 'chain') b += 4;
    if (k === 'netoff' || k === 'tear') b += 5;
    if (k === 'scramble') b += 3;
    return b;
  }
  function noteLedger(view, st) {
    if (!view || !st) return;
    var clk = view.clock || 0, ev = st.ev || '';
    view._postHits = view._postHits || [];
    if (ev && ev !== view._ledEv && (ev === 'post' || ev === 'bar' || ev === 'mesh' || ev === 'rim')) {
      view._postHits.push(clk);
    }
    view._postHits = view._postHits.filter(function (t) { return clk - t < 2.8; });
    if (ev === 'onetimer' && ev !== view._ledEv) view._lastOT = clk;
    if (ev && ev.indexOf('goal') === 0 && ev !== view._ledEv) {
      view._goalT = clk;
      if (view._postHits.length >= 2) view._rattle = clk;
      if (view._chainAt && clk - view._chainAt < 3) view._chainGoal = clk;
    }
    if (ev === 'pass' && ev !== view._ledEv) {
      view._passes = view._passes || [];
      var ti = st.tk && st.tk[1] >= 0 ? st.tk[1] : st.c;
      var tm = (B.TR && ti >= 0 && B.TR[ti]) ? B.TR[ti].t : -1;
      view._passes.push({ t: clk, tm: tm });
      view._passes = view._passes.filter(function (p) { return clk - p.t < 4 && (tm < 0 || p.tm === tm || p.tm < 0); });
      var same = view._passes.filter(function (p) { return tm < 0 || p.tm === tm; });
      if (same.length >= 3) view._chainAt = clk;
    }
    if ((ev === 'popup' || ev === 'scramble') && ev !== view._ledEv && view._foT && clk - view._foT < 3.2) view._foScr = clk;
    if (st.msg === 'FACE OFF' || st.launch) view._foT = clk;
    if (st.rx && st.rx[0] !== view._ledRx && (st.rx[1] === 'netoff' || st.rx[1] === 'tear')) view._netoff = clk;
    if (st.rx) view._ledRx = st.rx[0];
    view._ledEv = ev;
  }


  function pickScrim(view, t0) {
    var C = (view.hl || []).filter(function (c) { return c && c.t >= t0 && c.F && c.F.length >= 10; });
    if (!C.length) return [];
    C = C.slice().sort(function (a, b) { return b.s - a.s; });
    var span = Math.max(15, (view.clock || 0) - t0);
    var gap = Math.max(2.4, Math.min(4.2, span / 5));
    function take(g) {
      var pick = [];
      C.forEach(function (c) {
        if (pick.length >= 3) return;
        var ok = pick.every(function (p) { return Math.abs(p.t - c.t) >= g; });
        if (ok) pick.push(c);
      });
      return pick;
    }
    var pick = take(gap);
    if (pick.length < 3) pick = take(Math.max(1.4, gap * .55));
    pick.sort(function (a, b) { return a.t - b.t; });
    return pick;
  }
  function startScrimReel(view) {
    var C = view._srQ;
    if (!SCRIM_ON || !C || !C.length) return false;
    if (view.rep || view.reelOn || view.im) return false;
    view._srQ = null;
    view.wrQ = C.slice();
    view.wrOn = true;
    if (view.wrNext) view.wrNext();
    return true;
  }
  function nearMiss(st) {
    if (!st || !st.p || st.c >= 0) return false;
    var GY = B.GY || .128, GW = B.GW || .07, L0 = B.L || L;
    var gy = st.p[1] < L0 / 2 ? GY : L0 - GY;
    var dy = Math.abs(st.p[1] - gy), dx = Math.abs(st.p[0] - .5);
    var sp = st.pv ? Math.hypot(st.pv[0], st.pv[1]) : 0;
    return sp > 1.4 && dy < .08 && dx > GW && dx < GW + .06;
  }
  function isRush(F, team) {
    if (!F || F.length < 6) return false;
    var gy = team ? (B.L || L) - (B.GY || .128) : (B.GY || .128);
    var a = F[0].p, b = F[F.length - 1].p;
    if (!a || !b) return false;
    var toward = (a[1] - gy) * (a[1] - b[1]); // moved toward net if start was farther and we closed the gap
    var dy = Math.abs(b[1] - a[1]);
    return dy > .55 && toward > 0;
  }
  function hasKind(F, k) {
    if (!F) return false;
    for (var i = 0; i < F.length; i++) if (F[i].ev === k) return true;
    return false;
  }

  // ---- 20. rail-chase replay cam: low, above ice, lengthwise toward the net, loose puck follow ----
  function L3g(x, y, h) { return new THREE.Vector3(y, h || 0, x); }
  function railChase(view, kind, fr, Rp, dt, cut) {
    if (!fr || !fr.p || !view.G || !Rp) return false;
    var G = view.G, dir = Rp.dir != null ? Rp.dir : -1, gy = Rp.gy != null ? Rp.gy : (B.GY || .128);
    var P = function (x, y, h) { return G.localToWorld(L3g(x, y, h)); };
    var px = fr.p[0], py = fr.p[1], z = .01 + (fr.z || 0);
    var toNet = (py - gy) * (-dir);
    var back = toNet < 0 ? .14 : Math.max(.12, Math.min(.4, .15 + toNet * .38));
    if (toNet < .4) back = Math.max(.12, back * (.5 + Math.max(0, toNet) / .4 * .5));
    // rail X: lengthwise lane, eased toward the puck so a centre-line one-timer can pull the look
    if (cut || Rp._railX == null) {
      var lane = px;
      if (fr.u && B.TR && B.pos && Rp.team != null) {
        var xs = [];
        for (var i = 0; i < 12; i++) {
          if (!B.TR[i] || B.TR[i].t !== Rp.team || B.TR[i].k === 'G') continue;
          var q = B.pos(B.TR[i], fr.u[i]);
          xs.push(q[0]);
        }
        if (xs.length >= 2) {
          xs.sort(function (a, b) { return Math.abs(a - px) - Math.abs(b - px); });
          lane = (xs[0] + xs[1]) * .5;
        }
      }
      Rp._railX = 0.5 + (lane - 0.5) * 0.7;
    } else {
      Rp._railX += (px - Rp._railX) * Math.min(1, (dt || .016) * 1.8);
    }
    var wantY = py - dir * back;
    if (dir < 0) wantY = Math.max(gy + .1, Math.min((B.L || L) - .08, wantY));
    else wantY = Math.min(gy - .1, Math.max(.08, wantY));
    var want = P(Rp._railX, wantY, .13);
    var look = P(px, py, Math.max(.008, z));
    var cam = view.persp;
    if (cut || !Rp.cs) { Rp.cs = { p: want.clone() }; Rp.ls = { p: look.clone() }; }
    else {
      var k = 1 - Math.exp(-(dt || .016) * 4.2);
      var lk = 1 - Math.exp(-(dt || .016) * 7.5); // look snaps faster than the rail, so it can turn onto a one-timer
      Rp.cs.p.lerp(want, k);
      Rp.ls.p.lerp(look, lk);
    }
    if (Rp.cs.p.y < .12) Rp.cs.p.y = .12;
    if (cam) {
      cam.position.copy(Rp.cs.p);
      cam.up.set(0, 1, 0);
      cam.lookAt(Rp.ls.p);
      cam.fov = 46;
      cam.updateProjectionMatrix();
    }
    return true;
  }

  function hook(R) {
    if (!R || R.__v0981) return; R.__v0981 = 1;
    var proto = R.prototype;

    var oBuild = proto.build;
    proto.build = function () {
      var r = oBuild ? oBuild.call(this) : undefined;
      addProcGlass(this);
      addHoloStrip(this);
      var self = this, n = 0;
      if (WRAP_ON) {
        var t = setInterval(function () {
          n++;
          if (self.arena && self.arena.userData && self.arena.userData.b975) {
            wrapGlass(self.arena); addHoloStrip(self); clearInterval(t);
          } else if (n > 240) { if (self.arena) wrapGlass(self.arena); addHoloStrip(self); clearInterval(t); }
        }, 50);
      } else {
        addHoloStrip(this);
      }
      return r;
    };

    var oPlace = proto.place;
    proto.place = function (st) {
      var r = oPlace ? oPlace.call(this, st) : undefined;
      orientPuck(this, st);
      return r;
    };

    var oGB = proto.glideBase;
    proto.glideBase = function (st) {
      var r = oGB ? oGB.call(this, st) : undefined;
      applyBoardHit(this, st);
      applyCele(this, st);
      return r;
    };

    var oGoal = proto.goal;
    proto.goal = function (team) {
      var r = oGoal ? oGoal.call(this, team) : undefined;
      var Rpl = this.rep;
      if (Rpl) {
        Rpl.wait = 5 + Math.random() * 3;             // linger on the live cam 5–8 s
        if (Rpl.segs && Rpl.segs.length) Rpl.segs = stretchSegs(Rpl.segs);
        if (Rpl.team == null) Rpl.team = team;
      }

      // 18: queue a scrimmage reel if this goal ended a 15 s+ stretch; 20: rail cam on one-timers/rushes
      if (SCRIM_ON) {
        var t0g = this.whT != null ? this.whT : (this.clock || 0) - 15;
        if ((this.clock || 0) - t0g > 15) {
          if (this.hlFlush) this.hlFlush(true);
          var Cg = pickScrim(this, t0g);
          if (Cg.length) this._srQ = Cg;
        }
      }
      if (Rpl && Rpl.segs && Rpl.segs.length) {
        var rush = isRush(Rpl.F, Rpl.team), ot = hasKind(Rpl.F, 'onetimer');
        if (rush || ot) {
          var si = 1;
          if (Rpl.segs[si] && Rpl.segs[si][3] === 'chase') si = 1;
          if (Rpl.segs[si]) Rpl.segs[si][3] = 'rail';
          else if (Rpl.segs[0]) Rpl.segs[0][3] = 'rail';
        }
      }

      return r;
    };

    var oShot = proto.shot;
    proto.shot = function (kind, fr, Rp, dt, cut) {
      if (kind === 'rail' || kind === 'railchase') {
        railChase(this, kind, fr, Rp, dt, cut);
        return;
      }
      if (oShot) oShot.call(this, kind, fr, Rp, dt, cut);
      var cam = this.persp, look = Rp && Rp.ls && Rp.ls.p;
      if (cam && look && Rp && Rp.cs && Rp.cs.p) {
        widenShot(kind, Rp.cs.p, look);
        cam.position.copy(Rp.cs.p);
        cam.up.set(0, 1, 0);
        cam.lookAt(look);
      } else if (cam && look) {
        widenShot(kind, cam.position, look);
        cam.up.set(0, 1, 0);
        cam.lookAt(look);
      }
    };

    var oHlEv = proto.hlEv;
    if (oHlEv) {
      proto.hlEv = function (st) {
        var e = oHlEv.call(this, st) || [];
        if (!st) return e;
        function has(k) { for (var i = 0; i < e.length; i++) if (e[i][0] === k) return true; return false; }
        var ev = st.ev || '', p = st.p ? st.p.slice() : [0, 0];
        var sp = st.pv ? Math.hypot(st.pv[0], st.pv[1]) : 0;
        if ((ev === 'shot' || ev === 'slap') && sp >= 1.8 && !has('shot')) e.push(['shot', p]);
        if (ev === 'padsave' && !has('padsave')) e.push(['padsave', p]);
        if (ev === 'save' && !has('save') && !has('padsave') && !has('glove')) e.push(['save', p]);
        if (ev === 'knock' && !has('knock')) e.push(['knock', p]);
        if ((ev === 'popup' || ev === 'air') && !has('air') && !has('popup')) e.push(['air', p]);
        if ((st.z || 0) > .045 && (this._srZ || 0) <= .045 && st.c < 0 && !has('air')) e.push(['air', p]);
        this._srZ = st.z || 0;
        if (nearMiss(st) && ev !== 'goal' && !has('miss') && !has('post') && !has('bar') && !has('rim')) e.push(['miss', p]);
        noteLedger(this, st);
        var clk = this.clock || 0, p2 = p;
        if (this._rattle && clk - this._rattle < .2 && !has('rattle')) e.push(['rattle', p2]);
        if (this._chainAt && ev && ev.indexOf('goal') === 0 && clk - this._chainAt < 3 && !has('chain')) e.push(['chain', p2]);
        if (this._foScr && clk - this._foScr < .2 && !has('scramble')) e.push(['scramble', p2]);
        if (this._netoff && clk - this._netoff < .2 && !has('netoff') && !has('tear')) e.push([st.rx && st.rx[1] === 'tear' ? 'tear' : 'netoff', p2]);
        if (ev === 'steal' && !has('steal')) e.push(['steal', p2]);
        return e;
      };
    }

    var oWh = proto.whRec;
    if (oWh) {
      proto.whRec = function (st) {
        var t0 = this.whT, w0 = this.whN;
        var r = oWh.call(this, st);
        if (!SCRIM_ON || !st) return r;
        if (this.whN === w0) return r;
        var dur = (this.clock || 0) - (t0 || 0);
        var per = /^(END OF|OVERTIME|FINAL|TIED|SHOOTOUT)/.test(st.msg || '') || st.ev === 'period' || st.ov >= 0;
        if (per || st.msg === 'FIGHT!' || dur <= 15) return r;
        if (this.hlFlush) this.hlFlush(true);
        var C = pickScrim(this, t0 || 0);
        if (!C.length) return r;
        if (st.msg === 'GOAL!' || (this.rep && !this.rep.wr)) { this._srQ = C; return r; }
        this.wrQ = C.slice();
        this.wrOn = true;
        this.rep = this.clipRep(this.wrQ.shift(), RAIL_KINDS[C[0].k] ? 'rail' : 'side', false);
        if (this.rep) this.rep.wr = true;
        return r;
      };
    }

    var oClip = proto.clipRep;
    if (oClip) {
      proto.clipRep = function (c, slowCam, full) {
        if (c && RAIL_KINDS[c.k] && slowCam !== 'top') slowCam = 'rail';
        return oClip.call(this, c, slowCam, full);
      };
    }

    var oCineEnd = proto.cineEndRep;
    if (oCineEnd) {
      proto.cineEndRep = function (Rpl) {
        var r = oCineEnd.call(this, Rpl);
        startScrimReel(this);
        return r;
      };
    }

    var oHlAdd = proto.hlAdd;
    if (oHlAdd) {
      proto.hlAdd = function (c) {
        if (c) c.s = (c.s || 0) + ledgerBoost(this, c);
        return oHlAdd.call(this, c);
      };
    }

    var oStartReel = proto.startReel;
    proto.startReel = function (dur) {
      if (!REEL_ON) return false;
      this.hlFlush && this.hlFlush(true);
      var H = (this.hl || []).slice().sort(function (a, b) { return b.s - a.s; });
      this._hlBook = H.slice(0, 30);
      var pick = H.slice(0, 10);
      if (!pick.length) return oStartReel ? oStartReel.call(this, dur) : false;
      var best = pick[0];
      var rest = pick.slice(1).sort(function (a, b) { return a.t - b.t; });
      rest.push(best); // highest last, as the finale
      this.reelQ = rest;
      this.reelOn = true;
      this.reelDone = false;
      this.browseOn = false;
      this._hlIdx = 0;
      this._hlAutoI = 0;
      this._hlAutoN = rest.length;
      this.reelNext();
      return true;
    };

    var oReelNext = proto.reelNext;
    proto.reelNext = function () {
      var r = oReelNext ? oReelNext.call(this) : undefined;
      if (this.rep && this.reelOn) {
        if (!this.browseOn) this._hlAutoI = (this._hlAutoI || 0) + 1;
        var cur = this.rep;
        var book = this._hlBook || this.hl || [];
        for (var i = 0; i < book.length; i++) if (book[i] && cur && book[i].t === cur.t && book[i].k === cur.kind) { this._hlIdx = i; break; }
      }
      return r;
    };

    proto.playLedger = function (i) {
      var H = this._hlBook || this.hl || [];
      if (i < 0 || i >= H.length || !H[i]) return false;
      this.browseOn = true;
      this.reelOn = true;
      this.reelDone = false;
      this.reelQ = [];
      this._hlIdx = i;
      var c = H[i], cam = (typeof RAIL_KINDS !== 'undefined' && RAIL_KINDS[c.k]) ? 'rail' : 'side';
      this.rep = this.clipRep(c, cam, true);
      if (this.rep) this.rep.hl = true;
      return true;
    };


    var oRen = proto.render;
    proto.render = function (st, dt, opt) {
      this.clock = (this.clock || 0) + (dt || 0);
      if (!this._v0981Init) {
        this._v0981Init = 1;
        hookSfx();
        addProcGlass(this);
        addHoloStrip(this);
        if (this.arena && WRAP_ON) wrapGlass(this.arena);
      } else if (this.arena && WRAP_ON && !this.arena.userData.g981 && this.arena.userData.b975) {
        wrapGlass(this.arena);
      }
      holoStep(this, st, dt || 0);
      hapticTick(st);
      if (st && st.ev === 'padsave' && st.ev !== this._padEv) padThud();
      this._padEv = st && st.ev;
      if (st && st.bh && this.emit) {
        for (var i = 0; i < 12; i++) {
          var b = st.bh[i];
          if (b && b.glass && b.t > BH_SLAM && b.t < BH_SLAM + .08 && !b._sparked) {
            b._sparked = 1;
            var tr = B.TR && B.TR[i], u = st.u && st.u[i];
            if (tr && u != null && B.pos) {
              var q = B.pos(tr, u);
              this.emit(q[0], q[1], .08, 40, 0xdff4ff, .55, .6, 1);
            }
          }
        }
      }
      var out = oRen.call(this, st, dt, opt);
      if (SCRIM_ON && this._srQ && !this.rep && !this.reelOn && !this.im) startScrimReel(this);
      return out;
    };
  }

  hook(R3);
  if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
  root.BH_V0981 = {
    hook: hook,
    flags: { holo: HOLO_ON, glasswrap: WRAP_ON, boardhit: BH_ON, haptic: HAP_ON, padsfx: PADSFX_ON, scrimreel: SCRIM_ON, reel: REEL_ON },
    STRIP_Y: STRIP_Y,
    slots: {
      BoardHit: ['Hockey_Pose_BoardHitFront_v01.blend', 'Hockey_Pose_BoardHitBack_v01.blend', 'Hockey_Pose_BoardHitLeft_v01.blend', 'Hockey_Pose_BoardHitRight_v01.blend'],
      GlassBreak: ['Hockey_Pose_GlassBreakFront_v01.blend', 'Hockey_Pose_GlassBreakBack_v01.blend', 'Hockey_Pose_GlassBreakLeft_v01.blend', 'Hockey_Pose_GlassBreakRight_v01.blend'],
      Cheer: 'Hockey_Pose_Cheer_v01.blend',
      Sad: 'Hockey_Pose_Sad_v01.blend',
      frames: '24 fps, frames 1–16; frame 1 start/contact, frame 5 peak slam, frames 5–16 shove back. Stick in Hand_R may be authored; game still allows knock-loose. Front = hit comes FROM the front. Do not import until Justin says they are animated. Expected JSON later: anim/poses_rig014_v01/HP_boardHitFront_v01.json (and Back/Left/Right, glassBreak*, cheer, sad).'
    }
  };
})(window);
