/* RED DEER RICH - v0.2 placeholder building art (RDRArt): clean line art with a subtle "3D top-down" look.
   Camera model: straight above the middle of the board with a slight fisheye. A building's roof is its footprint
   shifted OUTWARD from the board centre, in proportion to the building's height and its distance from the centre
   (almost straight down in the middle, a little more toward the edges). The shift is always along (position - centre),
   so nothing can ever lean into the board. Only the walls facing the centre are visible, like a real overhead lens.
     C.art.lean   - THE tunable: roof shift per unit of height at the board edge (0 = flat, 0.12 = about 9 degrees at the edge)
     C.art.fisheye- extra lean toward the corners (0 = plain perspective)
   Everything here draws into the renderer's cached static board canvas, so it costs nothing per frame (Chromecast-safe).
   Swapping in rendered sprites later: RDRArt.useSprite('shop' | 'mega' | 'city', urlOrImage). Once loaded, the sprite is
   drawn at the shifted roof position, sized to the footprint, in place of the line art. */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG || {}, A = C.art || {};
  var sprites = {}, listeners = [];
  function lean() { return A.lean != null ? A.lean : 0.12; }
  // roof offset for a building whose footprint centre is (x, y), height h (px), on a board centred at (cx, cy) with half-size half
  function offset(x, y, h, cx, cy, half) {
    var nx = (x - cx) / half, ny = (y - cy) / half, r2 = nx * nx + ny * ny, k = lean() * h * (1 + (A.fisheye != null ? A.fisheye : 0.3) * r2);
    return { x: nx * k, y: ny * k };
  }
  function hexRgb(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(hx, f) { return 'rgb(' + hexRgb(hx).map(function (v) { return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f); }).join(',') + ')'; }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  // the walls you can see (those facing the board centre), each with its four corners and a light/dark tone
  function walls(x, y, w, h, o) {
    var out = [];
    if (o.y > 0.05) out.push({ p: [[x, y], [x + w, y], [x + w + o.x, y + o.y], [x + o.x, y + o.y]], tone: 0.1, edge: 'n' });
    if (o.y < -0.05) out.push({ p: [[x, y + h], [x + w, y + h], [x + w + o.x, y + h + o.y], [x + o.x, y + h + o.y]], tone: -0.32, edge: 's' });
    if (o.x > 0.05) out.push({ p: [[x, y], [x, y + h], [x + o.x, y + h + o.y], [x + o.x, y + o.y]], tone: -0.08, edge: 'w' });
    if (o.x < -0.05) out.push({ p: [[x + w, y], [x + w, y + h], [x + w + o.x, y + h + o.y], [x + w + o.x, y + o.y]], tone: -0.22, edge: 'e' });
    return out;
  }
  // a box building: footprint (x, y, w, h), roof shifted by o. opts: wall, roof, line, accent, ridge ('h'|'v'), lw
  function box(c, x, y, w, h, o, opts) {
    var line = opts.line || '#1b1b1b', lw = opts.lw || 1;
    c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = line;
    if (opts.shadow !== false) { c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(x + o.x * 0.35, y + o.y * 0.35, w, h); }
    walls(x, y, w, h, o).forEach(function (wl) { poly(c, wl.p); c.fillStyle = shade(opts.wall || '#e8e0cc', wl.tone); c.fill(); c.stroke(); });
    var rx = x + o.x, ry = y + o.y, spr = opts.sprite && sprites[opts.sprite];
    if (spr && spr.ok) { c.drawImage(spr.img, rx, ry, w, h); if (opts.lw) c.strokeRect(rx + 0.5 * lw, ry + 0.5 * lw, w - lw, h - lw); return { x: rx, y: ry }; }   // v0.5 outline the sprites too
    c.fillStyle = opts.roof || '#c96a4a'; c.fillRect(rx, ry, w, h); c.strokeRect(rx + 0.5 * lw, ry + 0.5 * lw, w - lw, h - lw);
    if (opts.ridge) {          // pitched roof: ridge line, one half a touch darker
      c.fillStyle = 'rgba(0,0,0,0.14)';
      if (opts.ridge === 'h') { c.fillRect(rx, ry + h / 2, w, h / 2); c.beginPath(); c.moveTo(rx, ry + h / 2); c.lineTo(rx + w, ry + h / 2); c.stroke(); }
      else { c.fillRect(rx + w / 2, ry, w / 2, h); c.beginPath(); c.moveTo(rx + w / 2, ry); c.lineTo(rx + w / 2, ry + h); c.stroke(); }
    }
    if (opts.accent) { c.fillStyle = opts.accent; var a = Math.max(1.5, Math.min(w, h) * 0.22); c.fillRect(rx + w / 2 - a / 2, ry + h / 2 - a / 2, a, a); c.strokeRect(rx + w / 2 - a / 2, ry + h / 2 - a / 2, a, a); }
    return { x: rx, y: ry };
  }
  function useSprite(kind, src) {
    var img = typeof src === 'string' ? new Image() : src, s = sprites[kind] = { img: img, ok: false };
    var done = function () { s.ok = true; api.ver++; listeners.forEach(function (f) { f(kind); }); };
    if (typeof src === 'string') { img.onload = done; img.src = src; } else if (img.complete !== false) done(); else img.onload = done;
  }
  function onChange(f) { listeners.push(f); }
  var api = root.RDRArt = { ver: 0, offset: offset, walls: walls, box: box, shade: shade, useSprite: useSprite, onChange: onChange, lean: lean, setLean: function (v) { A.lean = v; api.ver++; listeners.forEach(function (f) { f('lean'); }); } };
})(typeof window !== 'undefined' ? window : globalThis);
