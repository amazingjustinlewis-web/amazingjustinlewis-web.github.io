/* =====================================================================
   camera.js - smooth framing of all active players + slow-mo focus + shake.
   Zoom 1.0 shows CONFIG.camera.rowsAtZoom1 rows top-to-bottom.
   ===================================================================== */
const Camera = (() => {
  const cam = {
    x: 0, y: 0, zoom: 1, viewW: 800, viewH: 600,
    shakeAmp: 0, shakeX: 0, shakeY: 0,
    focusPos: null,   // {x, y} slow-mo focus point (world)
    focusAmt: 0,      // 0..1 how strongly we push in on focusPos
    bounds: { minX: 0, maxX: 600, minY: -600, maxY: 0 }
  };
  const ease = (k, dt) => 1 - Math.exp(-k * dt);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function baseScale() { return cam.viewH / (CONFIG.camera.rowsAtZoom1 * CONFIG.world.tile); }

  function clampPos(x, y, zoom) {
    const T = CONFIG.world.tile, s = baseScale() * zoom, b = cam.bounds;
    const hw = cam.viewW / (2 * s), hh = cam.viewH / (2 * s), m = T * 0.6;
    if (b.maxX - b.minX + 2 * m <= 2 * hw) x = (b.minX + b.maxX) / 2;
    else x = clamp(x, b.minX - m + hw, b.maxX + m - hw);
    if (b.maxY - b.minY + 2 * m <= 2 * hh) y = (b.minY + b.maxY) / 2;
    else y = clamp(y, b.minY - m + hh, b.maxY + m - hh);
    return [x, y];
  }

  function target(targets) {
    const C = CONFIG.camera, T = CONFIG.world.tile, b = cam.bounds;
    let tx, ty, tz;
    if (!targets.length) {
      tx = (b.minX + b.maxX) / 2; ty = b.maxY - 3 * T; tz = 1;
    } else {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const t of targets) { x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x); y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y); }
      tx = (x0 + x1) / 2;
      ty = (y0 + y1) / 2 - C.lookAhead * T;
      const needW = (x1 - x0) + 2 * C.padCols * T;
      const needH = (y1 - y0) + 2 * C.padRows * T + C.lookAhead * T;
      const fit = Math.min(cam.viewW / (baseScale() * needW), cam.viewH / (baseScale() * needH));
      const zmin = targets.length > 1 ? Math.max(C.minZoom, C.twoPlayerMinZoom || C.minZoom) : C.minZoom;
      tz = clamp(fit, zmin, C.maxZoom);
      if (fit < zmin && targets.length > 1) {
        // Too far apart to fit even fully zoomed out: frame the LEADER (furthest up) and show as much
        // of the field behind them as fits. Trailing players get an off-screen arrow (see main.js).
        const hh = cam.viewH / (2 * baseScale() * tz);
        ty = y0 + hh - (C.padRows + C.lookAhead / 2) * T;
        const lead = targets.reduce((a, b) => (b.y < a.y ? b : a));
        tx = lead.x;
      }
      if (C.fitWidth) tz = Math.max(C.minZoom, Math.min(tz, cam.viewW / (baseScale() * (b.maxX - b.minX + T * 0.5))));
    }
    if (cam.focusPos && cam.focusAmt > 0) {
      const a = cam.focusAmt;
      tx += (cam.focusPos.x - tx) * a;
      ty += (cam.focusPos.y - T * 0.4 - ty) * a;
      tz *= 1 + (C.focusZoom - 1) * a;
    }
    [tx, ty] = clampPos(tx, ty, tz);
    return { tx, ty, tz };
  }

  cam.resize = (w, h) => { cam.viewW = w; cam.viewH = h; };
  cam.setBounds = (b) => { cam.bounds = b; };
  cam.snap = (targets) => { const t = target(targets); cam.x = t.tx; cam.y = t.ty; cam.zoom = t.tz; };

  cam.update = (realDt, targets) => {
    const C = CONFIG.camera;
    const t = target(targets);
    const kPos = C.followEase + (C.focusEase - C.followEase) * cam.focusAmt;
    const kZoom = C.zoomEase + (C.focusEase - C.zoomEase) * cam.focusAmt;
    cam.x += (t.tx - cam.x) * ease(kPos, realDt);
    cam.y += (t.ty - cam.y) * ease(kPos, realDt);
    cam.zoom = Math.exp(Math.log(cam.zoom) + (Math.log(t.tz) - Math.log(cam.zoom)) * ease(kZoom, realDt));
    [cam.x, cam.y] = clampPos(cam.x, cam.y, cam.zoom);
    cam.shakeAmp *= Math.exp(-C.shakeDecay * realDt);
    if (cam.shakeAmp < 0.05) cam.shakeAmp = 0;
    const s = cam.scale;
    cam.shakeX = (Math.random() * 2 - 1) * cam.shakeAmp * s;
    cam.shakeY = (Math.random() * 2 - 1) * cam.shakeAmp * s;
  };

  cam.shake = (px) => { cam.shakeAmp = Math.max(cam.shakeAmp, px); };

  Object.defineProperty(cam, 'scale', { get: () => baseScale() * cam.zoom });

  cam.apply = (ctx, dpr) => {
    const s = cam.scale * dpr;
    ctx.setTransform(s, 0, 0, s, dpr * (cam.viewW / 2 + cam.shakeX) - s * cam.x, dpr * (cam.viewH / 2 + cam.shakeY) - s * cam.y);
  };

  cam.visibleRect = () => {
    const s = cam.scale, hw = cam.viewW / (2 * s) + 20, hh = cam.viewH / (2 * s) + 20;
    return { x0: cam.x - hw, x1: cam.x + hw, y0: cam.y - hh, y1: cam.y + hh };
  };

  cam.worldToScreen = (x, y) => [(x - cam.x) * cam.scale + cam.viewW / 2, (y - cam.y) * cam.scale + cam.viewH / 2];

  return cam;
})();

