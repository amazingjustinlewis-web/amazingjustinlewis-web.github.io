/* TV v0.7.10: draw the session selfie as a circular, cropped face disc on the
   pawn's head, with a soft border in the player colour. Replaces the flat
   uncropped square that sat over the torso. Session-only, as before.
   Does not overwrite selfie_tv_v01.js or selfie_tv_v02.js. */
(function (w) {
  'use strict';
  var hooked = false;

  function hexRgb(h) {
    h = String(h || '#ffd23f').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16); if (isNaN(n)) return [242, 194, 48];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function recOf(pid) {
    var S = w.RDRSelfie; if (!S || pid == null) return null;
    var f = S.of && S.of(pid);
    return f && f.ready && f.img ? f : null;
  }
  function headOf(p, x, y, h, o) {
    o = o || {};
    if (w.RDRSelfie && typeof RDRSelfie === 'object') {
      /* v01 headWorld is not exported; use the same local formula. */
    }
    var s = h / 132;
    var bob = (o.walk == null || o.walk < 0) ? 0 : Math.abs(Math.sin(o.walk * Math.PI * 2)) * 3 * s;
    var hp = { x: x, y: y - (97 + bob) * s };
    if (o.head) {
      var nx = x, ny = y - h * 0.62;
      var dx = hp.x - nx, dy = hp.y - ny;
      var ca = Math.cos(o.head), sa = Math.sin(o.head);
      hp = { x: nx + dx * ca - dy * sa, y: ny + dx * sa + dy * ca };
    }
    return hp;
  }
  function drawDisc(c, p, x, y, h, o) {
    var rec = recOf(p && p.id); if (!rec) return false;
    var im = rec.img; if (!im || !im.width && !im.naturalWidth) return false;
    var hp = headOf(p, x, y, h, o);
    var r = Math.max(5, h * 0.20);
    var col = (o && o.glow) || (p && p.color) || '#ffd23f';
    var rgb = hexRgb(col);
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    var side = Math.min(iw, ih);
    var sx = (iw - side) / 2, sy = (ih - side) / 2;
    c.save();
    if (o && o.alpha != null) c.globalAlpha *= o.alpha;
    var glow = c.createRadialGradient(hp.x, hp.y, r * 0.7, hp.x, hp.y, r * 1.45);
    glow.addColorStop(0, 'rgba(' + rgb.join(',') + ',0.28)');
    glow.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
    c.fillStyle = glow; c.beginPath(); c.arc(hp.x, hp.y, r * 1.45, 0, 7); c.fill();
    c.beginPath(); c.arc(hp.x, hp.y, r, 0, 7); c.closePath(); c.clip();
    c.drawImage(im, sx, sy, side, side, hp.x - r, hp.y - r, r * 2, r * 2);
    c.restore();
    c.save();
    if (o && o.alpha != null) c.globalAlpha *= o.alpha;
    c.beginPath(); c.arc(hp.x, hp.y, r, 0, 7);
    c.strokeStyle = col; c.lineWidth = Math.max(2, r * 0.14); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = Math.max(1, r * 0.05); c.stroke();
    c.restore();
    return true;
  }

  function hookPeople() {
    var PPL = w.RDRPeople; if (!PPL || PPL._selfieTv0710 || typeof PPL.draw !== 'function') return !!PPL;
    PPL._selfieTv0710 = true;
    var orig = PPL.draw;
    PPL.draw = function (c, x, y, h, look, o) {
      o = o || {};
      var pid = o.selfiePid;
      if (pid == null && PPL._curPid != null) pid = PPL._curPid;
      var rec = pid != null ? recOf(pid) : null;
      if (rec) {
        /* Draw the body without a photo-wrapped head or the old square overlay. */
        var o2 = Object.assign({}, o);
        delete o2.selfie;
        orig.call(this, c, x, y, h, look, o2);
        var p = { id: pid, color: o.glow };
        try { var g = w.RDR && RDR.game; if (g && g.byId) p = g.byId(pid) || p; } catch (e) {}
        drawDisc(c, p, x, y, h, o);
        return;
      }
      return orig.call(this, c, x, y, h, look, o);
    };
    return true;
  }

  /* Stop the v0.7.6 ball overlay from also painting a second (sometimes square) photo. */
  function quietV01() {
    var S = w.RDRSelfie; if (!S || S._tv0710Quiet) return !!S;
    S._tv0710Quiet = true;
    if (typeof S.drawFor === 'function') {
      var prev = S.drawFor;
      S.drawFor = function (c, p, x, y, h, o) {
        if (p && recOf(p.id)) return drawDisc(c, p, x, y, h, o || {});
        return prev.apply(this, arguments);
      };
    }
    if (typeof S.wrapWalkers === 'function' && !S._tv0710WrapSkip) {
      S._tv0710WrapSkip = true;
      var ww = S.wrapWalkers;
      S.wrapWalkers = function () { return true; };
    }
    return true;
  }

  function boot() { quietV01(); hookPeople(); }
  function loop() { boot(); setTimeout(loop, 400); }
  loop();
  w.RDRSelfieV03 = { drawDisc: drawDisc, boot: boot };
})(window);
