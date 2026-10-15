/* DEMOLITION DERBY v0.3 - Justin's sedan (models/sedan_v02.glb): tiny GLB reader (no loader dependency) + per-part damage.
   glTF is Y-up with the car's front at -Z; we turn it to face +Z (the derby's forward). */
(function () {
  'use strict';
  var R3 = window.THREE, TPL = null, MATS = null, waiters = [];
  window.DDSedan = { ready: function () { return !!TPL; }, onReady: function (f) { if (TPL) f(); else waiters.push(f); }, build: build };
  fetch(new URL('models/sedan_v02.glb', document.baseURI)).then(function (r) { return r.arrayBuffer(); }).then(parse).catch(function (e) { console.warn('sedan model failed, box cars stay', e); });
  function parse(buf) {
    var dv = new DataView(buf), jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
    var CT = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    function acc(i) { var a = json.accessors[i], v = json.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type];
      return new T(buf.slice(bin + (v.byteOffset || 0) + (a.byteOffset || 0), bin + (v.byteOffset || 0) + (a.byteOffset || 0) + a.count * n * T.BYTES_PER_ELEMENT)); }
    MATS = json.materials.map(function (m) { var f = m.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1]; return { name: m.name, color: new R3.Color(f[0], f[1], f[2]), alpha: f[3] }; });
    var geos = json.meshes.map(function (me) { var p = me.primitives[0], g = new R3.BufferGeometry();
      g.setAttribute('position', new R3.BufferAttribute(acc(p.attributes.POSITION), 3)); if (p.attributes.NORMAL != null) g.setAttribute('normal', new R3.BufferAttribute(acc(p.attributes.NORMAL), 3)); else g.computeVertexNormals();
      if (p.indices != null) g.setIndex(new R3.BufferAttribute(acc(p.indices), 1)); g.computeBoundingBox(); return { g: g, mat: p.material }; });
    TPL = json; TPL._geos = geos;
    waiters.forEach(function (f) { f(); }); waiters = [];
  }
  // returns { root, parts: {name: {node, kind, side, cx, cz, dmg}} } ; paint = per-car material
  function build(paint, glass, trim, tyre) {
    var J = TPL, byMat = { Glass: glass, Paint: paint, Trim: trim, Tyre: tyre }, parts = {};
    function node(i) { var n = J.nodes[i], o = new R3.Group(); o.name = n.name;
      if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale);
      if (n.mesh != null) { var G = J._geos[n.mesh], mesh = new R3.Mesh(G.g, byMat[MATS[G.mat].name] || paint); o.add(mesh); o.userData.mesh = mesh; }
      (n.children || []).forEach(function (c) { o.add(node(c)); }); return o; }
    var rootIdx = J.nodes.findIndex(function (n) { return n.name === 'Sedan_Root'; }), root = node(rootIdx);
    var wrap = new R3.Group(); wrap.rotation.y = Math.PI; wrap.add(root);
    wrap.updateMatrixWorld(true);
    var V = new R3.Vector3();
    root.traverse(function (o) { var k = /^Hood/.test(o.name) ? 'hood' : /^Door/.test(o.name) ? 'door' : /^Trunk/.test(o.name) ? 'trunk' : /^Glass/.test(o.name) ? 'glass' : /^Wheel/.test(o.name) ? 'wheel' : null; if (!k) return;
      // centre of the part in the car's frame (+x right? we use the wrap-local frame: +z forward)
      var bb = new R3.Box3().setFromObject(o); bb.getCenter(V); parts[o.name] = { node: o, kind: k, cx: V.x, cy: V.y, cz: V.z, dmg: 0, st: 0, base: o.quaternion.clone(), swing: 0, sv: 0 }; });
    return { wrap: wrap, parts: parts };
  }
})();
