/* TV v0.7.10: property danger/mortgage pointers only appear when that
   property is off the edge of the (zoomed) board. The on-tile arrows are
   hidden while the tile is visible. The menu-board player pointer is unchanged.
   Overlay is drawn inside the camera transform, so tests and chevrons use
   the visible world window, not a second screen-space scale. */
(function (w) {
  'use strict';
  var hooked = false;

  function visRect(rnd, cam) {
    var z = (cam && cam.z) || 1;
    var cx = (cam && cam.x) || (rnd.bx + rnd.S / 2);
    var cy = (cam && cam.y) || (rnd.by + rnd.S / 2);
    var hw = rnd.S / (2 * z), hh = rnd.S / (2 * z);
    return { l: cx - hw, r: cx + hw, t: cy - hh, b: cy + hh, z: z, cx: cx, cy: cy };
  }
  function onScreen(vr, wx, wy) {
    var pad = 10 / Math.max(1, vr.z);
    return wx > vr.l + pad && wx < vr.r - pad && wy > vr.t + pad && wy < vr.b - pad;
  }
  function drawEdge(c, vr, wx, wy, col, now, i) {
    var pad = 18 / Math.max(0.5, vr.z), sz = 12 / Math.max(0.5, vr.z);
    var dx = wx - vr.cx, dy = wy - vr.cy;
    var limx = (vr.r - vr.l) / 2 - pad, limy = (vr.b - vr.t) / 2 - pad;
    var k = Math.min(limx / Math.max(Math.abs(dx), 1e-6), limy / Math.max(Math.abs(dy), 1e-6));
    var ax = vr.cx + dx * k, ay = vr.cy + dy * k, ang = Math.atan2(dy, dx);
    var pulse = 1 + 0.1 * Math.sin((now || 0) / 180 + i);
    c.save(); c.translate(ax, ay); c.rotate(ang); c.scale(pulse, pulse);
    c.beginPath(); c.moveTo(sz, 0); c.lineTo(-sz * 0.7, -sz * 0.75); c.lineTo(-sz * 0.35, 0); c.lineTo(-sz * 0.7, sz * 0.75); c.closePath();
    c.fillStyle = col || '#ff5d73'; c.fill();
    c.lineWidth = 2 / Math.max(0.5, vr.z); c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    c.restore();
  }
  function drawWaypoints(c, rnd, now) {
    var g = w.RDR && RDR.game, FX = w.RDRFxTune;
    if (!g || g.phase !== 'play' || !rnd || !FX || !FX.dangerOf) return;
    var cam = rnd.cam, camOn = cam && cam.z > 1.002;
    var vr = visRect(rnd, cam);
    for (var i = 0; i < 40; i++) {
      var pr = g.props[i]; if (!pr || pr.owner < 0) continue;
      var hocked = !!pr.hocked;
      var dng = FX.dangerOf(g, i);
      if (!hocked && dng < 0.12) continue;
      var rc = rnd.rect(i), wx = rnd.bx + rc.x + rc.w / 2, wy = rnd.by + rc.y + rc.h * 0.22;
      if (onScreen(vr, wx, wy)) continue; /* only when the property is off the edge */
      if (!camOn && !hocked) continue;
      if (!camOn) continue; /* zoomed-out board: every tile is on screen, no arrows */
      var o = g.byId(pr.owner);
      drawEdge(c, vr, wx, wy, o ? o.color : '#ff5d73', now, i);
    }
  }
  function hook() {
    var FX = w.RDRFxTune; if (!FX || hooked) return !!FX;
    hooked = true;
    FX.drawWaypoints = drawWaypoints;
    return true;
  }
  function loop() { hook(); setTimeout(loop, 400); }
  loop();
  w.RDRWaypointsV02 = { draw: drawWaypoints, hook: hook };
})(window);
