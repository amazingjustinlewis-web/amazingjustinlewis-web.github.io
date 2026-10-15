/* RED DEER RESCUE v0.1 - TV/host. Blockout of downtown Red Deer -> Capstone -> CPR bridge -> Bower Ponds from OSM.
   One layout (footprint + height + anchors per building) that future scenarios can reskin. Phones vote, heroes auto-play. */
(function () {
  'use strict';
  var C = window.RDR_CONFIG, Q = new URLSearchParams(location.search);
  var LOCAL = Q.get('local') === '1';
  var V3 = THREE.Vector3, col = function (h) { return new THREE.Color(h); };
  var rnd = Math.random, clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; }, lerp = function (a, b, t) { return a + (b - a) * t; };
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function pip(p, x, z) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { var a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function bbox(p) { var b = [1e9, 1e9, -1e9, -1e9]; p.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); return b; }
  function inB(b, x, z) { return x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]; }
  var $ = function (id) { return document.getElementById(id); };

  var M, renderer, scene, camera, sun, hemi, envTex, wallMat, roofMat, skyCol = col('#9fd3ff');
  var SIM = clamp(+(Q.get('sim') || 1), 1, 8), DECK = 1.6, WATER_Y = 0.35;
  var S = { t: 0, tod: Q.get('tod') ? +Q.get('tod') : 0.32, dayLen: +(Q.get('day') || 300), ko: 0, stars: 0, dest: null, arrived: false, arriveT: 0,
    votes: {}, opts: [], winT: 0, huddle: { active: false, want: false, msg: '' }, chat: [], players: {}, quality: 0, overview: Q.get('cam') === 'overview' };
  var heroes = [], bunnies = [], statues = [], cars = [], waterPolys = [], buildingIdx = [], elev = [], labelsEl;
  var LAYOUT = { buildings: [] };   // the reskinnable data model

  fetch('data/map.json').then(function (r) { return r.json(); }).then(init);

  // ---------------------------------------------------------------- tiny geometry builder (non-indexed, flat normals, vertex colours)
  function Geo() { this.p = []; this.c = []; }
  Geo.prototype.t = function (a, b, c, k) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); for (var i = 0; i < 3; i++) this.c.push(k.r, k.g, k.b); };
  Geo.prototype.q = function (a, b, c, d, k) { this.t(a, b, c, k); this.t(a, c, d, k); };
  Geo.prototype.mesh = function (mat) { var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, mat); };
  Geo.prototype.ribbon = function (pts, w, k, joints) {   // pts: [x,y,z]
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
      this.q([a[0] - nx, a[1], a[2] - nz], [a[0] + nx, a[1], a[2] + nz], [b[0] + nx, b[1], b[2] + nz], [b[0] - nx, b[1], b[2] - nz], k);
    }
    if (joints) for (i = 1; i < pts.length - 1; i++) this.disc(pts[i], w / 2, k);
  };
  Geo.prototype.disc = function (c, r, k) { for (var j = 0; j < 6; j++) { var a0 = j / 6 * 6.283, a1 = (j + 1) / 6 * 6.283; this.t(c, [c[0] + Math.cos(a0) * r, c[1], c[2] + Math.sin(a0) * r], [c[0] + Math.cos(a1) * r, c[1], c[2] + Math.sin(a1) * r], k); } };
  Geo.prototype.seg = function (a, b, y0, y1, w, k) {      // a box along a->b (a,b: [x,z] or with own base heights via y0/y1 arrays)
    var dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
    var ya0 = y0[0], yb0 = y0[1], ya1 = y1[0], yb1 = y1[1];
    var A = [a[0] - nx, a[1] - nz], B = [a[0] + nx, a[1] + nz], Cc = [b[0] + nx, b[1] + nz], D = [b[0] - nx, b[1] - nz];
    this.q([A[0], ya1, A[1]], [B[0], ya1, B[1]], [Cc[0], yb1, Cc[1]], [D[0], yb1, D[1]], k);
    this.q([A[0], ya0, A[1]], [D[0], yb0, D[1]], [D[0], yb1, D[1]], [A[0], ya1, A[1]], k);
    this.q([B[0], ya0, B[1]], [Cc[0], yb0, Cc[1]], [Cc[0], yb1, Cc[1]], [B[0], ya1, B[1]], k);
    this.q([A[0], ya0, A[1]], [B[0], ya0, B[1]], [B[0], ya1, B[1]], [A[0], ya1, A[1]], k);
    this.q([D[0], yb0, D[1]], [Cc[0], yb0, Cc[1]], [Cc[0], yb1, Cc[1]], [D[0], yb1, D[1]], k);
  };
  function lam(o) { o = o || {}; o.vertexColors = true; o.side = THREE.DoubleSide; return new THREE.MeshLambertMaterial(o); }
  function shapeOf(p) { var s = new THREE.Shape(); p.forEach(function (q, i) { if (i) s.lineTo(q[0], -q[1]); else s.moveTo(q[0], -q[1]); }); return s; }
  function flatShape(p, y, color, mat) { var g = new THREE.ShapeGeometry(shapeOf(p)); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); var m = new THREE.Mesh(g, mat || new THREE.MeshLambertMaterial({ color: color })); m.receiveShadow = true; return m; }
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); return t; }

  // ---------------------------------------------------------------- init
  function init(data) {
    M = data;
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: Q.get('test') === '1' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.insertBefore(renderer.domElement, document.body.firstChild);
    scene = new THREE.Scene(); scene.background = skyCol.clone(); scene.fog = new THREE.Fog(0x9fd3ff, 500, 1900);
    camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 5000);
    hemi = new THREE.HemisphereLight(0xdfefff, 0x5a6a40, 0.7); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff2dd, 1.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = sc.bottom = -160; sc.right = sc.top = 160; sc.near = 10; sc.far = 900; sun.shadow.bias = -0.0008;
    scene.add(sun); scene.add(sun.target);
    labelsEl = $('labels');
    buildEnv(); buildGround(); buildGraph(); buildRoads(); buildWater(); buildBuildings(); buildTrees(); buildStatues(); buildCars(); buildBeacon(); buildFrancis();
    spawnHeroes(); newVoteRound(); setupNet();
    var c0 = centroid(heroes); camTarget.set(c0[0], 0, c0[1]);
    addEventListener('resize', function () { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    addEventListener('keydown', function (e) { if (e.key === 'o') S.overview = !S.overview; if (e.key === 'n') S.tod = (S.tod + 0.25) % 1; if (e.key === 'f') { FR.at = 0; if (FR.state === 'sleep') FR.t = 999; wakeFrancis(); } });
    $('loading').remove();
    if (Q.get('q')) setQuality(+Q.get('q'), true);
    var last = performance.now();
    (function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!S.paused) for (var k = 0; k < SIM; k++) step(dt);
      render(now, dt); requestAnimationFrame(loop);
    })(last);
  }

  // ---------------------------------------------------------------- environment / sky reflections
  function buildEnv() {
    var faces = [];
    for (var i = 0; i < 6; i++) faces.push((function (i) {
      var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
      if (i === 2) { g.fillStyle = '#cfe8ff'; g.fillRect(0, 0, 64, 64); }
      else if (i === 3) { g.fillStyle = '#4a5560'; g.fillRect(0, 0, 64, 64); }
      else { var gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#9fd3ff'); gr.addColorStop(0.48, '#f4f8ff'); gr.addColorStop(0.52, '#7a8a7a'); gr.addColorStop(1, '#3b4636'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        g.fillStyle = '#5c6b78'; for (var k = 0; k < 9; k++) { var hh = 4 + hash(i * 9 + k) * 14; g.fillRect(k * 7, 32 - hh, 6, hh); } }
      return c;
    })(i));
    envTex = new THREE.CubeTexture(faces); envTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- ground: valley floor, parks, East Hill hint
  function buildGround() {
    var b = M.bounds, g = new Geo();
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(4200, 3000), new THREE.MeshLambertMaterial({ color: 0xb8b39a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    // edge of the playable slice: a soft darker border
    var fr = new Geo(), k = col('#8f8a72');
    fr.ribbon([[b[0], 0.03, b[1]], [b[2], 0.03, b[1]], [b[2], 0.03, b[3]], [b[0], 0.03, b[3]], [b[0], 0.03, b[1]]], 4, k, true); scene.add(fr.mesh(lam()));
    var parkMat = lam(), pg = new Geo();
    M.parks.forEach(function (p, i) {
      if (p.p.length < 4 || p.seg) return;
      var green = col(p.k === 'forest' || p.k === 'wood' ? '#4f8a3c' : p.k === 'pitch' ? '#7cc35a' : '#6fb54f').offsetHSL(0, 0, (hash(i) - 0.5) * 0.06);
      var tri = THREE.ShapeUtils.triangulateShape(p.p.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), []);
      var y = 0.06 + (i % 5) * 0.004;
      tri.forEach(function (t) { pg.t([p.p[t[0]][0], y, p.p[t[0]][1]], [p.p[t[1]][0], y, p.p[t[1]][1]], [p.p[t[2]][0], y, p.p[t[2]][1]], green); });
    });
    var pm = pg.mesh(parkMat); pm.receiveShadow = true; scene.add(pm);
    // East Hill escarpment hint (terraces rising past the east edge) + west bluff beyond Great Chief Park
    var hill = new Geo(), steps = [[1010, 4, '#a7a080'], [1060, 12, '#9c9878'], [1130, 22, '#8f9070'], [1220, 32, '#7f8a66']];
    steps.forEach(function (s, i) { hill.seg([s[0] + 60, -1500], [s[0] + 60, 1500], [0, 0], [s[1], s[1]], 120 + i * 0, col(s[2])); });
    [[-1100, 6, '#9a9a78'], [-1180, 14, '#8a9070']].forEach(function (s) { hill.seg([s[0] - 50, -1500], [s[0] - 50, 1500], [0, 0], [s[1], s[1]], 100, col(s[2])); });
    var hm = hill.mesh(lam()); hm.receiveShadow = true; scene.add(hm);
    // trail ramps up the escarpment
    var ramp = new Geo(); ramp.seg([950, 260], [1290, 330], [0, 32], [0.3, 32.3], 6, col('#c9b98f')); scene.add(ramp.mesh(lam()));
  }

  // ---------------------------------------------------------------- walk graph from OSM ways (shared nodes connect), bridges lifted
  var nodes = [], nodeGrid = {}, fields = {};
  function nkey(x, z) { return Math.round(x * 2) + ',' + Math.round(z * 2); }
  function buildGraph() {
    var map = {};
    function nid(q) { var k = nkey(q[0], q[1]); if (map[k] === undefined) { map[k] = nodes.length; nodes.push({ x: q[0], z: q[1], y: 0, adj: [] }); } return map[k]; }
    M.roads.forEach(function (r) {
      r.ids = r.p.map(nid);
      for (var i = 0; i < r.ids.length - 1; i++) {
        var a = nodes[r.ids[i]], b = nodes[r.ids[i + 1]], L = Math.hypot(a.x - b.x, a.z - b.z), w = r.k === 'primary' || r.k === 'secondary' ? 1 : r.k === 'footway' || r.k === 'cycleway' || r.k === 'path' ? 0.9 : 1.05;
        a.adj.push({ n: r.ids[i + 1], L: L * w }); b.adj.push({ n: r.ids[i], L: L * w });
      }
      if (r.br) r.ids.forEach(function (i) { nodes[i].y = DECK; nodes[i].br = 1; });
    });
    nodes.forEach(function (n, i) { var k = Math.floor(n.x / 50) + ',' + Math.floor(n.z / 50); (nodeGrid[k] = nodeGrid[k] || []).push(i); });
    // elevated segments (bridge decks + their ramps) for groundY
    M.roads.forEach(function (r) {
      var w = roadW(r.k) + 2;
      for (var i = 0; i < r.ids.length - 1; i++) { var a = nodes[r.ids[i]], b = nodes[r.ids[i + 1]]; if (a.y > 0 || b.y > 0) elev.push({ a: a, b: b, w: w, br: r.br }); }
    });
    M.landmarks.forEach(function (l) { l.node = nearestNode(l.p[0], l.p[1], null); field(l.id); });
  }
  function nearestNode(x, z, f) {
    var best = -1, bd = 1e18, gx = Math.floor(x / 50), gz = Math.floor(z / 50);
    for (var r = 1; r < 40 && best < 0; r += 2) for (var i = gx - r; i <= gx + r; i++) for (var j = gz - r; j <= gz + r; j++) (nodeGrid[i + ',' + j] || []).forEach(function (n) {
      if (f && !isFinite(f.dist[n])) return; var d = (nodes[n].x - x) * (nodes[n].x - x) + (nodes[n].z - z) * (nodes[n].z - z); if (d < bd) { bd = d; best = n; } });
    return best;
  }
  function field(id) {     // Dijkstra from the landmark: every node knows its next step home
    if (fields[id]) return fields[id];
    var lm = M.landmarks.filter(function (l) { return l.id === id; })[0], N = nodes.length;
    var dist = new Float64Array(N).fill(Infinity), next = new Int32Array(N).fill(-1), heap = [[0, lm.node]]; dist[lm.node] = 0;
    function push(e) { heap.push(e); var i = heap.length - 1; while (i) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } } return top; }
    while (heap.length) { var e = pop(), u = e[1]; if (e[0] > dist[u]) continue; nodes[u].adj.forEach(function (a) { var d = dist[u] + a.L; if (d < dist[a.n]) { dist[a.n] = d; next[a.n] = u; push([d, a.n]); } }); }
    return (fields[id] = { dist: dist, next: next, node: lm.node, lm: lm });
  }
  function segDist(px, pz, a, b) { var dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, t = clamp(((px - a.x) * dx + (pz - a.z) * dz) / L2, 0, 1); return [Math.hypot(px - a.x - dx * t, pz - a.z - dz * t), t]; }
  function inWater(x, z) { for (var i = 0; i < waterPolys.length; i++) if (inB(waterPolys[i].b, x, z) && pip(waterPolys[i].p, x, z)) return true; return false; }
  function groundY(x, z) {
    var y = -1e9;
    for (var i = 0; i < elev.length; i++) { var e = elev[i], r = segDist(x, z, e.a, e.b); if (r[0] < e.w / 2 + 0.5) y = Math.max(y, lerp(e.a.y, e.b.y, r[1])); }
    if (y > -1e9) return y + 0.2;
    return inWater(x, z) ? -1.3 : 0;
  }

  // ---------------------------------------------------------------- roads, sidewalks, bridges
  function roadW(k) { return { primary: 16, secondary: 13, tertiary: 11, residential: 8, unclassified: 8, primary_link: 7, secondary_link: 7, tertiary_link: 7, service: 5, footway: 2.6, cycleway: 3, path: 2.2, pedestrian: 6, steps: 2, track: 3 }[k] || 4; }
  function buildRoads() {
    var side = new Geo(), road = new Geo(), paths = new Geo(), deck = new Geo(), lines = new Geo();
    var cSide = col('#cfcac0'), cRoad = col('#4a4d55'), cPath = col('#d9c9a2'), cDeck = col('#8b8f98'), cLine = col('#f0d36a'), cRust = col('#9a4b2e');
    M.roads.forEach(function (r) {
      var w = roadW(r.k), major = /primary|secondary|tertiary|residential|unclassified/.test(r.k), foot = /footway|cycleway|path|steps|track|pedestrian/.test(r.k);
      var pts = r.ids.map(function (i) { return [nodes[i].x, nodes[i].y, nodes[i].z]; });
      if (r.br) {    // deck volume + railings
        for (var i = 0; i < r.ids.length - 1; i++) {
          var a = nodes[r.ids[i]], b = nodes[r.ids[i + 1]];
          deck.seg([a.x, a.z], [b.x, b.z], [a.y - 1.4, b.y - 1.4], [a.y + 0.15, b.y + 0.15], w + 2, r.cpr ? cRust : cDeck);
          var dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), nx = -dz / L * (w / 2 + 0.8), nz = dx / L * (w / 2 + 0.8);
          [-1, 1].forEach(function (s) {
            deck.seg([a.x + nx * s, a.z + nz * s], [b.x + nx * s, b.z + nz * s], [a.y + 0.1, b.y + 0.1], [a.y + 1.2, b.y + 1.2], 0.3, r.cpr ? cRust : cDeck);
            if (r.cpr) {   // steel truss: top chords + posts + diagonals
              deck.seg([a.x + nx * s, a.z + nz * s], [b.x + nx * s, b.z + nz * s], [a.y + 6.5, b.y + 6.5], [a.y + 7, b.y + 7], 0.5, cRust);
              for (var t = 0; t <= L; t += 11) {
                var px = a.x + dx * t / L + nx * s, pz = a.z + dz * t / L + nz * s, t2 = Math.min(L, t + 11), qx = a.x + dx * t2 / L + nx * s, qz = a.z + dz * t2 / L + nz * s;
                deck.seg([px - dx / L * 0.25, pz - dz / L * 0.25], [px + dx / L * 0.25, pz + dz / L * 0.25], [a.y, a.y], [a.y + 7, a.y + 7], 0.5, cRust);
                if (t2 > t) deck.seg([px, pz], [qx, qz], [a.y + 0.2, a.y + 6.8], [a.y + 0.6, a.y + 7.2], 0.3, cRust);
              }
            }
          });
        }
        return;
      }
      if (foot) paths.ribbon(pts.map(function (p) { return [p[0], p[1] + 0.2, p[2]]; }), w, cPath, true);
      else {
        if (major) side.ribbon(pts.map(function (p) { return [p[0], p[1] + 0.14, p[2]]; }), w + 6, cSide, true);
        road.ribbon(pts.map(function (p) { return [p[0], p[1] + 0.17, p[2]]; }), w, cRoad, true);
        if (r.k === 'primary' || r.k === 'secondary') lines.ribbon(pts.map(function (p) { return [p[0], p[1] + 0.19, p[2]]; }), 0.35, cLine, false);
      }
    });
    [side, road, paths, lines].forEach(function (g) { var m = g.mesh(lam()); m.receiveShadow = true; scene.add(m); });
    var dm = deck.mesh(lam()); dm.castShadow = dm.receiveShadow = true; scene.add(dm);
  }

  // ---------------------------------------------------------------- water volumes
  var waterMat;
  function buildWater() {
    waterMat = new THREE.MeshPhongMaterial({ color: 0x2f7fb8, transparent: true, opacity: 0.72, shininess: 90, specular: 0x99ccff, depthWrite: false });
    var bed = new THREE.MeshLambertMaterial({ color: 0x23404f });
    M.water.forEach(function (w) {
      if (w.seg || w.p.length < 4) return;
      waterPolys.push({ p: w.p, b: bbox(w.p) });
      scene.add(flatShape(w.p, 0.04, null, bed));
      var g = new THREE.ExtrudeGeometry(shapeOf(w.p), { depth: 1.6, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, WATER_Y - 1.6, 0);
      var m = new THREE.Mesh(g, waterMat); m.renderOrder = 2; scene.add(m);
    });
    var creek = new Geo(), ck = col('#2f7fb8');
    M.rivers.forEach(function (r) { if (r.k !== 'river') creek.ribbon(r.p.map(function (q) { return [q[0], 0.3, q[1]]; }), 7, ck, true); });
    var cm = creek.mesh(new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })); cm.renderOrder = 2; scene.add(cm);
  }

  // ---------------------------------------------------------------- buildings: footprint + height + anchors -> merged meshes with window reflections
  function buildBuildings() {
    var cell = 4, floor = 3.6;
    var wallMap = canvasTex(256, 256, function (g) { g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { g.fillStyle = '#7d93ab'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); g.fillStyle = '#c9d6e4'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 5); } });
    var rmMap = canvasTex(256, 256, function (g) { g.fillStyle = 'rgb(0,235,0)'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgb(0,40,255)'; for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); });
    var emMap = canvasTex(256, 256, function (g) { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) if (hash(i * 4 + j + 3) > 0.45) { g.fillStyle = hash(i + j * 7) > 0.5 ? '#ffd88a' : '#ffefc8'; g.fillRect(i * 64 + 12, j * 64 + 14, 40, 34); } });
    [wallMap, rmMap, emMap].forEach(function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / (cell * 4), 1 / (floor * 4)); });
    wallMap.encoding = emMap.encoding = THREE.sRGBEncoding;
    wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: wallMap, roughnessMap: rmMap, metalnessMap: rmMap, roughness: 1, metalness: 1, envMap: envTex, envMapIntensity: 1, emissive: 0xffffff, emissiveMap: emMap, emissiveIntensity: 0 });
    roofMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var W = { p: [], n: [], u: [], c: [] }, R = new Geo(), doors = new Geo(), stairs = new Geo();
    var pal = { brick: ['#b5654a', '#a85a42', '#c27a5c'], tan: ['#d8c3a0', '#e6dccb', '#cdb894'], grey: ['#9aa3ad', '#b4bcc4', '#8a929c'], glass: ['#8fb3c9', '#a3c4d6'], house: ['#e9e1cf', '#c9d9c5', '#e2c9b5', '#bcc9da'] };
    M.buildings.forEach(function (b, idx) {
      var p = b.p.slice(); if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
      if (p.length < 3) return;
      var v2 = p.map(function (q) { return new THREE.Vector2(q[0], -q[1]); }); if (THREE.ShapeUtils.isClockWise(v2)) { p.reverse(); v2.reverse(); }
      var area = Math.abs(THREE.ShapeUtils.area(v2)), cx = 0, cz = 0; p.forEach(function (q) { cx += q[0]; cz += q[1]; }); cx /= p.length; cz /= p.length;
      var r = hash(idx + 1), t = b.b, h, kind;
      if (b.h) h = b.h; else if (b.lv) h = b.lv * floor + 0.8;
      else if (/house|detached|semidetached|residential|terrace|bungalow/.test(t)) h = 6 + r * 3;
      else if (/garage|shed|roof|carport|kiosk|hut/.test(t)) h = 3 + r;
      else if (/church|cathedral/.test(t)) h = 14;
      else if (/apartments|hotel|dormitory/.test(t)) h = 12 + r * 14;
      else if (/office|commercial|retail|civic|public|government|college|university|school/.test(t)) h = 8 + r * 10 + (area > 3000 ? 10 : 0);
      else h = area > 4000 ? 12 + r * 18 : area > 900 ? 7 + r * 9 : 4 + r * 4;
      if (cx > 250 && cx < 850 && Math.abs(cz) < 300 && h < 7) h += 4;    // downtown core blocks read taller
      kind = /house|detached|semidetached|residential|terrace|bungalow/.test(t) ? 'house' : h > 22 ? 'glass' : h > 12 ? 'grey' : r < 0.45 ? 'brick' : 'tan';
      var cl = col(pal[kind][Math.floor(hash(idx + 9) * pal[kind].length)]);
      var g = new THREE.ExtrudeGeometry(new THREE.Shape(v2), { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
      var pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
      g.groups.forEach(function (gr) {
        for (var i = gr.start; i < gr.start + gr.count; i += 3) {
          if (gr.materialIndex === 0) {   // caps: keep the roof only
            if (pos.getY(i) < 0.1) continue;
            R.t([pos.getX(i), h, pos.getZ(i)], [pos.getX(i + 1), h, pos.getZ(i + 1)], [pos.getX(i + 2), h, pos.getZ(i + 2)], col('#6d6f73').lerp(cl, 0.25));
          } else for (var k = 0; k < 3; k++) { W.p.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)); W.n.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k)); W.u.push(uv.getX(i + k), uv.getY(i + k)); W.c.push(cl.r, cl.g, cl.b); }
        }
      });
      g.dispose();
      // anchors: roof, doors (two longest edges, facing out), stairs (first corner, inside)
      var edges = p.map(function (q, i) { var n = p[(i + 1) % p.length]; return { a: q, b: n, L: Math.hypot(n[0] - q[0], n[1] - q[1]) }; }).sort(function (x, y) { return y.L - x.L; });
      var drs = edges.slice(0, area > 150 ? 2 : 1).map(function (e) {
        var mx = (e.a[0] + e.b[0]) / 2, mz = (e.a[1] + e.b[1]) / 2, nx = -(e.b[1] - e.a[1]) / e.L, nz = (e.b[0] - e.a[0]) / e.L;
        if (pip(p, mx + nx, mz + nz)) { nx = -nx; nz = -nz; }
        return { x: mx + nx * 0.4, y: 0, z: mz + nz * 0.4, nx: nx, nz: nz, ex: (e.b[0] - e.a[0]) / e.L, ez: (e.b[1] - e.a[1]) / e.L };
      });
      var c0 = p[0], st = { x: lerp(c0[0], cx, Math.min(0.5, 2 / Math.hypot(c0[0] - cx, c0[1] - cz))), z: lerp(c0[1], cz, Math.min(0.5, 2 / Math.hypot(c0[0] - cx, c0[1] - cz))), y0: 0, y1: h };
      var shop = !!b.a || /retail|commercial/.test(t);
      drs.forEach(function (d) { if (area < 60) return; var w = shop ? 2.4 : 1.4; doors.seg([d.x - d.ex * w / 2, d.z - d.ez * w / 2], [d.x + d.ex * w / 2, d.z + d.ez * w / 2], [0, 0], [2.6, 2.6], 0.25, col(shop ? '#ffb23f' : '#6b4a33')); });
      if (h > 10) stairs.seg([st.x - 0.8, st.z], [st.x + 0.8, st.z], [h, h], [h + 2.6, h + 2.6], 1.6, col('#7c7f86'));   // roof stair hut
      var rec = { id: 'b' + idx, osm: { type: t, name: b.n, use: b.a }, footprint: p, height: +h.toFixed(1), floors: Math.max(1, Math.round(h / floor)), kind: kind, shop: shop,
        anchors: { roof: { x: +cx.toFixed(1), y: +h.toFixed(1), z: +cz.toFixed(1) }, doors: drs.map(function (d) { return { x: +d.x.toFixed(1), y: 0, z: +d.z.toFixed(1), facing: [+d.nx.toFixed(2), +d.nz.toFixed(2)] }; }), stairs: { x: +st.x.toFixed(1), z: +st.z.toFixed(1), from: 0, to: +h.toFixed(1) } },
        skin: 'present' };
      LAYOUT.buildings.push(rec); buildingIdx.push({ p: p, b: bbox(p), h: h });
    });
    var wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(W.p, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(W.n, 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute(W.u, 2)); wg.setAttribute('color', new THREE.Float32BufferAttribute(W.c, 3));
    var wm = new THREE.Mesh(wg, wallMat); wm.castShadow = wm.receiveShadow = true; scene.add(wm);
    var rm = R.mesh(roofMat); rm.castShadow = rm.receiveShadow = true; scene.add(rm);
    var dm = doors.mesh(lam()); scene.add(dm); var sm = stairs.mesh(lam()); sm.castShadow = true; scene.add(sm);
  }
  function inBuilding(x, z) { for (var i = 0; i < buildingIdx.length; i++) if (inB(buildingIdx[i].b, x, z) && pip(buildingIdx[i].p, x, z)) return true; return false; }

  // ---------------------------------------------------------------- trees: stem + crossed planes, instanced
  var treeMeshes = [];
  function buildTrees() {
    var spots = [], tries = 0, max = 2600;
    function ok(x, z) { return !inWater(x, z) && !inBuilding(x, z) && nearRoad(x, z) > 3; }
    M.parks.forEach(function (p) {
      if (p.seg || p.p.length < 4) return; var b = bbox(p.p), area = (b[2] - b[0]) * (b[3] - b[1]), n = Math.min(260, area / (p.k === 'forest' || p.k === 'wood' ? 140 : 420));
      for (var i = 0; i < n * 2 && spots.length < max; i++) { var x = lerp(b[0], b[2], rnd()), z = lerp(b[1], b[3], rnd()); if (pip(p.p, x, z) && ok(x, z)) spots.push([x, z]); }
    });
    waterPolys.forEach(function (w) { w.p.forEach(function (q, i) { if (i % 2) return; for (var k = 0; k < 2; k++) { var x = q[0] + (rnd() - 0.5) * 50, z = q[1] + (rnd() - 0.5) * 50; if (Math.abs(x) < 1000 && Math.abs(z) < 560 && ok(x, z)) spots.push([x, z]); } }); });
    M.roads.forEach(function (r) { if (r.k !== 'residential') return; r.p.forEach(function (q, i) { var x = q[0] + 9 * (i % 2 ? 1 : -1), z = q[1] + 4; if (ok(x, z)) spots.push([x, z]); }); });
    var crownTex = canvasTex(128, 128, function (g) { for (var i = 0; i < 70; i++) { var a = rnd() * 6.28, r = Math.sqrt(rnd()) * 46, x = 64 + Math.cos(a) * r, y = 60 + Math.sin(a) * r * 1.05; g.fillStyle = ['#3f7a34', '#4f8f3c', '#5ea545', '#3a6b2f'][i % 4]; g.beginPath(); g.arc(x, y, 9 + rnd() * 10, 0, 6.3); g.fill(); } });
    var crown = new THREE.BufferGeometry(), P = [], U = [];
    [0, 1.047, 2.094].forEach(function (a) { var cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
      P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 0, -cz, cx, 1, cz, -cx, 1, -cz); U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); });
    crown.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); crown.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); crown.computeVertexNormals();
    var stem = new THREE.CylinderGeometry(0.25, 0.4, 1, 5); stem.translate(0, 0.5, 0);
    var cm = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ map: crownTex, alphaTest: 0.5, side: THREE.DoubleSide }), spots.length);
    var sm = new THREE.InstancedMesh(stem, new THREE.MeshLambertMaterial({ color: 0x6b4a2f }), spots.length);
    var o = new THREE.Object3D(), c = new THREE.Color();
    spots.forEach(function (s, i) {
      var h = 5 + rnd() * 9, w = h * (0.7 + rnd() * 0.4);
      o.position.set(s[0], 0, s[1]); o.rotation.set(0, rnd() * 3, 0); o.scale.set(1, h * 0.45, 1); o.updateMatrix(); sm.setMatrixAt(i, o.matrix);
      o.position.y = h * 0.3; o.scale.set(w, h * 0.8, w); o.updateMatrix(); cm.setMatrixAt(i, o.matrix);
      c.setHSL(0.25 + rnd() * 0.08, 0.4 + rnd() * 0.2, 0.75 + rnd() * 0.25); cm.setColorAt(i, c);
    });
    cm.castShadow = true; scene.add(cm); scene.add(sm); treeMeshes = [cm, sm]; S.trees = spots.length;
  }
  function nearRoad(x, z) { var b = 1e9; for (var i = 0; i < M.roads.length; i += 1) { var r = M.roads[i]; if (!/primary|secondary|tertiary|residential/.test(r.k)) continue; for (var j = 0; j < r.p.length - 1; j++) { var a = r.p[j], c = r.p[j + 1]; if (Math.abs(a[0] - x) > 80 && Math.abs(c[0] - x) > 80) continue; var d = segDist(x, z, { x: a[0], z: a[1] }, { x: c[0], z: c[1] })[0] - roadW(r.k) / 2 - 3; if (d < b) b = d; } } return b; }

  // ---------------------------------------------------------------- Ghost Collection statues: glowing collectibles
  var glowTex;
  function buildStatues() {
    glowTex = canvasTex(64, 64, function (g) { var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.4, 'rgba(255,210,90,.5)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    var ped = new THREE.CylinderGeometry(1.1, 1.3, 1.2, 8), fig = new THREE.CylinderGeometry(0.5, 0.7, 2.4, 6), gem = new THREE.OctahedronGeometry(0.9);
    var bronze = new THREE.MeshStandardMaterial({ color: 0x9a6b3a, metalness: 0.8, roughness: 0.35, envMap: envTex });
    M.statues.forEach(function (s) {
      if (s.n === 'Hazel Braithwaite Statue') return;
      var g = new THREE.Group(); g.position.set(s.p[0], 0, s.p[1]);
      var a = new THREE.Mesh(ped, new THREE.MeshLambertMaterial({ color: 0x8a8a86 })); a.position.y = 0.6; g.add(a);
      var b = new THREE.Mesh(fig, bronze); b.position.y = 2.4; g.add(b);
      var gm = new THREE.Mesh(gem, new THREE.MeshBasicMaterial({ color: 0xffd23f })); gm.position.y = 6; g.add(gm);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(9, 9, 1); sp.position.y = 6; g.add(sp);
      scene.add(g); statues.push({ n: s.n, x: s.p[0], z: s.p[1], g: g, gem: gm, glow: sp, found: false, label: mkLabel('st') });
    });
  }

  // ---------------------------------------------------------------- cars: instanced boxes with headlights + beams
  var carMesh = {};
  function buildCars() {
    var routes = M.roads.filter(function (r) { return /primary|secondary|tertiary/.test(r.k) && r.p.length > 1; }).map(function (r) {
      var pts = r.ids.map(function (i) { return nodes[i]; }), L = 0, cum = [0]; for (var i = 1; i < pts.length; i++) { L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); cum.push(L); }
      return { pts: pts, cum: cum, L: L, w: roadW(r.k) };
    }).filter(function (r) { return r.L > 90; });
    var N = Math.min(46, routes.length * 2);
    var body = new THREE.BoxGeometry(2, 1.3, 4.4); body.translate(0, 0.95, 0);
    var cab = new THREE.BoxGeometry(1.8, 0.9, 2.2); cab.translate(0, 2.0, -0.3);
    var lights = new THREE.BoxGeometry(1.7, 0.3, 0.12); lights.translate(0, 1.05, 2.22);
    var beam = new THREE.PlaneGeometry(5, 14); beam.rotateX(-Math.PI / 2); beam.translate(0, 0.35, 9.2);
    var beamTex = canvasTex(32, 64, function (g) { var gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(255,240,200,.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(12, 64); g.lineTo(20, 64); g.lineTo(32, 0); g.lineTo(0, 0); g.fill(); });
    carMesh.body = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial(), N);
    carMesh.cab = new THREE.InstancedMesh(cab, new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.9, roughness: 0.2, envMap: envTex }), N);
    carMesh.light = new THREE.InstancedMesh(lights, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), N);
    carMesh.beam = new THREE.InstancedMesh(beam, new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), N);
    carMesh.body.castShadow = true;
    var cc = ['#e84a4a', '#f4f4f4', '#2f6fd8', '#ffd23f', '#3a3a3a', '#9aa3ad', '#5fe08a', '#b55a2e'];
    for (var i = 0; i < N; i++) { var r = routes[i % routes.length]; cars.push({ r: r, s: rnd() * r.L, dir: rnd() < 0.5 ? 1 : -1, v: 9 + rnd() * 6 }); carMesh.body.setColorAt(i, col(cc[i % cc.length])); }
    ['body', 'cab', 'light', 'beam'].forEach(function (k) { carMesh[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(carMesh[k]); });
  }
  var _o = new THREE.Object3D();
  function stepCars(dt) {
    cars.forEach(function (c, i) {
      c.s += c.v * c.dir * dt; if (c.s > c.r.L) { c.s = c.r.L; c.dir = -1; } if (c.s < 0) { c.s = 0; c.dir = 1; }
      var cum = c.r.cum, k = 1; while (k < cum.length - 1 && cum[k] < c.s) k++;
      var a = c.r.pts[k - 1], b = c.r.pts[k], t = (c.s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1), dx = (b.x - a.x) * c.dir, dz = (b.z - a.z) * c.dir, L = Math.hypot(dx, dz) || 1;
      var off = c.r.w * 0.25, x = lerp(a.x, b.x, t) - dz / L * off, z = lerp(a.z, b.z, t) + dx / L * off;
      _o.position.set(x, lerp(a.y, b.y, t) + 0.17, z); _o.rotation.set(0, Math.atan2(dx, dz), 0); _o.scale.set(1, 1, 1); _o.updateMatrix();
      ['body', 'cab', 'light', 'beam'].forEach(function (m) { carMesh[m].setMatrixAt(i, _o.matrix); });
    });
    ['body', 'cab', 'light', 'beam'].forEach(function (m) { carMesh[m].instanceMatrix.needsUpdate = true; });
  }

  // ---------------------------------------------------------------- destination beacon
  var beacon;
  function buildBeacon() {
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 120, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beacon.position.y = 60; scene.add(beacon);
  }

  // ---------------------------------------------------------------- heroes
  var heroGeo, visorGeo, bunnyGeo, earGeo;
  function spawnHeroes() {
    heroGeo = new THREE.BoxGeometry(4.4, 6.4, 1.4); heroGeo.translate(0, 3.2, 0);
    visorGeo = new THREE.BoxGeometry(2.8, 1, 0.3); visorGeo.translate(0, 5, 0.75);
    var start = field('cityhall').lm.p;
    var n = Math.min(C.heroes.length, +(Q.get('heroes') || 7));
    for (var i = 0; i < n; i++) addHero(i, start[0] + (i % 4) * 5 - 8, start[1] + Math.floor(i / 4) * 5);
  }
  function addHero(i, x, z) {
    var def = C.heroes[i % C.heroes.length], extra = i >= C.heroes.length;
    var color = extra ? col(def.color).offsetHSL(rnd() * 0.3, 0, 0) : col(def.color);
    var g = new THREE.Group(), body = new THREE.Mesh(heroGeo, new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.15 }));
    body.castShadow = true; g.add(body); var vis = new THREE.Mesh(visorGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); g.add(vis);
    var ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 20), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    g.rotation.order = 'YXZ'; g.position.set(x, 0, z); g.scale.setScalar(0.5); scene.add(g);   // v0.2: heroes at half size
    var h = { i: heroes.length, name: def.name + (extra ? ' ' + (i + 1) : ''), role: def.role, color: '#' + color.getHexString(), g: g, body: body, x: x, z: z, y: 0, vx: 0, vz: 0, yaw: 0, roll: 0, pitch: 0,
      hp: 100, dead: false, node: -1, fid: null, lane: (rnd() - 0.5) * 7, atkT: 0, lean: 0, ko: 0, stars: 0, player: null, wander: [0, 0], wT: 0, label: mkLabel(''), bub: null, bubT: 0, rag: null, extra: extra };
    heroes.push(h); return h;
  }
  function centroid(list) { var x = 0, z = 0, n = 0; list.forEach(function (h) { if (!h.dead) { x += h.x; z += h.z; n++; } }); return n ? [x / n, z / n, n] : [heroes[0].x, heroes[0].z, 0]; }
  function nearestBunny(x, z, r) { var b = null, bd = r * r; bunnies.forEach(function (u) { if (u.dead) return; var d = (u.x - x) * (u.x - x) + (u.z - z) * (u.z - z); if (d < bd) { bd = d; b = u; } }); return b; }

  function stepHeroes(dt) {
    var f = S.dest ? field(S.dest) : null, cen = centroid(heroes), huddle = S.huddle.active, nArr = 0, alive = 0;
    heroes.forEach(function (h, idx) {
      if (h.dead) { stepRagdoll(h, dt); return; }
      alive++;
      var tx = h.x, tz = h.z, speed = 11, enemy = nearestBunny(h.x, h.z, huddle ? 12 : 32), attacking = false;
      var fr = FR.state === 'rampage' && Math.hypot(FR.x - h.x, FR.z - h.z) < 110 ? FR : null;
      if (fr && (!enemy || Math.hypot(enemy.x - h.x, enemy.z - h.z) > 8)) enemy = fr;
      if (enemy) {
        var d = Math.hypot(enemy.x - h.x, enemy.z - h.z) - (enemy === FR ? FR.r : 0);
        if (d > 3) { tx = enemy.x; tz = enemy.z; speed = 13; } else { tx = h.x; tz = h.z; attacking = true; }
        h.yawT = Math.atan2(enemy.x - h.x, enemy.z - h.z); h.node = -1;
        h.atkT -= dt; if (attacking && h.atkT <= 0) { h.atkT = 0.55; h.lean = 1; if (enemy === FR) hitFrancis(9 + rnd() * 6, h); else hitBunny(enemy, 9 + rnd() * 6, h); }
      } else if (huddle) {
        var a = idx / heroes.length * 6.283; tx = cen[0] + Math.cos(a) * 7; tz = cen[1] + Math.sin(a) * 7; speed = 8; h.yawT = Math.atan2(cen[0] - h.x, cen[1] - h.z);
      } else if (f) {
        if (h.fid !== S.dest || h.node < 0) { h.fid = S.dest; h.node = nearestNode(h.x, h.z, f); h.arr = false; }
        var n = nodes[h.node];
        if (h.node === f.node || h.arr) {
          h.arr = true; h.wT -= dt; if (h.wT <= 0) { h.wT = 3 + rnd() * 4; var a2 = rnd() * 6.283, rr = 6 + rnd() * 16; h.wander = [f.lm.p[0] + Math.cos(a2) * rr, f.lm.p[1] + Math.sin(a2) * rr]; }
          tx = h.wander[0]; tz = h.wander[1]; speed = 5;
        } else {
          var nx = nodes[f.next[h.node]] || n, dx = nx.x - n.x, dz = nx.z - n.z, L = Math.hypot(dx, dz) || 1;
          tx = n.x - dz / L * h.lane * 0.5; tz = n.z + dx / L * h.lane * 0.5;
          if (Math.hypot(n.x - h.x, n.z - h.z) < 6) h.node = f.next[h.node] >= 0 ? f.next[h.node] : h.node;
        }
      }
      if (h.arr) nArr++;
      // separation
      heroes.forEach(function (o) { if (o === h || o.dead) return; var dx = h.x - o.x, dz = h.z - o.z, d2 = dx * dx + dz * dz; if (d2 < 6 && d2 > 0.01) { var d = Math.sqrt(d2); tx += dx / d * 2; tz += dz / d * 2; } });
      var dx2 = tx - h.x, dz2 = tz - h.z, dist = Math.hypot(dx2, dz2), want = dist > 0.6 ? Math.min(speed, dist * 2) : 0;
      var dvx = (dist ? dx2 / dist : 0) * want, dvz = (dist ? dz2 / dist : 0) * want;
      var ax = (dvx - h.vx) * Math.min(1, dt * 4), az = (dvz - h.vz) * Math.min(1, dt * 4);
      h.vx += ax; h.vz += az;
      var sp = Math.hypot(h.vx, h.vz);
      if (sp > 1) h.yawT = h.yawT !== undefined && (enemy || huddle) ? h.yawT : Math.atan2(h.vx, h.vz);
      var wade = h.y < -0.5 ? 0.55 : 1;
      h.x += h.vx * dt * wade; h.z += h.vz * dt * wade;
      h.y = lerp(h.y, groundY(h.x, h.z), Math.min(1, dt * 8));
      var dyaw = (((h.yawT || 0) - h.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; h.yaw += dyaw * Math.min(1, dt * 6);
      // slide tilt: lean into acceleration sideways (roll) + forward with speed; attack lunges forward
      var fwdx = Math.sin(h.yaw), fwdz = Math.cos(h.yaw), latA = (ax * fwdz - az * fwdx) / Math.max(dt, 1e-3);
      h.roll = lerp(h.roll, clamp(-latA * 0.02, -0.35, 0.35) + clamp(-dyaw * 0.4, -0.3, 0.3), Math.min(1, dt * 6));
      h.lean = Math.max(0, h.lean - dt * 3.5);
      h.pitch = lerp(h.pitch, clamp(sp * 0.018, 0, 0.25) + Math.sin(h.lean * Math.PI) * 0.6, Math.min(1, dt * 12));
      if (!enemy) h.hp = Math.min(100, h.hp + dt * 5);
      h.g.position.set(h.x, h.y + Math.abs(Math.sin(S.t * 9 + idx)) * Math.min(1, sp / 8) * 0.5, h.z); h.g.rotation.set(h.pitch, h.yaw, h.roll);
      // collect statues
      statues.forEach(function (s) { if (!s.found && Math.hypot(s.x - h.x, s.z - h.z) < 10) { s.found = true; S.stars++; h.stars++; if (h.player) h.player.stars++; toast('\u2B50 ' + h.name + ' found ' + s.n + '!'); s.gem.material.color.set(0x7ad9ff); } });
    });
    if (f && !S.arrived && nArr >= Math.max(1, alive / 2)) { S.arrived = true; S.arriveT = S.t; toast('Arrived: ' + f.lm.n); }
  }
  function killHero(h, from) {
    h.dead = true; h.hp = 0; var dx = h.x - (from ? from.x : h.x - 1), dz = h.z - (from ? from.z : h.z), L = Math.hypot(dx, dz) || 1;
    h.rag = { vx: dx / L * 9, vz: dz / L * 9, vy: 9, wp: -5 - rnd() * 3, wr: (rnd() - 0.5) * 6, t: 0 };
    h.yaw = Math.atan2(-dx, -dz);   // face the attacker, fall backwards
    toast('\uD83D\uDCA5 ' + h.name + ' is down!');
  }
  function stepRagdoll(h, dt) {
    var r = h.rag; r.t += dt;
    r.vy -= 30 * dt; h.x += r.vx * dt; h.z += r.vz * dt; h.y += r.vy * dt; r.vx *= 0.985; r.vz *= 0.985;
    h.pitch += r.wp * dt; h.roll += r.wr * dt;
    var gy = groundY(h.x, h.z);
    if (h.y < gy) { h.y = gy; r.vy = Math.abs(r.vy) * 0.3; r.vx *= 0.6; r.vz *= 0.6; r.wp *= 0.5; r.wr *= 0.4; if (h.pitch < -1.45) { h.pitch = -1.5; r.wp = 0; } }
    h.pitch = Math.max(h.pitch, -1.57);
    h.g.position.set(h.x, h.y + (h.pitch < -1 ? 0.55 : 0), h.z); h.g.rotation.set(h.pitch, h.yaw, h.roll);
    if (r.t > 7) {   // v0.2: back in somewhere in the city
      var rn = cityNode(); h.dead = false; h.hp = 100; h.x = rn.x + rnd() * 6 - 3; h.z = rn.z + rnd() * 6 - 3; if (h.player) toast('\u2728 ' + h.name + ' is back in the city'); h.y = 12; h.pitch = h.roll = 0; h.node = -1; h.rag = null;
    }
  }

  // ---------------------------------------------------------------- mutant bunnies (spawn in parks)
  var spawnT = 3;
  function stepBunnies(dt) {
    var cen = centroid(heroes), cap = Math.min(70, 6 + 3 * cen[2]) * (S.night > 0.5 ? 1.5 : 1) * (S.huddle.active ? 0.4 : 1);
    spawnT -= dt;
    if (spawnT <= 0 && bunnies.filter(function (b) { return !b.dead; }).length < cap) {
      spawnT = 5 + rnd() * 5;
      var parks = M.parks.filter(function (p) { if (p.seg || p.p.length < 4) return false; var b = bbox(p.p), cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, d = Math.hypot(cx - cen[0], cz - cen[1]); return d > 40 && d < 260; });
      var p = parks.length ? parks[Math.floor(rnd() * parks.length)] : null, n = 3 + Math.floor(rnd() * 4);
      for (var i = 0, t = 0; i < n && t < 60; t++) {
        var x, z;
        if (p) { var b = bbox(p.p); x = lerp(b[0], b[2], rnd()); z = lerp(b[1], b[3], rnd()); if (!pip(p.p, x, z) || inWater(x, z)) continue; }
        else { var a = rnd() * 6.283; x = cen[0] + Math.cos(a) * 90; z = cen[1] + Math.sin(a) * 90; }
        addBunny(x, z); i++;
      }
    }
    bunnies.forEach(function (b) {
      if (b.dead) { b.dt += dt; var s = Math.max(0.01, 1 - b.dt * 2); b.g.scale.set(1 + b.dt * 3, s, 1 + b.dt * 3); if (b.dt > 0.6) { scene.remove(b.g); b.gone = true; } return; }
      var tgt = null, td = 70; heroes.forEach(function (h) { if (h.dead) return; var d = Math.hypot(h.x - b.x, h.z - b.z); if (d < td) { td = d; tgt = h; } });
      var tx, tz, sp = 9;
      if (tgt) { tx = tgt.x; tz = tgt.z; if (td < 2.6) { sp = 0; tgt.hp -= dt * 7; if (tgt.hp <= 0) killHero(tgt, b); } }
      else { b.wT -= dt; if (b.wT < 0) { b.wT = 2 + rnd() * 3; b.wx = b.x + (rnd() - 0.5) * 30; b.wz = b.z + (rnd() - 0.5) * 30; } tx = b.wx; tz = b.wz; sp = 4; }
      var dx = tx - b.x, dz = tz - b.z, L = Math.hypot(dx, dz) || 1;
      if (sp) { b.x += dx / L * sp * dt; b.z += dz / L * sp * dt; b.yaw = Math.atan2(dx, dz); }
      b.ph += dt * (sp > 5 ? 11 : 6);
      var gy = groundY(b.x, b.z); b.g.position.set(b.x, gy + Math.abs(Math.sin(b.ph)) * 1.6, b.z); b.g.rotation.y = b.yaw;
      var sq = 1 - Math.abs(Math.sin(b.ph)) * 0.2; b.g.scale.set(1 + (1 - sq), sq, 1);
      if (b.hit > 0) { b.hit -= dt; b.mat.emissiveIntensity = b.hit * 3; }
      if (Math.hypot(b.x - cen[0], b.z - cen[1]) > 600) { b.dead = true; b.dt = 1; }
    });
    for (var i = bunnies.length - 1; i >= 0; i--) if (bunnies[i].gone) bunnies.splice(i, 1);
  }
  function addBunny(x, z) {
    if (!bunnyGeo) { bunnyGeo = new THREE.IcosahedronGeometry(1.3, 1); bunnyGeo.scale(1, 0.85, 1.25); bunnyGeo.translate(0, 1.1, 0); earGeo = new THREE.BoxGeometry(0.35, 1.5, 0.25); earGeo.translate(0, 0.75, 0); }
    var mat = new THREE.MeshLambertMaterial({ color: 0xc86bd6, emissive: 0xff3050, emissiveIntensity: 0 });
    var g = new THREE.Group(), body = new THREE.Mesh(bunnyGeo, mat); body.castShadow = true; g.add(body);
    [-0.45, 0.45].forEach(function (s) { var e = new THREE.Mesh(earGeo, mat); e.position.set(s, 1.9, 0.6); e.rotation.set(-0.3, 0, s * 0.5); g.add(e); });
    var eye = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2020 })); eye.position.set(0, 1.5, 1.55); g.add(eye);
    g.position.set(x, 0, z); scene.add(g);
    bunnies.push({ x: x, z: z, g: g, mat: mat, hp: 25, ph: rnd() * 6, yaw: 0, wT: 0, wx: x, wz: z, hit: 0, dead: false, dt: 0 });
  }
  function hitBunny(b, dmg, h) { b.hp -= dmg; b.hit = 0.25; if (b.hp <= 0 && !b.dead) { b.dead = true; b.dt = 0; S.ko++; h.ko++; if (h.player) h.player.ko++; } }


  // ---------------------------------------------------------------- v0.2 monster: Francis the bronze pig, struck by lightning
  var FR = { state: 'statue', x: 0, z: 0, hx: 0, hz: 0, hp: 0, max: 900, r: 3, sc: 1, t: 0, g: null, yaw: 0, at: +(Q.get('francis') || 140), cd: 0, ph: 0, lbl: null, bolt: null };
  function cityNode() { var c = field('cityhall').lm.p; for (var k = 0; k < 30; k++) { var n = nodes[Math.floor(rnd() * nodes.length)]; if (n && Math.hypot(n.x - c[0], n.z - c[1]) < 420 && !inWater(n.x, n.z)) return n; } return { x: c[0], z: c[1] }; }
  function buildFrancis() {
    var src = M.statues.filter(function (s) { return s.n === 'Francis the Pig'; })[0] || { p: [933, 116] };
    FR.x = FR.hx = src.p[0]; FR.z = FR.hz = src.p[1];
    var br = new THREE.MeshStandardMaterial({ color: 0xa8743c, metalness: 0.85, roughness: 0.3, envMap: envTex, emissive: 0x401800, emissiveIntensity: 0 }), g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    var body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), br); body.scale.set(1.1, 0.95, 1.7); body.position.y = 1.5; inner.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 9), br); head.position.set(0, 1.85, 1.75); inner.add(head);
    var snout = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.4, 12), br); snout.rotation.x = Math.PI / 2; snout.position.set(0, 1.7, 2.5); inner.add(snout);
    [-1, 1].forEach(function (s) { var e = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 6), br); e.position.set(s * 0.45, 2.55, 1.6); e.rotation.z = -s * 0.4; inner.add(e); });
    var legs = []; [[-0.6, 1], [0.6, 1], [-0.6, -1], [0.6, -1]].forEach(function (q) { var l = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.0, 8), br); l.position.set(q[0], 0.5, q[1]); inner.add(l); legs.push(l); });
    var eyes = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3010 })); eyes.position.set(0, 2.05, 2.42); eyes.visible = false; inner.add(eyes);
    var ped = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 4.4), new THREE.MeshLambertMaterial({ color: 0x8a8a86 })); ped.position.set(FR.x, 0.4, FR.z); scene.add(ped);
    inner.position.y = 0.8; g.position.set(FR.x, 0, FR.z); g.rotation.y = 2.2; scene.add(g); body.castShadow = true;
    FR.g = g; FR.inner = inner; FR.legs = legs; FR.mat = br; FR.eyes = eyes; FR.ped = ped; FR.lbl = mkLabel('bub'); FR.tag = mkLabel('');
    var bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 14), 3));
    FR.bolt = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0 })); FR.bolt.frustumCulled = false; scene.add(FR.bolt);
  }
  function lightning() {
    var p = FR.bolt.geometry.attributes.position; for (var i = 0; i < 14; i++) { var u = i / 13; p.setXYZ(i, FR.x + (i && i < 13 ? (rnd() - 0.5) * 14 : 0), 260 * (1 - u) + 2, FR.z + (i && i < 13 ? (rnd() - 0.5) * 14 : 0)); }
    p.needsUpdate = true; FR.bolt.material.opacity = 1; FR.flash = 0.5;
  }
  function wakeFrancis() {
    if (FR.state !== 'statue' && FR.state !== 'sleep') return; FR.state = 'grow'; FR.t = 0; FR.hp = FR.max; lightning(); FR.ped.visible = false;
    toast('\u26A1 Lightning struck Francis the Pig!');
  }
  function hitFrancis(dmg, h) { if (FR.state !== 'rampage') return; FR.hp -= dmg; FR.hit = 0.2;
    if (FR.hp <= 0) { FR.state = 'shrink'; FR.t = 0; S.stars += 3; if (h) { h.stars += 3; if (h.player) h.player.stars += 3; } toast('\uD83D\uDC37 Francis is bronze again! +3 \u2B50'); } }
  function stepFrancis(dt) {
    if (!FR.g) return; FR.t += dt; FR.cd -= dt;
    if (FR.flash > 0) { FR.flash -= dt; FR.bolt.material.opacity = Math.max(0, FR.flash * 2) * (rnd() < 0.7 ? 1 : 0.2); hemi.intensity += FR.flash * 3; }
    var cen = centroid(heroes);
    if (FR.state === 'statue' && (S.t > FR.at || Math.hypot(cen[0] - FR.x, cen[1] - FR.z) < 160)) wakeFrancis();
    if (FR.state === 'sleep' && FR.t > 150) wakeFrancis();
    if (FR.state === 'grow') { FR.sc = 1 + 9 * Math.min(1, FR.t / 2.5); FR.mat.emissiveIntensity = 1.5 * (1 - FR.t / 3); FR.eyes.visible = true;
      if (FR.t > 2.5) { FR.state = 'rampage'; FR.t = 0; FR.say = 5; FR.r = 3 * FR.sc * 0.8; toast('\uD83D\uDC37 FRANCIS IS RAMPAGING!'); } }
    if (FR.state === 'rampage') {
      var tgt = null, td = 1e9; heroes.forEach(function (h) { if (h.dead) return; var d = Math.hypot(h.x - FR.x, h.z - FR.z); if (d < td) { td = d; tgt = h; } });
      var tx = tgt ? tgt.x : FR.hx, tz = tgt ? tgt.z : FR.hz, dx = tx - FR.x, dz = tz - FR.z, L = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz);
      FR.charge = (FR.charge || 0) - dt; if (FR.charge < -4 && L < 70 && L > 20) FR.charge = 1.2;
      var sp = FR.charge > 0 ? 26 : 9; if (L > FR.r * 0.7) { FR.x += dx / L * sp * dt; FR.z += dz / L * sp * dt; }
      FR.yaw += (((want - FR.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3); FR.ph += dt * sp * 0.6;
      heroes.forEach(function (h) { if (h.dead) return; var d = Math.hypot(h.x - FR.x, h.z - FR.z); if (d < FR.r + 1.5) { h.hp -= dt * (FR.charge > 0 ? 90 : 22); if (h.hp <= 0) killHero(h, FR); } });
      if (FR.cd <= 0 && L < FR.r + 6) { FR.cd = 2.5; heroes.forEach(function (h) { if (!h.dead && Math.hypot(h.x - FR.x, h.z - FR.z) < FR.r + 9) { h.hp -= 30; if (h.hp <= 0) killHero(h, FR); } }); FR.stomp = 0.35; }
      if (FR.say > 0) FR.say -= dt; if (rnd() < dt / 25) FR.say = 4;
    }
    if (FR.state === 'shrink') { FR.sc = Math.max(1, 10 - 9 * FR.t / 2); FR.eyes.visible = FR.t < 1.5; if (FR.t > 2) { FR.state = 'sleep'; FR.t = 0; FR.x = FR.hx; FR.z = FR.hz; FR.ped.visible = true; FR.yaw = 2.2; } }
    if (FR.stomp > 0) FR.stomp -= dt;
    var bob = FR.state === 'rampage' ? Math.abs(Math.sin(FR.ph)) * 0.25 : 0;
    FR.g.position.set(FR.x, groundY(FR.x, FR.z) + bob * FR.sc, FR.z); FR.g.rotation.y = FR.state === 'rampage' ? FR.yaw : FR.g.rotation.y; FR.g.scale.setScalar(FR.sc * (FR.stomp > 0 ? 1 + FR.stomp * 0.15 : 1));
    FR.inner.position.y = FR.state === 'statue' || FR.state === 'sleep' ? 0.8 : 0;
    FR.legs.forEach(function (l, i) { l.rotation.x = FR.state === 'rampage' ? Math.sin(FR.ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0; });
    FR.mat.emissive.setHex(FR.hit > 0 ? 0xffffff : 0x401800); if (FR.hit > 0) { FR.hit -= dt; FR.mat.emissiveIntensity = 0.6; } else if (FR.state === 'rampage') FR.mat.emissiveIntensity = 0.25 + Math.sin(S.t * 5) * 0.1;
    var top = 4 * FR.sc + 2;
    if (FR.state === 'rampage' && FR.say > 0) place(FR.lbl, FR.x, top + 4, FR.z, '\uD83D\uDC37 <b>FRANCIS:</b> If you thought I was rough on the city before, just wait.'); else FR.lbl.style.display = 'none';
    if (FR.state === 'rampage') place(FR.tag, FR.x, top, FR.z, '<span style="color:#e8a860">FRANCIS</span> <span style="display:inline-block;width:8vh;height:.8vh;background:#0006;vertical-align:middle"><i style="display:block;height:100%;width:' + Math.max(0, FR.hp / FR.max * 100) + '%;background:#ff7a30"></i></span>'); else FR.tag.style.display = 'none';
  }

  // ---------------------------------------------------------------- votes + huddle
  function players() { return Object.keys(S.players).map(function (k) { return S.players[k]; }).filter(function (p) { return p.online; }); }
  function newVoteRound() {
    var pool = M.landmarks.filter(function (l) { return l.id !== S.dest; }).sort(function () { return rnd() - 0.5; });
    S.opts = pool.slice(0, 4).map(function (l) { return { id: l.id, n: l.n, ic: l.ic }; });
    S.votes = {}; S.aiVotes = {}; S.winT = 0; S.roundT = S.t;
    players().forEach(function (p) { p.vote = null; });
  }
  function tally() {
    var ps = players(), counts = {}, total;
    S.opts.forEach(function (o) { counts[o.id] = 0; });
    if (ps.length) { ps.forEach(function (p) { if (p.vote && counts[p.vote] !== undefined) counts[p.vote]++; }); total = ps.length; S.vmode = 'phones'; }
    else { Object.keys(S.aiVotes).forEach(function (k) { if (counts[S.aiVotes[k]] !== undefined) counts[S.aiVotes[k]]++; }); total = heroes.length; S.vmode = 'auto patrol'; }
    return { counts: counts, total: total, need: ps.length ? Math.max(1, Math.ceil(ps.length * 0.5)) : Math.ceil(heroes.length * 0.5) };
  }
  function stepVotes(dt) {
    var ps = players();
    if (!ps.length && (S.arrived || !S.dest) && S.t - S.arriveT > 6) {   // attract mode: the AI heroes trickle in votes
      S.aiT = (S.aiT || 0) - dt; if (S.aiT <= 0) { S.aiT = 0.7 + rnd(); var h = heroes[Math.floor(rnd() * heroes.length)]; var fav = S.opts[0].id; S.aiVotes[h.i] = rnd() < 0.55 ? fav : S.opts[Math.floor(rnd() * S.opts.length)].id; }
    }
    var t = tally(), win = null;
    S.opts.forEach(function (o) { if (t.counts[o.id] >= t.need && (!win || t.counts[o.id] > t.counts[win])) win = o.id; });
    if (win) { S.winT += dt; if (S.winT > 1.5) { setDest(win); } } else S.winT = 0;
    S.tally = t;
    // huddle
    var hv = ps.filter(function (p) { return p.huddle; }).length, sup = ps.length ? hv / ps.length : 0, H = S.huddle;
    H.support = sup; H.count = hv;
    var cen = centroid(heroes), safe = !nearestBunny(cen[0], cen[1], 45);
    if (!H.active && ps.length && sup >= 2 / 3 - 1e-6) { if (safe) { H.active = true; H.since = S.t; S.chat = []; toast('\uD83E\uDD1D Huddle! Team chat is open'); } else H.msg = 'Huddle called \u2014 clear the bunnies first!'; }
    else if (H.active && sup < 2 / 3 - 1e-6) { H.active = false; toast('Huddle broken \u2014 back to it!'); ps.forEach(function (p) { p.huddle = false; }); }
    if (H.active || !hv) H.msg = '';
  }
  function setDest(id) {
    S.dest = id; S.arrived = false; var f = field(id); beacon.position.set(f.lm.p[0], 60, f.lm.p[1]);
    heroes.forEach(function (h) { h.node = -1; h.arr = false; }); toast('\u27A1 Heading to ' + f.lm.n); newVoteRound();
  }

  // ---------------------------------------------------------------- phones
  var host;
  function setupNet() {
    var code = (Q.get('room') || '').toUpperCase() || null;
    var opts = { code: code, fixedCode: !!code, prefix: C.peerPrefix,
      onStatus: function (s, c) { $('code').textContent = c || host.code; S.net = s; },
      onMessage: onMsg, onClose: function (conn) { var p = byConn(conn); if (p) { p.online = false; p.conn = null; releaseHero(p); } } };
    host = LOCAL ? new LRNet.LocalHost(opts) : new LRNet.Host(opts);
    var c = host.code; $('code').textContent = c;
    var url = location.href.replace(/[?#].*$/, '').replace(/index\.html$/, '') + 'controller.html?room=' + c + (LOCAL ? '&local=1' : '');
    S.joinUrl = url;
    try { var qr = qrcode(0, 'M'); qr.addData(url); qr.make(); $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
    setInterval(broadcast, 250);
  }
  function byConn(conn) { for (var k in S.players) if (S.players[k].conn === conn) return S.players[k]; return null; }
  function onMsg(conn, m) {
    if (!m || !m.t) return;
    if (m.t === 'list') { host.send(conn, { t: 'roster', list: rosterList(String(m.id || '')) }); return; }
    if (m.t === 'hello') {
      var id = String(m.id || conn.connectionId).slice(0, 40), p = S.players[id];
      if (!p) p = S.players[id] = { id: id, ko: 0, stars: 0 };
      p.conn = conn; p.online = true; p.name = String(m.name || '???').slice(0, 12).toUpperCase(); p.vote = null; p.huddle = false;
      var want = m.hero != null ? heroes[+m.hero] : null; if (want && (!want.player || want.player === p)) { if (p.hero && p.hero !== want) p.hero.player = null; want.player = p; p.hero = want; } else if (!p.hero || p.hero.dead && p.hero.extra) claimHero(p); else p.hero.player = p;
      host.send(conn, { t: 'welcome', hero: { name: p.hero.name, color: p.hero.color, role: p.hero.role } });
      toast('\uD83D\uDCF1 ' + p.name + ' joined as ' + p.hero.name); return;
    }
    var pl = byConn(conn); if (!pl) return;
    if (m.t === 'vote' && S.opts.some(function (o) { return o.id === m.id; })) pl.vote = m.id;
    else if (m.t === 'huddle') pl.huddle = !!m.on;
    else if (m.t === 'chat' && S.huddle.active) { var txt = String(m.text || '').slice(0, 80); if (txt.trim()) { S.chat.push({ who: pl.name, c: pl.hero.color, text: txt }); S.chat = S.chat.slice(-7); pl.hero.bub = txt; pl.hero.bubT = 4; } }
  }
  function claimHero(p) {
    var free = heroes.filter(function (h) { return !h.player; })[0];
    if (!free) { var c = centroid(heroes); free = addHero(heroes.length, c[0], c[1]); }
    free.player = p; p.hero = free;
  }
  function rosterList(id) { var me = S.players[id]; return heroes.map(function (h) { return { i: h.i, n: h.name, r: h.role, c: h.color, use: !!(h.player && h.player.online && h.player !== me), by: h.player && h.player.online && h.player !== me ? h.player.name : '', dead: h.dead, mine: !!(me && me.hero === h) }; }); }
  function releaseHero(p) { if (p.hero) { p.hero.player = null; } }
  function broadcast() {
    var t = S.tally || tally(), H = S.huddle;
    var base = { t: 'state', opts: S.opts.map(function (o) { return { id: o.id, n: o.n, ic: o.ic, v: t.counts[o.id] || 0 }; }), total: t.total, need: t.need, dest: S.dest ? field(S.dest).lm.n : null, arrived: S.arrived,
      huddle: { active: H.active, count: H.count || 0, msg: H.msg }, chat: S.chat, ko: S.ko, stars: S.stars, statues: statues.length };
    players().forEach(function (p) { var h = p.hero; base.me = { vote: p.vote, huddle: p.huddle, hp: Math.round(h.hp), dead: h.dead, ko: p.ko, stars: p.stars, hero: h.name, color: h.color }; host.send(p.conn, base); });
  }

  // ---------------------------------------------------------------- HUD + labels
  var toastT = 0;
  function toast(s) { var e = $('toast'); e.textContent = s; e.style.opacity = 1; toastT = 3; }
  function mkLabel(cls) { var e = document.createElement('div'); e.className = 'lb ' + cls; labelsEl.appendChild(e); return e; }
  var _v = new V3();
  function place(el, x, y, z, txt) { _v.set(x, y, z).project(camera); if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px'; if (el._t !== txt) { el.innerHTML = txt; el._t = txt; } }
  var hudT = 0;
  function hud(dt) {
    toastT -= dt; if (toastT < 0) $('toast').style.opacity = 0;
    heroes.forEach(function (h) {
      var tag = (h.player ? '<span style="color:' + h.color + '">' + esc(h.player.name) + '</span> ' : '') + '<small style="opacity:.8">' + h.name + '</small>';
      place(h.label, h.x, h.y + 5, h.z, h.dead ? '\uD83D\uDCA4 ' + tag : tag);
      h.bubT -= dt;
      if (h.bubT > 0) { if (!h.bubEl) h.bubEl = mkLabel('bub'); place(h.bubEl, h.x, h.y + 6.5, h.z, esc(h.bub)); } else if (h.bubEl) h.bubEl.style.display = 'none';
    });
    var far = camDist > 520;
    statues.forEach(function (s) { if (far) s.label.style.display = 'none'; else place(s.label, s.x, 8.5, s.z, (s.found ? '\u2B50 ' : '\uD83D\uDC7B ') + esc(s.n)); });
    hudT -= dt; if (hudT > 0) return; hudT = 0.2;
    var ps = players(), t = S.tally || tally();
    var hh = Math.floor(S.tod * 24), mm = Math.floor((S.tod * 24 - hh) * 60);
    $('stats').innerHTML = '\uD83D\uDD52 ' + hh + ':' + (mm < 10 ? '0' : '') + mm + ' &nbsp; \uD83D\uDC07 ' + S.ko + ' bunnies bonked &nbsp; \u2B50 ' + S.stars + '/' + statues.length + ' Ghost statues &nbsp; \uD83D\uDCF1 ' + ps.length;
    $('qrbox').classList.toggle('small', ps.length > 0);
    $('vmode').textContent = S.vmode || '';
    var max = t.total || 1;
    $('vrows').innerHTML = S.opts.map(function (o) { var v = t.counts[o.id] || 0, w = v / max * 100, win = v >= t.need;
      return '<div class="vrow' + (win ? ' win' : '') + '"><div class="vbar" style="width:' + w + '%"></div><div class="vth" style="left:' + (t.need / max * 100) + '%"></div><div class="vlab">' + o.ic + ' ' + o.n + '</div><div class="vnum">' + v + '</div></div>'; }).join('');
    $('vstat').textContent = S.dest ? (S.arrived ? '\u2705 At ' : '\u27A1 Heading to ') + field(S.dest).lm.n : 'Pick a destination';
    var H = S.huddle;
    $('huddleBar').innerHTML = ps.length ? '\uD83E\uDD1D Huddle ' + (H.count || 0) + '/' + ps.length + ' (needs \u2154)' + (H.active ? ' <b style="color:#ffd23f">ACTIVE</b>' : '') + (H.msg ? '<br><span style="color:#ff9b6b">' + H.msg + '</span>' : '') : '';
    $('chat').style.display = H.active ? 'block' : 'none';
    $('chatlog').innerHTML = S.chat.length ? S.chat.map(function (c) { return '<div><b style="color:' + c.c + '">' + esc(c.who) + ':</b> ' + esc(c.text) + '</div>'; }).join('') : '<div style="opacity:.7">Heroes gathered. Type on your phone to talk.</div>';
    $('roster').innerHTML = heroes.map(function (h) { return '<div class="rrow"><div class="chip" style="background:' + h.color + '"></div><div class="rname">' + (h.player ? '<b>' + esc(h.player.name) + '</b> \u00b7 ' : '') + h.name + '</div><div class="hp"><i style="width:' + Math.max(0, h.hp) + '%;background:' + (h.hp < 35 ? '#ff5a4f' : '#5fe08a') + '"></i></div><div class="rsc">\uD83D\uDC07' + h.ko + ' \u2B50' + h.stars + '</div></div>'; }).join('');
    $('perf').textContent = Math.round(fpsAvg) + ' fps \u00b7 quality ' + (QUAL.length - S.quality) + '/' + QUAL.length + ' \u00b7 ' + LAYOUT.buildings.length + ' buildings \u00b7 ' + S.trees + ' trees';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------------------------------------------------------- day/night
  var cDay = col('#9fd3ff'), cDusk = col('#f2a36b'), cNight = col('#0b1026'), cTmp = new THREE.Color();
  function stepSky(dt) {
    if (!Q.get('tod')) S.tod = (S.tod + dt / S.dayLen) % 1;
    var a = (S.tod - 0.25) * Math.PI * 2, el = Math.sin(a), day = clamp((el + 0.08) / 0.35, 0, 1), dusk = clamp(1 - Math.abs(el) / 0.25, 0, 1) * (el > -0.2 ? 1 : 0);
    S.night = 1 - day;
    cTmp.copy(cNight).lerp(cDay, day).lerp(cDusk, dusk * 0.45); scene.background.copy(cTmp); scene.fog.color.copy(cTmp);
    var tgt = camTarget;
    sun.position.set(tgt.x + Math.cos(a) * 400, Math.max(60, el * 500), tgt.z + 180); sun.target.position.copy(tgt);
    sun.intensity = 0.15 + day * 0.95; sun.color.setHSL(0.1, 0.6, 0.6 + day * 0.35);
    hemi.intensity = 0.38 + day * 0.4; hemi.color.setHSL(0.6, 0.5, 0.45 + day * 0.4);
    wallMat.emissiveIntensity = S.night * 1.1; wallMat.envMapIntensity = 0.3 + day * 0.9;
    carMesh.beam.material.opacity = S.night * 0.85; carMesh.light.material.color.setHSL(0.13, 1, 0.55 + S.night * 0.4);
    statues.forEach(function (s) { s.glow.material.opacity = s.found ? 0.25 : 0.4 + S.night * 0.6; s.gem.rotation.y += dt * 2; s.gem.position.y = 6 + Math.sin(S.t * 2 + s.x) * 0.4; });
    waterMat.color.setHSL(0.57, 0.6, 0.15 + day * 0.3);
    beacon.material.opacity = S.dest && !S.arrived ? 0.12 + S.night * 0.2 : 0.04;
  }

  // ---------------------------------------------------------------- camera: 3/4 top-down, frames all heroes, widens with spread + action
  var camTarget = new V3(), camDist = 120, camDir = new V3(0, 1, 0.78).normalize();
  function stepCamera(dt) {
    var cen = centroid(heroes), spread = 0, action = 0;
    heroes.forEach(function (h) { if (!h.dead) spread = Math.max(spread, Math.hypot(h.x - cen[0], h.z - cen[1])); });
    bunnies.forEach(function (b) { if (!b.dead) { var d = Math.hypot(b.x - cen[0], b.z - cen[1]); if (d < 90) { action++; spread = Math.max(spread, Math.min(d, 70)); } } });
    var want = S.huddle.active ? 55 : clamp(spread * 2.1 + 48 + action * 1.2, 52, 520);
    if (S.overview) { want = 1650; cen = [0, 0]; }
    camDist = lerp(camDist, want, Math.min(1, dt * 1.2));
    camTarget.x = lerp(camTarget.x, cen[0], Math.min(1, dt * 2)); camTarget.z = lerp(camTarget.z, cen[1], Math.min(1, dt * 2));
    camera.position.copy(camTarget).addScaledVector(camDir, camDist); camera.lookAt(camTarget);
    scene.fog.near = camDist * 1.3; scene.fog.far = camDist * 3.5 + 600;
  }

  // ---------------------------------------------------------------- quality auto-scale
  var QUAL = [{ pr: 1.5, sh: true }, { pr: 1, sh: true }, { pr: 1, sh: false }, { pr: 0.75, sh: false }, { pr: 0.55, sh: false }];
  var fpsAvg = 60, fAcc = 0, fN = 0, fT = 0, upOk = 0, locked = false;
  function setQuality(q, lock) {
    S.quality = clamp(q, 0, QUAL.length - 1); var Ql = QUAL[S.quality]; if (lock) locked = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Ql.pr)); renderer.setSize(innerWidth, innerHeight);
    if (renderer.shadowMap.enabled !== Ql.sh) { renderer.shadowMap.enabled = Ql.sh; sun.castShadow = Ql.sh; scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
  }
  function render(now, dt) {
    fAcc += dt; fN++; fT += dt;
    if (fT > 3) { fpsAvg = fN / fAcc; fAcc = fN = 0; fT = 0;
      if (!locked && S.t > 4) { if (fpsAvg < 42 && S.quality < QUAL.length - 1) { setQuality(S.quality + 1); upOk = 0; } else if (fpsAvg > 58) { if (++upOk >= 4 && S.quality > 0) { setQuality(S.quality - 1); upOk = 0; } } else upOk = 0; } }
    renderer.render(scene, camera);
  }

  function step(dt) {
    S.t += dt;
    stepVotes(dt); stepHeroes(dt); stepBunnies(dt); stepCars(dt); stepCamera(dt); stepSky(dt); stepFrancis(dt); hud(dt);
    if (!S.dest && S.t > 2 && !players().length && !S.winT) {}
  }

  window.RESCUE = { S: S, heroes: heroes, bunnies: bunnies, statues: statues, layout: LAYOUT, nodes: nodes, setDest: setDest, toast: toast,
    setQuality: setQuality, spawnBunny: function (x, z) { addBunny(x, z); }, killHero: function (i) { killHero(heroes[i], { x: heroes[i].x + 1, z: heroes[i].z }); },
    francis: FR, wakeFrancis: function () { FR.at = 0; wakeFrancis(); }, hitFrancis: hitFrancis,
    field: field, groundY: groundY, landmarks: function () { return M.landmarks; } };
})();
