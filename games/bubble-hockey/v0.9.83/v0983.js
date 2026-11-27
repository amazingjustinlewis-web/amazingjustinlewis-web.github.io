/* v0.9.83: Bubble Hockey rink-board ads from ZTPSponsors.
   Empty slots: gold-on-black "Your business here". ?sponsors=0 hides the boards
   (including the older hard-coded text). Red Deer Rich is not wired here —
   see sponsors_v01.json docs for the get('red-deer-rich','board-property') hook.
   ?shot=boards parks a still camera on the near long-side board (dev captures). */
(function (root) {
  'use strict';
  /* Public freeze: board ads default OFF. Pass ?sponsors=1 to show them. */
  var OFF = !/[?&]sponsors=1(?:&|$)/.test(location.search);
  var SHOT = /[?&]shot=boards(?:&|$)/.test(location.search);
  var NEW_H = 0.04954, AD_H = NEW_H * 0.88, AD_Z = NEW_H * 0.5, AD_W = 0.85, AD_W_END = 0.56;
  var CW = 640, CH = 56;
  function L3(x, y, h) { return new THREE.Vector3(y, h || 0, x); }
  function iceL() { return (root.Bubble && root.Bubble.L) || 2; }
  function placeOf(m, L) {
    var x = m.position.z, y = m.position.x;
    if (x < 0.5 && Math.abs(y - L / 2) < 0.25) return 'long-near';
    if (x >= 0.5 && Math.abs(y - L / 2) < 0.25) return 'long-far';
    if (y < L / 2) return 'end-south';
    return 'end-north';
  }
  function makePlane(place, L) {
    var w = (place === 'end-south' || place === 'end-north') ? AD_W_END : AD_W;
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, AD_H),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthWrite: true, color: 0xffffff })
    );
    if (place === 'long-near') {
      m.position.copy(L3(0.028, L / 2, AD_Z));
      m.rotation.y = 0;
    } else if (place === 'long-far') {
      m.position.copy(L3(0.972, L / 2, AD_Z));
      m.rotation.y = Math.PI;
    } else if (place === 'end-south') {
      m.position.copy(L3(0.5, 0.028, AD_Z));
      m.rotation.y = -Math.PI / 2;
    } else {
      m.position.copy(L3(0.5, L - 0.028, AD_Z));
      m.rotation.y = Math.PI / 2;
    }
    m.renderOrder = 2;
    m.userData.ztpPlace = place;
    return m;
  }
  function applySlot(m, slot) {
    var cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    var S = root.ZTPSponsors;
    var done = S && S.paint ? S.paint(cv, slot) : Promise.resolve(cv);
    return Promise.resolve(done).then(function () {
      var tx = new THREE.CanvasTexture(cv);
      tx.anisotropy = 4;
      tx.needsUpdate = true;
      if (m.material && m.material.map) m.material.map.dispose();
      if (!m.material || m.material === m._shared) {
        m.material = new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide, depthWrite: true });
      } else {
        m.material.map = tx;
        m.material.needsUpdate = true;
      }
      m.userData.ztpSlot = slot ? slot.id : null;
      m.userData.ztpLink = slot && slot.link ? slot.link : '';
    });
  }
  function hideAds(R) {
    var ads = R.ads || [];
    ads.forEach(function (m) {
      if (m.parent) m.parent.remove(m);
      m.visible = false;
    });
    R.ads = [];
  }
  function apply(R) {
    if (!R || R.phone || OFF) { if (R && OFF) hideAds(R); return; }
    var S = root.ZTPSponsors;
    var list = S && S.get ? S.get('bubble-hockey', 'rink-board') : [];
    var L = iceL();
    var G = R.G;
    if (!R.ads) R.ads = [];
    var byPlace = {};
    R.ads.forEach(function (m) { byPlace[m.userData.ztpPlace || placeOf(m, L)] = m; });
    var want = list.length ? list : [
      { place: 'long-near' }, { place: 'long-far' },
      { place: 'end-south' }, { place: 'end-north' }
    ];
    want.forEach(function (slot) {
      var place = slot.place;
      if (!place) return;
      var m = byPlace[place];
      if (!m) {
        m = makePlane(place, L);
        if (G) G.add(m);
        R.ads.push(m);
        byPlace[place] = m;
      } else {
        m.visible = true;
        m.position.y = AD_Z;
      }
      applySlot(m, slot);
    });
    if (SHOT) root.ZTP_SHOT_BOARDS = 1;
  }
  function parkCam(R) {
    if (!R || !R.gl || !R.scene) return false;
    var L = iceL();
    var cam = R._ztpShotCam;
    if (!cam) {
      cam = R._ztpShotCam = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 40);
    }
    var el = R.gl.domElement;
    var w = el.width || el.clientWidth || 1280, h = el.height || el.clientHeight || 720;
    cam.aspect = w / h || 16 / 9;
    cam.fov = 38;
    cam.position.set(L / 2, 0.18, 0.36);
    cam.lookAt(L / 2, AD_Z, 0.028);
    cam.updateProjectionMatrix();
    R.gl.render(R.scene, cam);
    return true;
  }
  function hook(R) {
    if (!R || !R.prototype || R.prototype._ztp983) return;
    R.prototype._ztp983 = true;
    var oAds = R.prototype.buildAds;
    R.prototype.buildAds = function () {
      if (oAds) oAds.call(this);
      if (OFF) { hideAds(this); return; }
      var self = this;
      var go = function () { apply(self); };
      go();
      if (root.ZTPSponsors && root.ZTPSponsors.ready) {
        root.ZTPSponsors.ready().then(go);
        if (root.ZTPSponsors.onUpdate) root.ZTPSponsors.onUpdate(go);
      }
    };
    if (SHOT) {
      var oRender = R.prototype.render;
      R.prototype.render = function (st, dt, opt) {
        if (oRender) oRender.apply(this, arguments);
        if (this.ads && this.ads.length) parkCam(this);
      };
      root.ZTP_parkBoardCam = function () {
        var inst = root.BHT && root.BHT.R3;
        return inst ? parkCam(inst) : false;
      };
    }
  }
  var R3 = root.Bubble3D;
  if (R3) hook(R3);
  if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
  root.ZTP983 = { hook: hook, apply: apply, off: OFF };
})(window);
