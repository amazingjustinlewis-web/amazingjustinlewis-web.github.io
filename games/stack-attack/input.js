/* STACK ATTACK touch/mouse: icons on the side spawn a held block, drag a block to move it (held in the tower plane, seen
   in 3D), drag empty space to orbit the camera, second finger (or Rotate) turns the held block. Same code on screen and pads. */
(function (root) {
  root.StackInput = function (cv, tray, cam, proj, act) {
    var offer = [0, 1, 4], drag = null, fingers = {};
    function paintTray() { tray.innerHTML = offer.map(function (k, i) { return '<button class="ico" data-i="' + i + '">' + root.StackDraw.iconSvg(root.StackKinds[k]) + '</button>'; }).join(''); }
    paintTray();
    function w(e) { return proj().un(e.clientX, e.clientY); }
    tray.addEventListener('pointerdown', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; e.preventDefault(); var i = +b.dataset.i, p = w(e);
      act.spawn(offer[i], p[0], p[1]); offer[i] = (Math.random() * root.StackKinds.length) | 0; setTimeout(paintTray, 200); drag = { kind: 'block', id: e.pointerId }; fingers[e.pointerId] = 1; });
    cv.addEventListener('pointerdown', function (e) {
      if (Object.keys(fingers).length && drag && drag.kind === 'block') { act.rotate(); return; }
      fingers[e.pointerId] = 1; var p = w(e); if (act.grab(p[0], p[1])) drag = { kind: 'block', id: e.pointerId }; else drag = { kind: 'orbit', id: e.pointerId, x: e.clientX, y: e.clientY };
      try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
    addEventListener('pointermove', function (e) { if (!drag || drag.id !== e.pointerId) return;
      if (drag.kind === 'block') { var p = w(e); act.move(p[0], p[1]); } else { cam.orbit(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; } });
    function up(e) { delete fingers[e.pointerId]; if (!drag || drag.id !== e.pointerId) return; if (drag.kind === 'block') act.drop(); drag = null; }
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
})(window);
