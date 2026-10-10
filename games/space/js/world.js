/* DRIFT SIGNAL - the 3D world: simple geometry, layered additive glow. SWorld.build(T, scene, fx) returns handles. */
(function (root) {
  'use strict';
  var C = root.SPACE_CONFIG;
  function canvasTex(T, w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.needsUpdate = true; return t; }
  function glowTex(T) { return canvasTex(T, 128, 128, function (g, w) { var r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,.55)'); r.addColorStop(0.5, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }); }
  // seeded value noise (for planets, clouds, nebula puffs)
  function noise2(seed) {
    var R = C.rng(seed), P = new Float32Array(256 * 256); for (var i = 0; i < P.length; i++) P[i] = R();
    function v(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
      var a = P[(xi & 255) + ((yi & 255) << 8)], b = P[((xi + 1) & 255) + ((yi & 255) << 8)], c = P[(xi & 255) + (((yi + 1) & 255) << 8)], d = P[((xi + 1) & 255) + (((yi + 1) & 255) << 8)];
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; }
    return function (x, y, oct) { var s = 0, amp = 0.5, f = 1; for (var o = 0; o < (oct || 5); o++) { s += amp * v(x * f, y * f); f *= 2; amp *= 0.5; } return s; };
  }
  function hsl(h, s, l) { return 'hsl(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(l) + '%)'; }
  // ---- No Man's Sky style: the seed's number pattern picks everything ----
  function planetRecipe(def) {
    var R = C.rng(def.seed * 7919 + 13);
    var r = { hue: R() * 360, water: def.water ? 0.78 + R() * 0.1 : def.gas ? 0 : R() * 0.6, clouds: R() * 0.7 + 0.1, rings: def.gas ? true : R() < 0.3, atm: R() * 360, gas: !!def.gas, ice: R() < 0.5, desolate: !!def.water };
    if (def.water) { r.hue = 25 + R() * 20; r.atm = 175 + R() * 30; }
    return r;
  }
  function planetTex(T, def, rec, W) {
    var H = W / 2, nz = noise2(def.seed), data;
    return canvasTex(T, W, H, function (g) {
      var img = g.createImageData(W, H); data = img.data;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var u = x / W, v = y / H, lat = Math.abs(v - 0.5) * 2, nx = Math.cos(u * Math.PI * 2) * 2, ny = Math.sin(u * Math.PI * 2) * 2;   // seamless wrap
        var n = nz(nx + 10, ny + v * 6 + 3, 5) * 0.7 + nz(nx * 3 + 40, ny * 3 + v * 14, 3) * 0.3, cr, cg, cb, i = (y * W + x) * 4;
        if (rec.gas) { var band = Math.sin(v * 22 + nz(u * 6, v * 30, 3) * 6) * 0.5 + 0.5, L = 45 + band * 25; var c = hsl2rgb(rec.hue + band * 30, 45, L); cr = c[0]; cg = c[1]; cb = c[2]; }
        else if (n < rec.water * 0.62 + 0.18) { var d = (rec.water * 0.62 + 0.18 - n) * 3; var c2 = hsl2rgb(rec.desolate ? 200 : 210 + rec.hue * 0.05, 55, Math.max(12, 34 - d * 30)); cr = c2[0]; cg = c2[1]; cb = c2[2]; }
        else { var c3 = hsl2rgb(rec.hue + n * 40, rec.desolate ? 12 : 40, 20 + n * 40); cr = c3[0]; cg = c3[1]; cb = c3[2]; }
        if (rec.ice && lat > 0.82 && !rec.gas) { cr = cg = cb = 225; }
        data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  function hsl2rgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100; var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function f(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
  function cloudTex(T, seed, cover, W) { var nz = noise2(seed + 99), H = W / 2; return canvasTex(T, W, H, function (g) { var img = g.createImageData(W, H), d = img.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var u = x / W, v = y / H, n = nz(Math.cos(u * 6.283) * 3 + 5, Math.sin(u * 6.283) * 3 + v * 9, 5), a = Math.max(0, (n - (0.62 - cover * 0.3)) * 4); var i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255); }
    g.putImageData(img, 0, 0); }); }
  var atmoVS = 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }';
  var atmoFS = 'uniform vec3 col; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(vN,vV)), k); gl_FragColor = vec4(col*f, f); }';
  function makePlanet(T, def, fx) {
    var rec = planetRecipe(def), grp = new T.Group(), W = fx > 0.6 ? 512 : 256;
    var mat = new T.MeshLambertMaterial({ map: planetTex(T, def, rec, W) });
    var body = new T.Mesh(new T.SphereGeometry(def.r, 48, 32), mat); grp.add(body);
    if (!rec.gas) { var cl = new T.Mesh(new T.SphereGeometry(def.r * 1.015, 40, 28), new T.MeshLambertMaterial({ map: cloudTex(T, def.seed, rec.clouds, W), transparent: true, depthWrite: false })); grp.add(cl); grp.userData.clouds = cl; }
    var ac = new T.Color().setHSL(rec.atm / 360, 0.7, 0.6);
    [[1.06, 2.5, 0.9], [1.14, 4.0, 0.5]].forEach(function (L) {   // two atmosphere layers
      var m = new T.ShaderMaterial({ uniforms: { col: { value: ac.clone().multiplyScalar(L[2]) }, k: { value: L[1] } }, vertexShader: atmoVS, fragmentShader: atmoFS, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide });
      grp.add(new T.Mesh(new T.SphereGeometry(def.r * L[0], 40, 24), m));
    });
    if (rec.rings) {
      var rg = new T.RingGeometry(def.r * 1.4, def.r * 2.3, 96, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
      for (var i = 0; i < pos.count; i++) { var x = pos.getX(i), y = pos.getY(i), d = Math.sqrt(x * x + y * y); uv.setXY(i, (d - def.r * 1.4) / (def.r * 0.9), 0.5); }
      var rt = canvasTex(T, 256, 4, function (g) { var R = C.rng(def.seed + 5); for (var x = 0; x < 256; x++) { var a = R() * 0.6 * Math.sin(x / 256 * Math.PI); g.fillStyle = 'rgba(230,215,190,' + a.toFixed(2) + ')'; g.fillRect(x, 0, 1, 4); } });
      var ring = new T.Mesh(rg, new T.MeshBasicMaterial({ map: rt, transparent: true, side: T.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2 + 0.35; ring.rotation.y = 0.2; grp.add(ring);
    }
    grp.position.set(def.x, def.y, def.z); grp.userData.rec = rec; grp.userData.body = body;
    return grp;
  }
  function build(T, scene, fx) {
    var H = {}, glow = glowTex(T); H.glow = glow;
    // --- sun (far light source) ---
    H.sunDir = new T.Vector3(0.6, 0.35, 0.72).normalize();
    var sun = new T.DirectionalLight(0xfff1dc, 1.35); sun.position.copy(H.sunDir); scene.add(sun); scene.add(new T.AmbientLight(0x223044, 0.55));
    // --- sky: stars + galaxies + sun glare, attached to the camera so they sit at infinity ---
    var sky = H.sky = new T.Group(); scene.add(sky);
    var n = Math.round(2600 * Math.max(0.5, fx)), g = new T.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3), R = C.rng(42);
    for (var i = 0; i < n; i++) { var u = R() * 2 - 1, th = R() * 6.283, s = Math.sqrt(1 - u * u), band = R() < 0.45; if (band) u *= 0.18; s = Math.sqrt(1 - u * u);
      p[i * 3] = s * Math.cos(th) * 9000; p[i * 3 + 1] = u * 9000; p[i * 3 + 2] = s * Math.sin(th) * 9000; var b = 0.35 + Math.pow(R(), 3) * 0.9, t = R(); c[i * 3] = b * (t < 0.2 ? 1 : 0.85); c[i * 3 + 1] = b * 0.9; c[i * 3 + 2] = b * (t > 0.7 ? 1.1 : 0.9); }
    g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3));
    sky.add(new T.Points(g, new T.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false })));
    var galTex = canvasTex(T, 128, 128, function (gx) { gx.translate(64, 64); for (var k = 0; k < 900; k++) { var a = k / 900 * 12, rr = 4 + a * 4.4 + (Math.random() - 0.5) * 6, arm = (k % 2) * Math.PI; gx.fillStyle = 'rgba(255,' + (200 + Math.random() * 55 | 0) + ',230,' + (0.5 - a / 30).toFixed(2) + ')'; gx.fillRect(Math.cos(a + arm) * rr, Math.sin(a + arm) * rr * 0.55, 1.5, 1.5); } var r2 = gx.createRadialGradient(0, 0, 0, 0, 0, 14); r2.addColorStop(0, 'rgba(255,240,210,.9)'); r2.addColorStop(1, 'rgba(255,240,210,0)'); gx.fillStyle = r2; gx.fillRect(-20, -20, 40, 40); });
    [[0.3, 0.2, -1, 700, 0xffd6f0], [-0.8, 0.4, -0.3, 480, 0xbfd8ff], [0.7, -0.3, 0.4, 420, 0xffe3c0], [-0.2, -0.5, 0.9, 380, 0xd0ffe8], [0.9, 0.6, -0.6, 300, 0xffffff]].forEach(function (q, k) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: galTex, color: q[4], transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false, rotation: k * 1.3, fog: false }));
      sp.position.set(q[0], q[1], q[2]).normalize().multiplyScalar(8500); sp.scale.set(q[3], q[3], 1); sky.add(sp); });
    var sunS = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xfff0d0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sunS.position.copy(H.sunDir).multiplyScalar(8800); sunS.scale.set(900, 900, 1); sky.add(sunS);
    var sunH = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xff9a50, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sunH.position.copy(sunS.position); sunH.scale.set(3200, 3200, 1); sky.add(sunH);
    // --- local dust (parallax at impulse): wraps around the ship ---
    var dn = Math.round(500 * fx), dg = new T.BufferGeometry(), dp = new Float32Array(dn * 3); for (i = 0; i < dn * 3; i++) dp[i] = (R() - 0.5) * 600;
    dg.setAttribute('position', new T.BufferAttribute(dp, 3)); H.dust = new T.Points(dg, new T.PointsMaterial({ size: 1.2, color: 0x9fb4d0, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true })); H.dust.frustumCulled = false; scene.add(H.dust);
    // --- warp streaks (camera-local lines; length and colour by warp factor) ---
    var sn = Math.round(360 * Math.max(0.5, fx)), sg = new T.BufferGeometry(); H.streakN = sn; H.streakSeed = new Float32Array(sn * 3);
    for (i = 0; i < sn; i++) { var a2 = R() * 6.283, rad = 6 + Math.pow(R(), 0.6) * 60; H.streakSeed[i * 3] = Math.cos(a2) * rad; H.streakSeed[i * 3 + 1] = Math.sin(a2) * rad; H.streakSeed[i * 3 + 2] = -R() * 400; }
    sg.setAttribute('position', new T.BufferAttribute(new Float32Array(sn * 6), 3)); sg.setAttribute('color', new T.BufferAttribute(new Float32Array(sn * 6), 3));
    H.streaks = new T.LineSegments(sg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 })); H.streaks.frustumCulled = false;
    // --- shield bubble just outside the glass: hex ripples at impact points (one draw call) ---
    var shU = { hits: { value: [] }, t: { value: 0 }, col: { value: new T.Color(0x6fd8ff) }, base: { value: 0 } };
    for (i = 0; i < 8; i++) shU.hits.value.push(new T.Vector4(0, 0, -1, -99));
    H.shieldU = shU;
    H.shield = new T.Mesh(new T.SphereGeometry(14, 32, 20), new T.ShaderMaterial({ uniforms: shU, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, side: T.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec4 hits[8]; uniform float t; uniform vec3 col; uniform float base; varying vec3 vP;\n' +
        'float hexd(vec2 p){ p = abs(p); return max(p.x*0.866+p.y*0.5, p.y); }\n' +
        'void main(){ vec2 q = vec2(atan(vP.z,vP.x)*6.0, asin(vP.y)*6.0); vec2 r = vec2(1.0,1.732); vec2 h = r*0.5; vec2 a = mod(q,r)-h; vec2 b = mod(q-h,r)-h; vec2 gv = dot(a,a)<dot(b,b)?a:b; float edge = smoothstep(0.42,0.5,hexd(gv));\n' +
        ' float s = 0.0; for(int i=0;i<8;i++){ float age = t-hits[i].w; if(age<0.0||age>1.4) continue; float d = acos(clamp(dot(vP,hits[i].xyz),-1.0,1.0)); float ring = exp(-pow((d-age*0.5)*9.0,2.0)); s += (ring*0.8 + exp(-d*7.0)*(1.0-age/1.4)*1.2)*(1.0-age/1.4); }\n' +
        ' float v = s*(0.35+edge*1.4) + base*edge*0.12; gl_FragColor = vec4(col*v, v); }' }));
    H.shield.renderOrder = 5; H.shield.frustumCulled = false;
    // --- sector objects ---
    H.objs = {};
    C.sector.forEach(function (d) {
      var o;
      if (d.kind === 'planet') o = makePlanet(T, d, fx);
      else if (d.kind === 'station') o = makeStation(T, d, glow);
      else if (d.kind === 'blackhole') o = makeBlackHole(T, d, glow);
      else if (d.kind === 'nebula') o = makeNebula(T, d, glow, fx);
      else if (d.kind === 'comet') o = makeComet(T, d, glow, fx, H.sunDir);
      else if (d.kind === 'ship') o = makeFreighter(T, d, glow);
      else { o = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0x7dffb0, blending: T.AdditiveBlending, depthWrite: false })); o.scale.set(60, 60, 1); o.position.set(d.x, d.y, d.z); o.userData.blink = true; }
      o.userData.def = d; H.objs[d.id] = o; scene.add(o);
    });
    H.raider = makeRaider(T, glow); H.raider.visible = false; scene.add(H.raider);
    H.probeMat = new T.SpriteMaterial({ map: glow, color: 0x9dffd6, blending: T.AdditiveBlending, depthWrite: false });
    return H;
  }
  function lightDot(T, glow, col, s) { var sp = new T.Sprite(new T.SpriteMaterial({ map: glow, color: col, blending: T.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, 1); return sp; }
  function makeStation(T, d, glow) {
    var g = new T.Group(), r = d.r, metal = new T.MeshLambertMaterial({ color: d.id === 'aurel' ? 0xdfe8f2 : d.id === 'vael' ? 0x6a8f7e : 0x8a8478, emissive: 0x111418 });
    if (d.id === 'vael') {     // grown, organic spindle
      var pts = []; for (var i = 0; i <= 12; i++) { var t = i / 12; pts.push(new T.Vector2(r * 0.15 + Math.sin(t * Math.PI) * r * 0.5 * (1 + 0.3 * Math.sin(t * 9)), (t - 0.5) * r * 3)); }
      g.add(new T.Mesh(new T.LatheGeometry(pts, 14), metal));
      for (i = 0; i < 6; i++) { var L = lightDot(T, glow, 0x9dffcf, r * 0.35); L.position.set(Math.cos(i) * r * 0.5, (i / 6 - 0.5) * r * 2.5, Math.sin(i) * r * 0.5); g.add(L); }
    } else {
      var tor = new T.Mesh(new T.TorusGeometry(r, r * 0.12, 8, 40), metal); g.add(tor);
      g.add(new T.Mesh(new T.CylinderGeometry(r * 0.22, r * 0.22, r * 1.2, 12), metal));
      for (i = 0; i < 4; i++) { var sp = new T.Mesh(new T.BoxGeometry(r * 2, r * 0.05, r * 0.05), metal); sp.rotation.z = i * Math.PI / 4; g.add(sp); }
      if (d.id === 'home') { var patch = new T.Mesh(new T.BoxGeometry(r * 0.5, r * 0.3, r * 0.3), new T.MeshLambertMaterial({ color: 0x9a5a2a })); patch.position.set(r * 0.9, 0.2 * r, 0); g.add(patch); }
      for (i = 0; i < 10; i++) { var a = i / 10 * 6.283, Ld = lightDot(T, glow, i % 2 ? 0xff5040 : 0x80d0ff, r * 0.3); Ld.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); Ld.userData.blinkPhase = i; g.add(Ld); }
      var bay = lightDot(T, glow, 0xffe0a0, r * 0.9); bay.position.set(0, 0, r * 0.62); g.add(bay);
    }
    g.position.set(d.x, d.y, d.z); g.userData.spin = d.id === 'vael' ? 0.03 : 0.05; return g;
  }
  function makeBlackHole(T, d, glow) {
    var g = new T.Group(), r = d.r;
    var hole = new T.Mesh(new T.SphereGeometry(r, 32, 20), new T.MeshBasicMaterial({ color: 0x000000 })); hole.renderOrder = 2; g.add(hole);
    var diskU = { t: { value: 0 } };
    var diskM = new T.ShaderMaterial({ uniforms: diskU, transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float t; varying vec3 vP; float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }\n' +
        'void main(){ float d = length(vP.xy)/' + r.toFixed(1) + '; float a = atan(vP.y,vP.x); float sw = a + t*0.6/d + 3.0/d; float st = 0.6+0.4*sin(sw*7.0+d*9.0)*sin(sw*3.0-d*4.0);\n' +
        ' float rad = smoothstep(1.3,1.8,d)*smoothstep(5.2,2.0,d); float dop = 0.65+0.55*cos(a); vec3 hot = mix(vec3(1.0,0.95,0.8), vec3(1.0,0.45,0.12), smoothstep(1.6,4.5,d)); float v = rad*st*dop*1.4; gl_FragColor = vec4(hot*v, v); }' });
    var disk = new T.Mesh(new T.RingGeometry(r * 1.2, r * 5.4, 96, 2), diskM); disk.rotation.x = -Math.PI / 2 + 0.22; g.add(disk);
    // 'lensing': the far side of the disk bent up over the hole (a camera-facing photon ring) + a halo
    var lens = new T.Sprite(new T.SpriteMaterial({ map: (function () { var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'); x.strokeStyle = 'rgba(255,220,170,0.9)'; x.lineWidth = 6; x.shadowBlur = 18; x.shadowColor = '#ffb060'; x.beginPath(); x.arc(128, 128, 76, 0, 6.283); x.stroke(); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(128, 128, 70, 0, 6.283); x.stroke(); var t = new T.CanvasTexture(c); return t; })(), blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
    lens.scale.set(r * 3.4, r * 3.4, 1); lens.renderOrder = 3; g.add(lens);
    var halo = lightDot(T, glow, 0xff8a40, r * 12); halo.material.opacity = 0.35; g.add(halo);
    g.position.set(d.x, d.y, d.z); g.userData.diskU = diskU; return g;
  }
  function makeNebula(T, d, glow, fx) {
    var g = new T.Group(), R = C.rng(1234), n = Math.round(26 * Math.max(0.5, fx));
    var puff = canvasTex(T, 128, 128, function (x) { for (var k = 0; k < 14; k++) { var px = 64 + (Math.random() - 0.5) * 60, py = 64 + (Math.random() - 0.5) * 60, rr = 20 + Math.random() * 30, gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); } });
    var cols = [0xff4fa0, 0x6a5cff, 0x30d0ff, 0xff9050, 0xb060ff];
    for (var i = 0; i < n; i++) { var sp = new T.Sprite(new T.SpriteMaterial({ map: puff, color: cols[i % cols.length], transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, rotation: R() * 6 }));
      sp.position.set((R() - 0.5) * d.r * 1.6, (R() - 0.5) * d.r * 0.8, (R() - 0.5) * d.r * 1.6); var s = d.r * (0.5 + R() * 0.8); sp.scale.set(s, s, 1); g.add(sp); }
    for (i = 0; i < 6; i++) { var st = lightDot(T, glow, 0xdff0ff, 160); st.position.set((R() - 0.5) * d.r, (R() - 0.5) * d.r * 0.5, (R() - 0.5) * d.r); g.add(st); }
    g.position.set(d.x, d.y, d.z); return g;
  }
  function makeComet(T, d, glow, fx, sunDir) {
    var g = new T.Group();
    var nuc = new T.Mesh(new T.IcosahedronGeometry(d.r, 1), new T.MeshLambertMaterial({ color: 0x5a564e })); g.add(nuc);
    var coma = lightDot(T, glow, 0xc8f0ff, d.r * 14); g.add(coma);
    var n = Math.round(900 * Math.max(0.4, fx)), geo = new T.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    for (var i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = (Math.random() - 0.5); seed[i * 4 + 2] = (Math.random() - 0.5); seed[i * 4 + 3] = 0.4 + Math.random(); }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var tail = new T.Points(geo, new T.PointsMaterial({ map: glow, size: 14, color: 0xa8e4ff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })); tail.frustumCulled = false; g.add(tail);
    g.position.set(d.x, d.y, d.z);
    g.userData.tail = { n: n, seed: seed, geo: geo, len: 2600, rad: 150, dir: sunDir.clone().negate() };
    return g;
  }
  function makeFreighter(T, d, glow) {
    var g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x8c7a62 });
    var hull = new T.Mesh(new T.BoxGeometry(14, 10, 60), m); g.add(hull);
    for (var i = 0; i < 4; i++) { var c = new T.Mesh(new T.BoxGeometry(18, 12, 10), new T.MeshLambertMaterial({ color: [0x6a7d8a, 0x9a4a3a, 0x7a8a5a, 0x5a5a7a][i] })); c.position.set(0, 0, -20 + i * 13); g.add(c); }
    var e = lightDot(T, glow, 0x70b0ff, 26); e.position.z = 34; g.add(e);
    g.position.set(d.x, d.y, d.z); g.scale.setScalar(1.4); return g;
  }
  function makeRaider(T, glow) {
    var g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x2a2228, emissive: 0x180408 });
    var body = new T.Mesh(new T.ConeGeometry(14, 70, 4), m); body.rotation.x = -Math.PI / 2; g.add(body);
    var w = new T.Mesh(new T.BoxGeometry(90, 2, 18), m); w.position.z = 15; g.add(w);
    [-44, 44].forEach(function (x) { var L = lightDot(T, glow, 0xff2a30, 22); L.position.set(x, 0, 18); g.add(L); });
    var e = lightDot(T, glow, 0xff6a30, 40); e.position.z = 36; g.add(e);
    return g;
  }
  // ===================================================== events: the colossus and the leviathan (big simple shapes, lots of glow)
  function makeColossus(T, glow) {
    var g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x1a1d24, emissive: 0x05070c });
    var spine = new T.Mesh(new T.CylinderGeometry(120, 260, 4200, 6, 1), m); spine.rotation.z = Math.PI / 2; g.add(spine);
    for (var i = 0; i < 9; i++) { var f = new T.Mesh(new T.BoxGeometry(160, 900 - Math.abs(i - 4) * 140, 60), m); f.position.x = -1700 + i * 420; g.add(f);
      for (var k = 0; k < 3; k++) { var L = lightDot(T, glow, 0x7ad8ff, 70); L.position.set(-1700 + i * 420, (k - 1) * 200, 40); g.add(L); } }
    var rift = new T.Sprite(new T.SpriteMaterial({ map: glow, color: 0xb070ff, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.9 })); rift.scale.set(5200, 2200, 1); g.add(rift); g.userData.rift = rift;
    return g;
  }
  // ===================================================== the water-planet surface (Thalassa)
  function buildSurface(T, fx) {
    var S = new T.Scene(); S.fog = new T.FogExp2(0x6d7f86, 0.0016);
    var skyM = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.45,0.52,0.55), vec3(0.16,0.2,0.27), smoothstep(0.0,0.6,h)); c = mix(c, vec3(0.75,0.62,0.48), exp(-abs(h)*14.0)*0.5); gl_FragColor = vec4(c,1.0); }' });
    var sky = new T.Mesh(new T.SphereGeometry(3000, 24, 16), skyM); S.add(sky); S.userData.sky = sky;
    S.add(new T.AmbientLight(0x8090a0, 0.7)); var sl = new T.DirectionalLight(0xffe6c8, 0.9); sl.position.set(-0.4, 0.5, -1); S.add(sl);
    var gas = new T.Sprite(new T.SpriteMaterial({ map: canvasTex(T, 128, 128, function (x) { var gr = x.createRadialGradient(64, 64, 40, 64, 64, 64); x.fillStyle = '#c9a882'; x.beginPath(); x.arc(64, 64, 52, 0, 6.283); x.fill(); for (var b = 0; b < 8; b++) { x.fillStyle = 'rgba(120,80,60,.25)'; x.fillRect(12, 20 + b * 11, 104, 4); } x.globalCompositeOperation = 'destination-in'; x.beginPath(); x.arc(64, 64, 52, 0, 6.283); x.fill(); }), fog: false, opacity: 0.55, transparent: true }));
    gas.position.set(-900, 700, -2200); gas.scale.set(900, 900, 1); S.add(gas);
    var seg = fx > 0.6 ? 120 : 70, wg = new T.PlaneGeometry(4000, 4000, seg, seg); wg.rotateX(-Math.PI / 2);
    var wU = { t: { value: 0 }, fogColor: { value: new T.Color(0x6d7f86) }, fogDensity: { value: 0.0016 } };
    var water = new T.Mesh(wg, new T.ShaderMaterial({ uniforms: wU, transparent: true,
      vertexShader: 'uniform float t; varying float vH; varying float vD; varying vec3 vW; void main(){ vec3 p = position; float h = sin(p.x*0.03+t*0.8)*0.6+sin(p.z*0.045+t*0.6)*0.5+sin((p.x+p.z)*0.11+t*1.7)*0.18; p.y += h; vH = h; vec4 mv = modelViewMatrix*vec4(p,1.0); vD = -mv.z; vW = p; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 fogColor; uniform float fogDensity; varying float vH; varying float vD; varying vec3 vW; void main(){ vec3 c = mix(vec3(0.06,0.13,0.16), vec3(0.32,0.42,0.44), smoothstep(-0.8,1.0,vH)); c += vec3(0.25,0.22,0.18)*smoothstep(0.85,1.2,vH); float f = 1.0-exp(-pow(fogDensity*vD,2.0)); gl_FragColor = vec4(mix(c,fogColor,f), 0.94); }' }));
    S.add(water); S.userData.waterU = wU;
    var rockM = new T.MeshLambertMaterial({ color: 0x3b3a38, flatShading: true }), R = C.rng(4471);
    for (var i = 0; i < 26; i++) { var a = R() * 6.283, d = 160 + R() * 1400, rk = new T.Mesh(new T.DodecahedronGeometry(10 + R() * 60, 0), rockM); rk.position.set(Math.cos(a) * d, -4, Math.sin(a) * d - 200); rk.scale.y = 0.5 + R() * 1.6; rk.rotation.set(R(), R(), R()); S.add(rk); }
    // jagged spires on the horizon
    for (i = 0; i < 9; i++) { var sp = new T.Mesh(new T.ConeGeometry(30 + R() * 50, 120 + R() * 260, 5), rockM); sp.position.set(-1100 + i * 280 + R() * 100, 40, -1200 - R() * 400); S.add(sp); }
    // aliens: tall, thin, too-still; pale eyes. The near one is a huge face for the glass.
    S.userData.aliens = [];
    var skin = new T.MeshLambertMaterial({ color: 0x2a3436, emissive: 0x050a0a, flatShading: true }), eyeM = new T.SpriteMaterial({ map: glowTex(T), color: 0xd8fff0, blending: T.AdditiveBlending, depthWrite: false });
    function alien(scale) {
      var g = new T.Group(), pts = [];
      for (var k = 0; k <= 10; k++) { var t = k / 10; pts.push(new T.Vector2(Math.max(0.05, (0.9 - t * 0.5) * (1 + Math.sin(t * 9) * 0.08) * (t > 0.75 ? (1 - (t - 0.75) * 2.8) * 1.6 : 1)), t * 9)); }
      var body = new T.Mesh(new T.LatheGeometry(pts, 7), skin); g.add(body);
      var head = new T.Mesh(new T.SphereGeometry(1.1, 8, 6), skin); head.scale.set(1, 1.9, 0.9); head.position.y = 9.6; g.add(head);
      [-0.42, 0.42].forEach(function (x) { var e = new T.Sprite(eyeM); e.scale.set(0.9, 0.9, 1); e.position.set(x, 10.1, 0.75); g.add(e); });
      g.scale.setScalar(scale); return g;
    }
    for (i = 0; i < 4; i++) { var al = alien(2.2 + R()); al.userData = { home: new T.Vector3((R() - 0.5) * 500, 0, -140 - R() * 380), t: -R() * 20 - i * 9, state: 'under', dur: 0 }; al.position.copy(al.userData.home).setY(-40); S.add(al); S.userData.aliens.push(al); }
    var near = alien(1.4); near.userData = { near: true, t: -99, state: 'under' }; near.position.set(0.6, -20, -6.5); S.add(near); S.userData.nearAlien = near;
    return S;
  }
  root.SWorld = { build: build, buildSurface: buildSurface, makeColossus: makeColossus, planetRecipe: planetRecipe, glowTex: glowTex, makePlanet: makePlanet };
})(window);