/* ---------------------------------------------------------------------
   Drama - slow-motion moments. Drama.trigger(player, reason, priority)
   Rate limited by CONFIG.slowmo.cooldown (priority events: priorityCooldown).
   --------------------------------------------------------------------- */
const Drama = (() => {
  const d = { active: false, t: 0, clock: 0, last: -99, amt: 0, focus: null, reason: '', count: 0 };
  const smooth = (k) => k * k * (3 - 2 * k);

  d.trigger = (player, reason, priority = false) => {
    const S = CONFIG.slowmo;
    if (!S.enabled) return false;
    const gap = d.clock - d.last;
    if (gap < (priority ? S.priorityCooldown : S.cooldown)) return false;
    if (d.active && !priority) return false;
    const wasRunning = d.active && d.amt > 0;
    d.active = true; d.t = wasRunning ? S.easeIn * d.amt : 0;
    d.focus = player; d.reason = reason; d.last = d.clock; d.count++;
    return true;
  };

  d.update = (realDt) => {
    const S = CONFIG.slowmo;
    d.clock += realDt;
    if (!d.active) { d.amt = 0; return; }
    d.t += realDt;
    if (d.t < S.easeIn) d.amt = smooth(d.t / S.easeIn);
    else if (d.t < S.easeIn + S.hold) d.amt = 1;
    else if (d.t < S.easeIn + S.hold + S.easeOut) d.amt = 1 - smooth((d.t - S.easeIn - S.hold) / S.easeOut);
    else { d.active = false; d.amt = 0; d.focus = null; }
  };

  d.reset = () => { d.active = false; d.amt = 0; d.focus = null; d.t = 0; };

  Object.defineProperty(d, 'timeScale', { get: () => 1 + (CONFIG.slowmo.timeScale - 1) * d.amt });
  return d;
})();
