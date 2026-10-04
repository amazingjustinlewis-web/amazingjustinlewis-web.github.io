/* ZOMBIE TILES - character sprites (v0.4): walk cycles + idle bobs for players and zombies.
   SHEET FORMAT (so you can draw your own; see assets/sprites/README.md):
     one PNG per character type, frames of FRAME x FRAME pixels (default 32x32), 6 columns x 4 rows (192 x 128 px):
       columns: 0-1 = idle (2 frames), 2-5 = walk cycle (4 frames)
       rows:    0 = facing down (toward the TV viewer), 1 = left, 2 = right, 3 = up
     Player sheet: paint the parts that should take the player's colour in pure magenta #FF00FF
       (and a darker shade in #800080); the game swaps them for each player's colour. Everything else is kept.
     Zombie sheet: drawn as-is. Transparent background. Character's feet near the bottom middle of the frame.
   Set C.sprites.player / C.sprites.zombie in js/config.js to your PNG paths. Until then these placeholders are drawn in code. */
(function (root) {
  'use strict';
  var C = root.ZT_CONFIG, CFG = (C && C.sprites) || {};
  var F = CFG.frame || 32, COLS = 6, ROWS = 4;
  var KEY = [255, 0, 255], KEY2 = [128, 0, 128];
  var sheets = { player: null, zombie: null }, tinted = {};

  function mk(w, h) { var c = typeof document !== 'undefined' ? document.createElement('canvas') : null; if (c) { c.width = w; c.height = h; } return c; }
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  // little pixel helpers in frame space (32x32 design; scaled if FRAME differs)
  function head(c, x, y, skin, hair, dir) {
    px(c, x + 2, y, 6, 1, hair); px(c, x + 1, y + 1, 8, 1, hair); px(c, x, y + 2, 10, 5, skin); px(c, x + 1, y + 7, 8, 1, skin);
    if (dir === 3) { px(c, x, y + 2, 10, 5, hair); px(c, x + 1, y + 7, 8, 1, hair); return; }       // back of the head
    px(c, x, y + 2, 10, 2, hair);
    if (dir === 0) { px(c, x + 2, y + 4, 2, 2, '#1a1420'); px(c, x + 6, y + 4, 2, 2, '#1a1420'); }
    else if (dir === 1) { px(c, x + 5, y + 2, 5, 3, hair); px(c, x + 1, y + 4, 2, 2, '#1a1420'); px(c, x - 1, y + 5, 1, 1, skin); }
    else { px(c, x, y + 2, 5, 3, hair); px(c, x + 7, y + 4, 2, 2, '#1a1420'); px(c, x + 10, y + 5, 1, 1, skin); }
  }
  function drawPlayerFrame(c, ox, oy, dir, col) {
    var walk = col >= 2, f = walk ? col - 2 : col, sw = walk ? [0, 1, 0, -1][f] : 0, bob = walk ? (f % 2 ? -1 : 0) : (f ? 1 : 0);
    var M = '#ff00ff', M2 = '#800080', SK = '#f2c9a0', HR = '#5b3a1e', SH = '#2a2235';
    c.save(); c.translate(ox, oy);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(16, 28, 8, 2.5, 0, 0, 7); c.fill();
    if (dir === 0 || dir === 3) {
      px(c, 11, 23 + sw, 4, 4, SH); px(c, 17, 23 - sw, 4, 4, SH);                          // feet step forward/back
      px(c, 7, 15 + bob - sw, 3, 6, M2); px(c, 22, 15 + bob + sw, 3, 6, M2);                // arms swing
      px(c, 7, 20 + bob - sw, 3, 2, SK); px(c, 22, 20 + bob + sw, 3, 2, SK);
      px(c, 10, 14 + bob, 12, 10, M); px(c, 10, 14 + bob, 1, 10, M2); px(c, 21, 14 + bob, 1, 10, M2); px(c, 10, 23 + bob, 12, 1, M2);
      head(c, 11, 4 + bob, SK, HR, dir);
    } else {
      var s = dir === 1 ? -1 : 1;
      px(c, 13 + sw * 2, 23, 4, 4, SH); px(c, 15 - sw * 2, 23, 4, 4, SH);                  // legs stride sideways
      px(c, 11, 14 + bob, 10, 10, M); px(c, 11, 23 + bob, 10, 1, M2); px(c, dir === 1 ? 20 : 11, 14 + bob, 1, 10, M2);
      px(c, 14 - sw * 2 * s, 16 + bob, 4, 6, M2); px(c, 14 - sw * 2 * s, 21 + bob, 4, 2, SK); // front arm swings
      head(c, 11, 4 + bob, SK, HR, dir);
    }
    c.restore();
  }
  function drawZombieFrame(c, ox, oy, dir, col) {
    var walk = col >= 2, f = walk ? col - 2 : col, sway = walk ? [-1, 0, 1, 0][f] : (f ? 1 : 0), drag = walk ? [0, 1, 2, 1][f] : 0;
    var SK = '#8fb35a', SK2 = '#6d8f3e', SHT = '#5d6b8a', SHT2 = '#46516b', PN = '#3b3f4f', EY = '#e8ff7a';
    c.save(); c.translate(ox + sway, oy);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(16 - sway, 28, 8, 2.5, 0, 0, 7); c.fill();
    if (dir === 0 || dir === 3) {
      px(c, 11, 23, 4, 4, PN); px(c, 17, 23 - drag, 4, 4 + drag, PN);                        // one foot drags
      px(c, 10, 14, 12, 10, SHT); px(c, 13, 21, 3, 3, SHT2); px(c, 18, 15, 2, 4, SHT2);       // torn shirt
      if (dir === 0) { px(c, 8, 16, 3, 9, SK); px(c, 21, 16, 3, 9, SK); px(c, 8, 24, 3, 1, SK2); px(c, 21, 24, 3, 1, SK2); }   // arms reach toward you
      else { px(c, 8, 7, 3, 9, SK); px(c, 21, 7, 3, 9, SK); }
      px(c, 11, 4, 10, 9, SK); px(c, 12, 3, 8, 1, SK2); px(c, 11, 4, 3, 2, SK2);
      if (dir === 0) { px(c, 13, 7, 2, 2, EY); px(c, 17, 7, 2, 2, EY); px(c, 14, 11, 4, 1, '#2a2a1a'); }
      else px(c, 15, 6, 3, 3, SK2);
    } else {
      var s = dir === 1 ? -1 : 1, fx = dir === 1 ? 2 : 20;
      px(c, 13, 23, 4, 4, PN); px(c, 16 - drag * s, 23, 4, 4, PN);
      px(c, 11, 14, 10, 10, SHT); px(c, 13, 20, 3, 3, SHT2);
      px(c, fx, 15, 10, 3, SK); px(c, fx, 19, 10, 3, SK);                                     // both arms stretched forward
      px(c, 11, 4, 10, 9, SK); px(c, dir === 1 ? 17 : 11, 4, 4, 3, SK2);
      px(c, dir === 1 ? 12 : 18, 7, 2, 2, EY); px(c, dir === 1 ? 11 : 19, 11, 2, 1, '#2a2a1a');
    }
    c.restore();
  }
  function genSheet(fn) {
    var c = mk(COLS * 32, ROWS * 32); if (!c) return null;
    var x = c.getContext('2d');
    for (var r = 0; r < ROWS; r++) for (var col = 0; col < COLS; col++) fn(x, col * 32, r * 32, r, col);
    if (F === 32) return c;
    var s = mk(COLS * F, ROWS * F), sx = s.getContext('2d'); sx.imageSmoothingEnabled = false; sx.drawImage(c, 0, 0, s.width, s.height); return s;
  }
  function hexRgb(h) { var n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function tint(sheet, color) {                    // palette swap: #FF00FF -> colour, #800080 -> darker colour
    var c = mk(sheet.width, sheet.height), x = c.getContext('2d'); x.drawImage(sheet, 0, 0);
    try {
      var im = x.getImageData(0, 0, c.width, c.height), d = im.data, a = hexRgb(color), b = a.map(function (v) { return Math.round(v * 0.62); });
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 8) continue;
        if (d[i] === KEY[0] && d[i + 1] === KEY[1] && d[i + 2] === KEY[2]) { d[i] = a[0]; d[i + 1] = a[1]; d[i + 2] = a[2]; }
        else if (d[i] === KEY2[0] && d[i + 1] === KEY2[1] && d[i + 2] === KEY2[2]) { d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; }
      }
      x.putImageData(im, 0, 0);
    } catch (e) {}                                   // (tainted canvas from file://: keep the untinted sheet)
    return c;
  }
  function load(kind, src) {
    if (!src || typeof Image === 'undefined') return;
    var im = new Image();
    im.onload = function () { if (im.width >= COLS * F && im.height >= ROWS * F) { sheets[kind] = im; tinted = {}; } };
    im.src = src;
  }
  var S = {
    FRAME: F, COLS: COLS, ROWS: ROWS, DIR: { down: 0, left: 1, right: 2, up: 3 },
    enabled: CFG.enabled !== false,
    init: function () {
      if (sheets.player || typeof document === 'undefined') return;
      sheets.player = genSheet(drawPlayerFrame); sheets.zombie = genSheet(drawZombieFrame);
      load('player', CFG.player); load('zombie', CFG.zombie);
    },
    // frame index for an animation state: moving -> walk cycle at fps, idle -> slow 2-frame bob
    frameFor: function (moving, walkT, now, seed) { return moving ? 2 + (Math.floor(walkT * (CFG.walkFps || 12)) % 4) : (Math.floor((now / (CFG.idleMs || 520)) + (seed || 0)) % 2); },
    draw: function (ctx, kind, color, dir, frame, x, y, size, flip) {
      S.init();
      var sh = sheets[kind]; if (!sh) return false;
      if (kind === 'player') { var k = color + '|' + (sh.src || 'gen'); sh = tinted[k] || (tinted[k] = tint(sh, color)); }
      var fw = sh.width / COLS, fh = sh.height / ROWS;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      if (flip) { ctx.translate(x, y); ctx.rotate(Math.PI); ctx.drawImage(sh, frame * fw, (dir || 0) * fh, fw, fh, -size / 2, -size / 2, size, size); }
      else ctx.drawImage(sh, frame * fw, (dir || 0) * fh, fw, fh, x - size / 2, y - size / 2, size, size);
      ctx.restore();
      return true;
    },
    sheet: function (kind) { S.init(); return sheets[kind]; }
  };
  root.ZTSprites = S;
})(typeof window !== 'undefined' ? window : globalThis);
