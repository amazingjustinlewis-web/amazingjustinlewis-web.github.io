/* RED DEER RICH - TV board renderer (v0.1, placeholder art drawn in code).
   Static tiles are cached on an offscreen canvas and only redrawn when ownership/Shops change.
   Per frame: living-board bits (walkers, cars, the Upper Level Youth Centre band), tokens, day/night tint.
   Graphics rung (Auto-Crush): 0 full ... 6 flat tiles. Gameplay visuals (tokens, highlights) are never crushed. */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG, B = root.RDR_BOARD, S = B.SPACES, LV = C.living;
  var charById = function (id) { for (var i = 0; i < C.characters.length; i++) if (C.characters[i].id === id) return C.characters[i]; return C.characters[0]; };

  function R(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.g = game; this.rung = 0; this.vis = {}; this.bubbles = []; this.fx = [];
    this.staticCv = document.createElement('canvas'); this.staticKey = '';
    this.ycCv = document.createElement('canvas'); this.ycKey = '';
    this.walkers = []; this.cars = []; this.walkT = 0; this.cycleStart = Date.now() - 60000;
    this.dpr = 1; this.W = 0; this.H = 0;
  }
  var P = R.prototype;
  P.layout = function (W, H, box, dprCap) {
    this.W = W; this.H = H;
    this.dpr = Math.min(root.devicePixelRatio || 1, dprCap || 1.5);
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    var Sz = Math.floor(box.size);
    this.bx = Math.round(box.x); this.by = Math.round(box.y); this.S = Sz;
    this.cs = Math.round(Sz * 0.13); this.w = (Sz - 2 * this.cs) / 9;
    this.staticKey = ''; this.ycKey = '';
    this.initLiving();
  };
  // rectangle of space i in board-local coords + which side faces the middle
  P.rect = function (i) {
    var S0 = this.S, cs = this.cs, w = this.w;
    if (i === 0) return { x: S0 - cs, y: S0 - cs, w: cs, h: cs, side: 'corner' };
    if (i < 10) return { x: S0 - cs - i * w, y: S0 - cs, w: w, h: cs, side: 'b' };
    if (i === 10) return { x: 0, y: S0 - cs, w: cs, h: cs, side: 'corner' };
    if (i < 20) return { x: 0, y: S0 - cs - (i - 10) * w, w: cs, h: w, side: 'l' };
    if (i === 20) return { x: 0, y: 0, w: cs, h: cs, side: 'corner' };
    if (i < 30) return { x: cs + (i - 21) * w, y: 0, w: w, h: cs, side: 't' };
    if (i === 30) return { x: S0 - cs, y: 0, w: cs, h: cs, side: 'corner' };
    return { x: S0 - cs, y: cs + (i - 31) * w, w: cs, h: w, side: 'r' };
  };
  P.center = function (i) { var r = this.rect(i); return { x: this.bx + r.x + r.w / 2, y: this.by + r.y + r.h / 2 }; };

  // ------------------------------------------------------------------ helpers
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function wrap(c, text, maxW) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function lerpC(a, b, t) {
    var pa = [parseInt(a.substr(1, 2), 16), parseInt(a.substr(3, 2), 16), parseInt(a.substr(5, 2), 16)], pb = [parseInt(b.substr(1, 2), 16), parseInt(b.substr(3, 2), 16), parseInt(b.substr(5, 2), 16)];
    return 'rgb(' + pa.map(function (v, k) { return Math.round(v + (pb[k] - v) * t); }).join(',') + ')';
  }
  P.money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };

  // ------------------------------------------------------------------ static layer
  P.propsKey = function () {
    var g = this.g;
    return [this.S, this.rung >= 6 ? 'flat' : 'full', g.rules.jackpot ? g.pot : '-', JSON.stringify(g.props), g.players.map(function (p) { return p.id + p.color; }).join()].join('|');
  };
  P.drawStatic = function () {
    var key = this.propsKey(); if (key === this.staticKey) return;
    this.staticKey = key;
    var cv = this.staticCv, d = this.dpr, S0 = this.S;
    cv.width = Math.round(S0 * d); cv.height = Math.round(S0 * d);
    var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
    var flat = this.rung >= 6;
    // inner city
    var cs = this.cs, inner = S0 - 2 * cs;
    c.fillStyle = '#20301f'; c.fillRect(0, 0, S0, S0);
    var gr = c.createLinearGradient(0, cs, 0, S0 - cs); gr.addColorStop(0, flat ? '#d9d2b0' : '#e8dca6'); gr.addColorStop(1, flat ? '#cfd8b0' : '#bcd49a');
    c.fillStyle = gr; c.fillRect(cs, cs, inner, inner);
    if (!flat) this.drawInnerArt(c, cs, inner);
    this.drawCentre(c, cs, inner, flat);
    for (var i = 0; i < 40; i++) this.drawTile(c, i, flat);
    c.strokeStyle = '#1b1b1b'; c.lineWidth = 2; c.strokeRect(1, 1, S0 - 2, S0 - 2); c.strokeRect(cs, cs, inner, inner);
  };
  P.drawInnerArt = function (c, cs, inner) {
    var x0 = cs, y0 = cs, k = inner;
    // the Red Deer River winding through the middle, parks along it
    c.save(); c.beginPath(); c.rect(x0, y0, k, k); c.clip();
    c.fillStyle = '#9cc77a';
    [[0.18, 0.72, 0.13], [0.42, 0.58, 0.09], [0.7, 0.86, 0.11], [0.12, 0.25, 0.08]].forEach(function (p) { c.beginPath(); c.ellipse(x0 + p[0] * k, y0 + p[1] * k, p[2] * k * 1.4, p[2] * k, 0.4, 0, Math.PI * 2); c.fill(); });
    c.strokeStyle = '#5fa8d8'; c.lineWidth = k * 0.045; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0 - 10, y0 + k * 0.35); c.bezierCurveTo(x0 + k * 0.3, y0 + k * 0.2, x0 + k * 0.25, y0 + k * 0.8, x0 + k * 0.55, y0 + k * 0.72);
    c.bezierCurveTo(x0 + k * 0.8, y0 + k * 0.66, x0 + k * 0.75, y0 + k * 1.0, x0 + k * 1.05, y0 + k * 0.95); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = k * 0.008; c.stroke();
    // little city grid downtown (right side) + road ring
    c.strokeStyle = 'rgba(80,70,60,0.18)'; c.lineWidth = 1;
    for (var gx = 0.62; gx < 0.98; gx += 0.06) { c.beginPath(); c.moveTo(x0 + gx * k, y0 + k * 0.08); c.lineTo(x0 + gx * k, y0 + k * 0.5); c.stroke(); }
    for (var gy = 0.1; gy < 0.5; gy += 0.06) { c.beginPath(); c.moveTo(x0 + k * 0.6, y0 + gy * k); c.lineTo(x0 + k * 0.97, y0 + gy * k); c.stroke(); }
    var ri = this.ringInset('road');
    c.strokeStyle = 'rgba(70,70,78,0.55)'; c.lineWidth = Math.max(4, k * 0.022); c.lineCap = 'butt';
    c.strokeRect(x0 + ri, y0 + ri, k - 2 * ri, k - 2 * ri);
    c.strokeStyle = 'rgba(255,230,120,0.5)'; c.lineWidth = 1; c.setLineDash([6, 6]); c.strokeRect(x0 + ri, y0 + ri, k - 2 * ri, k - 2 * ri); c.setLineDash([]);
    var si = this.ringInset('walk');
    c.strokeStyle = 'rgba(235,228,210,0.8)'; c.lineWidth = Math.max(3, k * 0.014); c.strokeRect(x0 + si, y0 + si, k - 2 * si, k - 2 * si);
    c.restore();
  };
  P.ringInset = function (kind) { var k = this.S - 2 * this.cs; return kind === 'road' ? k * 0.055 : k * 0.018; };
  P.drawCentre = function (c, cs, inner, flat) {
    var cx = cs + inner * 0.42, cy = cs + inner * 0.5, k = inner;
    c.save(); c.translate(cx, cy); c.rotate(-0.12);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 ' + Math.round(k * 0.105) + 'px Fredoka, system-ui, sans-serif';
    c.lineWidth = k * 0.022; c.strokeStyle = '#3a1a00'; c.lineJoin = 'round';
    c.strokeText('RED DEER', 0, -k * 0.06); c.fillStyle = '#d8262f'; c.fillText('RED DEER', 0, -k * 0.06);
    c.font = '900 ' + Math.round(k * 0.125) + 'px Fredoka, system-ui, sans-serif';
    c.strokeText('RICH', 0, k * 0.065); c.fillStyle = '#f2c230'; c.fillText('RICH', 0, k * 0.065);
    c.font = '600 ' + Math.round(k * 0.026) + 'px Fredoka, system-ui, sans-serif'; c.fillStyle = '#3a2a10';
    c.fillText('a Zero to Phi game \u00b7 first playable v0.1', 0, k * 0.15);
    c.restore();
    // card decks
    var dw = k * 0.17, dh = k * 0.11;
    [['HAILSTONE', '#4a6a8a', '#cfe4f5', cs + k * 0.14, cs + k * 0.12, 0.2], ['POTLUCK', '#c8642a', '#ffe1b8', cs + k * 0.48, cs + k * 0.8, -0.15]].forEach(function (d) {
      c.save(); c.translate(d[3] + dw / 2, d[4] + dh / 2); c.rotate(d[5]);
      for (var s = 2; s >= 0; s--) { rr(c, -dw / 2 + s * 2, -dh / 2 + s * 2, dw, dh, 6); c.fillStyle = s ? 'rgba(0,0,0,0.25)' : d[1]; c.fill(); }
      c.strokeStyle = d[2]; c.lineWidth = 2; rr(c, -dw / 2 + 4, -dh / 2 + 4, dw - 8, dh - 8, 4); c.stroke();
      c.fillStyle = d[2]; c.font = '800 ' + Math.round(dh * 0.24) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d[0], 0, 0);
      c.restore();
    });
    if (this.g.rules.jackpot) {
      c.fillStyle = 'rgba(60,40,10,0.85)'; rr(c, cs + 6, cs + 6, k * 0.24, k * 0.07, 8); c.fill();
      c.fillStyle = '#ffd84a'; c.font = '800 ' + Math.round(k * 0.03) + 'px Fredoka, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('DIRT LOT POT ' + this.money(this.g.pot), cs + 14, cs + 6 + k * 0.035);
    }
  };
  P.drawTile = function (c, i, flat) {
    var r = this.rect(i), s = S[i], g = this.g, pr = g.props[i];
    c.save(); c.translate(r.x, r.y);
    c.fillStyle = flat ? '#f3eedd' : '#f7f0da'; c.fillRect(0, 0, r.w, r.h);
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, r.w - 1, r.h - 1);
    if (r.side === 'corner') { this.drawCorner(c, i, r, flat); c.restore(); return; }
    var horiz = r.side === 'b' || r.side === 't', bt = this.cs * 0.22;
    // band on the inner side
    var band = null;
    if (r.side === 'b') band = [0, 0, r.w, bt]; else if (r.side === 't') band = [0, r.h - bt, r.w, bt];
    else if (r.side === 'l') band = [r.w - bt, 0, bt, r.h]; else band = [0, 0, bt, r.h];
    var gcol = s.group ? B.GROUPS[s.group].color : null;
    if (s.type === 'prop') { c.fillStyle = gcol; c.fillRect(band[0], band[1], band[2], band[3]); c.strokeRect(band[0] + .5, band[1] + .5, band[2] - 1, band[3] - 1); }
    // text area
    var ta = r.side === 'b' ? [0, bt, r.w, r.h - bt] : r.side === 't' ? [0, 0, r.w, r.h - bt] : r.side === 'l' ? [0, 0, r.w - bt, r.h] : [bt, 0, r.w - bt, r.h];
    var fs = Math.max(8, Math.round(this.w * 0.15));
    c.fillStyle = '#1d1d1d'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.font = '700 ' + fs + 'px Fredoka, system-ui, sans-serif';
    var label = s.type === 'potluck' ? 'POTLUCK' : s.type === 'hail' ? 'HAIL-STONE' : s.short;
    var lines = wrap(c, label, ta[2] - 6).slice(0, 3);
    var iconH = (s.type === 'prop') ? 0 : Math.min(ta[2], ta[3]) * 0.34;
    var ty = ta[1] + (horiz ? 5 : (ta[3] - lines.length * fs * 1.05 - iconH - fs) / 2);
    lines.forEach(function (ln, k) { c.fillText(ln, ta[0] + ta[2] / 2, ty + k * fs * 1.05); });
    // icon for special spaces
    var icx = ta[0] + ta[2] / 2, icy = ty + lines.length * fs * 1.05 + iconH * 0.62;
    if (!flat) this.icon(c, s, icx, icy, iconH);
    // price / amount at the outer side
    c.font = '600 ' + Math.max(7, Math.round(fs * 0.9)) + 'px Fredoka, sans-serif'; c.textBaseline = 'bottom'; c.fillStyle = '#333';
    var priceTxt = s.price ? this.money(s.price) : s.type === 'tax' ? 'PAY ' + this.money(s.amount) : '';
    var py = horiz ? (r.side === 'b' ? r.h - 3 : ta[1] + ta[3] - 3) : ta[3] - 3;
    if (r.side === 't') py = ta[3] - 3;
    if (priceTxt) c.fillText(priceTxt, ta[0] + ta[2] / 2, py);
    // ownership: owner-colour strip on the outer edge + Shops on the band
    if (pr && pr.owner >= 0) {
      var o = g.byId(pr.owner), oc = o ? o.color : '#888', th = Math.max(4, this.w * 0.09);
      c.fillStyle = oc;
      if (r.side === 'b') c.fillRect(0, r.h - th, r.w, th); else if (r.side === 't') c.fillRect(0, 0, r.w, th);
      else if (r.side === 'l') c.fillRect(0, 0, th, r.h); else c.fillRect(r.w - th, 0, th, r.h);
      c.strokeStyle = '#fff'; c.lineWidth = 1;
      if (pr.shops > 0) this.drawShops(c, band, pr.shops, horiz);
      if (pr.hocked) {
        c.fillStyle = 'rgba(40,40,50,0.55)'; c.fillRect(0, 0, r.w, r.h);
        c.save(); c.translate(r.w / 2, r.h / 2); c.rotate(horiz ? -Math.PI / 2.6 : -0.3);
        c.fillStyle = '#fff'; c.font = '800 ' + Math.max(8, Math.round(fs * 0.95)) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HOCKED', 0, 0); c.restore();
      }
    } else if (pr && !flat && s.type === 'prop') {          // unowned: a tiny FOR SALE sign
      var fx = r.side === 'r' ? ta[0] + ta[2] - 8 : r.side === 'l' ? ta[0] + 8 : ta[0] + ta[2] - 7, fy = horiz ? (r.side === 'b' ? r.h - fs * 1.4 : fs * 0.9) : ta[3] - fs * 1.2;
      c.fillStyle = '#7a5a3a'; c.fillRect(fx - 0.5, fy, 1.5, fs * 0.6); c.fillStyle = '#fff'; c.fillRect(fx - 4, fy - 3, 8, 5); c.fillStyle = '#d8262f'; c.fillRect(fx - 4, fy - 3, 8, 1.6);
    }
    c.restore();
  };
  P.drawShops = function (c, band, n, horiz) {
    var bx = band[0], by = band[1], bw = band[2], bh = band[3];
    if (n === 5) {      // Mega-Plex
      var mw = horiz ? bw * 0.62 : bw * 0.75, mh = horiz ? bh * 0.75 : bh * 0.62;
      c.fillStyle = '#c0182a'; rr(c, bx + (bw - mw) / 2, by + (bh - mh) / 2, mw, mh, 3); c.fill(); c.strokeStyle = '#ffd84a'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#ffd84a'; c.font = '800 ' + Math.max(7, Math.round(Math.min(mw, mh) * 0.5)) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MP', bx + bw / 2, by + bh / 2 + 1);
      return;
    }
    for (var k = 0; k < n; k++) {
      var sz = horiz ? Math.min(bw / 4.6, bh * 0.7) : Math.min(bh / 4.6, bw * 0.7);
      var x = horiz ? bx + 3 + k * (bw - 6) / 4 + ((bw - 6) / 4 - sz) / 2 : bx + (bw - sz) / 2;
      var y = horiz ? by + (bh - sz) / 2 : by + 3 + k * (bh - 6) / 4 + ((bh - 6) / 4 - sz) / 2;
      c.fillStyle = '#1f9d47'; c.fillRect(x, y + sz * 0.3, sz, sz * 0.7);
      c.beginPath(); c.moveTo(x - 1, y + sz * 0.32); c.lineTo(x + sz / 2, y); c.lineTo(x + sz + 1, y + sz * 0.32); c.closePath(); c.fill();
      c.strokeStyle = '#0b3d1b'; c.lineWidth = 1; c.strokeRect(x, y + sz * 0.3, sz, sz * 0.7);
    }
  };
  P.icon = function (c, s, x, y, h) {
    c.save(); c.translate(x, y); var k = h / 2;
    if (s.type === 'whistle') {      // little steam engine
      c.fillStyle = '#2b2b33'; c.fillRect(-k, -k * 0.2, k * 1.6, k * 0.8); c.fillRect(k * 0.2, -k * 0.75, k * 0.6, k * 0.6); c.fillRect(-k * 0.8, -k * 0.7, k * 0.3, k * 0.5);
      c.fillStyle = '#d8262f'; c.fillRect(k * 0.6, -k * 0.2, k * 0.25, k * 0.8);
      c.fillStyle = '#555'; [-0.6, 0, 0.5].forEach(function (wx) { c.beginPath(); c.arc(wx * k, k * 0.7, k * 0.25, 0, 7); c.fill(); });
    } else if (s.type === 'juice') {
      if (s.name === 'The Spheroid') { c.fillStyle = '#9fb3c4'; c.fillRect(-k * 0.12, -k * 0.1, k * 0.24, k * 1.05); c.beginPath(); c.arc(0, -k * 0.35, k * 0.6, 0, 7); c.fillStyle = '#c7d7e4'; c.fill(); c.strokeStyle = '#56708a'; c.lineWidth = 1.2; c.stroke(); }
      else { c.fillStyle = '#f2c230'; c.beginPath(); c.moveTo(k * 0.2, -k); c.lineTo(-k * 0.5, k * 0.1); c.lineTo(0, k * 0.1); c.lineTo(-k * 0.2, k); c.lineTo(k * 0.55, -k * 0.15); c.lineTo(k * 0.05, -k * 0.15); c.closePath(); c.fill(); c.strokeStyle = '#7a5a00'; c.lineWidth = 1; c.stroke(); }
    } else if (s.type === 'hail') {
      c.fillStyle = '#7f95ab'; c.beginPath(); c.arc(-k * 0.35, -k * 0.2, k * 0.45, 0, 7); c.arc(k * 0.25, -k * 0.35, k * 0.55, 0, 7); c.arc(k * 0.6, -k * 0.05, k * 0.35, 0, 7); c.fill();
      c.fillStyle = '#e8f4ff'; [[-0.5, 0.5], [0, 0.75], [0.45, 0.5], [-0.15, 0.95]].forEach(function (p) { c.beginPath(); c.arc(p[0] * k, p[1] * k, k * 0.14, 0, 7); c.fill(); });
    } else if (s.type === 'potluck') {
      c.fillStyle = '#c8642a'; rr(c, -k * 0.9, -k * 0.2, k * 1.8, k * 0.8, k * 0.25); c.fill(); c.fillStyle = '#ffd59a'; c.beginPath(); c.ellipse(0, -k * 0.2, k * 0.85, k * 0.25, 0, 0, 7); c.fill();
      c.fillStyle = '#7a3a12'; c.fillRect(-k * 1.1, -k * 0.05, k * 0.25, k * 0.15); c.fillRect(k * 0.85, -k * 0.05, k * 0.25, k * 0.15);
    } else if (s.type === 'tax') {
      if (s.amount === 90) { c.fillStyle = '#444'; c.fillRect(-k * 0.08, -k * 0.2, k * 0.16, k * 1.1); rr(c, -k * 0.45, -k, k * 0.9, k * 0.9, 4); c.fill(); c.fillStyle = '#7cf0ff'; c.fillRect(-k * 0.3, -k * 0.85, k * 0.6, k * 0.35); c.fillStyle = '#ff3030'; c.beginPath(); c.arc(0, -k * 0.28, k * 0.1, 0, 7); c.fill(); }
      else { c.fillStyle = '#fff'; c.strokeStyle = '#333'; c.lineWidth = 1; c.fillRect(-k * 0.7, -k * 0.8, k * 1.4, k * 1.6); c.strokeRect(-k * 0.7, -k * 0.8, k * 1.4, k * 1.6); c.fillStyle = '#999'; for (var l = 0; l < 4; l++) c.fillRect(-k * 0.5, -k * 0.55 + l * k * 0.35, k * (l === 3 ? 0.5 : 1), k * 0.12); c.fillStyle = '#d8262f'; c.fillRect(k * 0.1, k * 0.5, k * 0.4, k * 0.15); }
    }
    c.restore();
  };
  P.drawCorner = function (c, i, r, flat) {
    var w = r.w, fs = Math.max(9, Math.round(w * 0.105));
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (i === 0) {        // THE HALFWAY: highway sign
      c.fillStyle = '#e9f0e0'; c.fillRect(1, 1, w - 2, w - 2);
      c.fillStyle = '#1f6f3a'; rr(c, w * 0.08, w * 0.2, w * 0.84, w * 0.42, 6); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; rr(c, w * 0.11, w * 0.23, w * 0.78, w * 0.36, 4); c.stroke();
      c.fillStyle = '#fff'; c.font = '700 ' + Math.round(fs * 0.62) + 'px Fredoka, sans-serif';
      c.fillText('\u2190 Calgary    Edmonton \u2192', w / 2, w * 0.3);
      c.font = '900 ' + Math.round(fs * 1.05) + 'px Fredoka, sans-serif'; c.fillText('RED DEER', w / 2, w * 0.46);
      c.fillStyle = '#5a4a30'; c.fillRect(w * 0.3, w * 0.62, w * 0.05, w * 0.1); c.fillRect(w * 0.65, w * 0.62, w * 0.05, w * 0.1);
      c.fillStyle = '#1d1d1d'; c.font = '900 ' + fs + 'px Fredoka, sans-serif'; c.fillText('THE HALFWAY', w / 2, w * 0.1);
      c.font = '700 ' + Math.round(fs * 0.8) + 'px Fredoka, sans-serif'; c.fillStyle = '#1f6f3a'; c.fillText('COLLECT $250', w / 2, w * 0.82);
      c.fillStyle = '#d8262f'; c.font = '900 ' + Math.round(fs * 1.2) + 'px Fredoka, sans-serif'; c.fillText('\u2190', w / 2, w * 0.93);
    } else if (i === 10) {   // STUCK IN THE SNOWBANK / Just Driving By (outer strip on the left and bottom)
      var st = w * 0.27;
      c.fillStyle = '#f2ead6'; c.fillRect(0, 0, w, w);
      c.fillStyle = '#eaf4ff'; c.fillRect(st, 0, w - st, w - st);
      if (!flat) {
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(st, w - st); c.quadraticCurveTo(st + (w - st) * 0.3, w * 0.38, st + (w - st) * 0.6, w * 0.5); c.quadraticCurveTo(w * 0.95, w * 0.45, w, w * 0.55); c.lineTo(w, w - st); c.closePath(); c.fill();
        c.fillStyle = '#b3122b'; c.save(); c.translate(st + (w - st) * 0.5, w * 0.52); c.rotate(0.5); rr(c, -w * 0.16, -w * 0.06, w * 0.32, w * 0.12, 4); c.fill(); c.fillStyle = '#9fd3ff'; c.fillRect(-w * 0.06, -w * 0.05, w * 0.1, w * 0.05); c.restore();
        c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(st + (w - st) * 0.62, w * 0.6, w * 0.22, w * 0.08, -0.2, 0, 7); c.fill();
      }
      c.strokeStyle = '#2a2a2a'; c.strokeRect(st, 0, w - st, w - st);
      c.fillStyle = '#103a6a'; c.font = '900 ' + Math.round(fs * 0.8) + 'px Fredoka, sans-serif'; c.fillText('STUCK IN THE', st + (w - st) / 2, w * 0.1); c.fillText('SNOWBANK', st + (w - st) / 2, w * 0.2);
      c.save(); c.translate(st / 2, (w - st) / 2); c.rotate(-Math.PI / 2); c.fillStyle = '#333'; c.font = 'italic 700 ' + Math.round(fs * 0.7) + 'px Fredoka, sans-serif'; c.fillText('Just', 0, 0); c.restore();
      c.font = 'italic 700 ' + Math.round(fs * 0.7) + 'px Fredoka, sans-serif'; c.fillStyle = '#333'; c.fillText('Driving By', w * 0.58, w - st / 2);
    } else if (i === 20) {   // THE SECRET DIRT LOT
      c.fillStyle = '#d9cfae'; c.fillRect(1, 1, w - 2, w - 2);
      c.fillStyle = '#1d1d1d'; c.font = '900 ' + Math.round(fs * 0.85) + 'px Fredoka, sans-serif'; c.fillText('THE SECRET', w / 2, w * 0.1); c.fillText('DIRT LOT', w / 2, w * 0.2);
      if (!flat) {
        c.fillStyle = '#5f8f3a'; [[0.12, 0.5], [0.88, 0.45], [0.1, 0.85], [0.9, 0.86]].forEach(function (p) { c.beginPath(); c.arc(p[0] * w, p[1] * w, w * 0.1, 0, 7); c.fill(); });
        c.fillStyle = '#8a6a42'; c.beginPath(); c.ellipse(w / 2, w * 0.62, w * 0.3, w * 0.2, 0, 0, 7); c.fill();
        c.strokeStyle = 'rgba(60,40,20,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.3, w * 0.7); c.lineTo(w * 0.65, w * 0.5); c.moveTo(w * 0.35, w * 0.76); c.lineTo(w * 0.7, w * 0.56); c.stroke();
        c.fillStyle = '#9a3a20'; c.fillRect(w * 0.48, w * 0.6, w * 0.2, w * 0.08); c.fillStyle = '#5a2a10'; c.fillRect(w * 0.5, w * 0.56, w * 0.1, w * 0.05);   // the rusted truck
        c.strokeStyle = '#2a6aa8'; c.lineWidth = 1.5; c.strokeRect(w * 0.3, w * 0.58, w * 0.08, w * 0.07);            // lawn chair
        [[0.24, 0.32], [0.5, 0.28], [0.76, 0.32], [0.2, 0.78], [0.8, 0.76]].forEach(function (p) {          // looming digital meters, red eyes
          var mx = p[0] * w, my = p[1] * w; c.fillStyle = '#333'; c.fillRect(mx - 1.5, my, 3, w * 0.1); c.fillRect(mx - w * 0.05, my - w * 0.08, w * 0.1, w * 0.09);
          c.fillStyle = '#ff2a2a'; c.fillRect(mx - w * 0.03, my - w * 0.06, w * 0.02, w * 0.015); c.fillRect(mx + w * 0.01, my - w * 0.06, w * 0.02, w * 0.015);
        });
        c.fillStyle = '#fff6d6'; c.fillRect(w * 0.06, w * 0.62, w * 0.17, w * 0.08); c.fillStyle = '#5a3a1a'; c.font = '700 ' + Math.round(fs * 0.55) + 'px Fredoka, sans-serif'; c.fillText('Shhh.', w * 0.145, w * 0.66);
      }
      c.fillStyle = '#5a3a1a'; c.font = '700 ' + Math.round(fs * 0.62) + 'px Fredoka, sans-serif'; c.fillText(this.g.rules.jackpot ? 'JACKPOT ' + this.money(this.g.pot) : 'FREE REST STOP', w / 2, w * 0.94);
    } else if (i === 30) {   // WHITEOUT! HIT THE DITCH
      c.fillStyle = '#dfe9f5'; c.fillRect(1, 1, w - 2, w - 2);
      if (!flat) { c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 3; for (var s2 = 0; s2 < 7; s2++) { c.beginPath(); c.arc(w / 2, w * 0.55, w * (0.06 + s2 * 0.045), s2, s2 + 3.6); c.stroke(); } c.fillStyle = '#7c8fa8'; c.fillRect(w * 0.2, w * 0.82, w * 0.6, 3); }
      c.fillStyle = '#103a6a'; c.font = '900 ' + Math.round(fs * 1.0) + 'px Fredoka, sans-serif'; c.fillText('WHITEOUT!', w / 2, w * 0.13);
      c.font = '800 ' + Math.round(fs * 0.75) + 'px Fredoka, sans-serif'; c.fillText('HIT THE DITCH', w / 2, w * 0.25);
      c.font = '600 ' + Math.round(fs * 0.6) + 'px Fredoka, sans-serif'; c.fillStyle = '#333'; c.fillText('Go to the Snowbank', w / 2, w * 0.92);
    }
  };

  // ------------------------------------------------------------------ Upper Level Youth Centre (landmark by downtown)
  P.ycBox = function () {
    var inner = this.S - 2 * this.cs, w = inner * 0.27, h = inner * 0.36;
    var x = this.S - this.cs - this.ringInset('road') - w - inner * 0.03, y = this.cs + this.ringInset('road') + inner * 0.03;
    return { x: x, y: y, w: w, h: h };
  };
  P.ycFacade = function () {      // cached brick facade with window holes; oddly shaped second storey
    var b = this.ycBox(), key = [b.w, b.h, this.dpr, this.rung >= 6].join(); if (key === this.ycKey) return;
    this.ycKey = key;
    var cv = this.ycCv, d = this.dpr; cv.width = Math.ceil(b.w * d); cv.height = Math.ceil(b.h * d);
    var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
    var w = b.w, h = b.h, gH = h * 0.3, top = h * 0.08;
    // second storey outline: stepped parapet on the left, a slanted roof run, a little tower on the right (odd shape)
    var shape = function () {
      c.beginPath(); c.moveTo(0, h - gH); c.lineTo(0, top + h * 0.1); c.lineTo(w * 0.12, top + h * 0.1); c.lineTo(w * 0.12, top + h * 0.04); c.lineTo(w * 0.26, top + h * 0.04);
      c.lineTo(w * 0.7, top + h * 0.12); c.lineTo(w * 0.7, top - h * 0.02); c.lineTo(w * 0.86, top - h * 0.06); c.lineTo(w, top + h * 0.02); c.lineTo(w, h - gH); c.closePath();
    };
    shape(); c.fillStyle = '#9a3b2a'; c.fill();
    if (this.rung < 6) {           // bricks
      c.save(); shape(); c.clip();
      c.strokeStyle = 'rgba(60,20,12,0.45)'; c.lineWidth = 1; var bh = Math.max(3, h * 0.028), bw = bh * 2.4;
      for (var yy = 0, row = 0; yy < h; yy += bh, row++) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); for (var xx = (row % 2) * bw / 2; xx < w; xx += bw) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + bh); c.stroke(); } }
      c.restore();
    }
    c.strokeStyle = '#3a140c'; c.lineWidth = 2; shape(); c.stroke();
    // cornice line between floors
    c.fillStyle = '#5a2418'; c.fillRect(-1, h - gH - h * 0.025, w + 2, h * 0.03);
    // ground floor: Dot's storefront
    c.fillStyle = '#c9b48a'; c.fillRect(0, h - gH, w, gH); c.strokeStyle = '#3a2a14'; c.strokeRect(0.5, h - gH + 0.5, w - 1, gH - 1);
    c.fillStyle = '#2d4a5a'; c.fillRect(w * 0.06, h - gH * 0.68, w * 0.36, gH * 0.55); c.fillRect(w * 0.6, h - gH * 0.68, w * 0.34, gH * 0.55);
    c.fillStyle = '#4a2a14'; c.fillRect(w * 0.45, h - gH * 0.78, w * 0.12, gH * 0.78);              // stairs door up to the venue
    c.fillStyle = '#e8d6a0'; c.fillRect(w * 0.47, h - gH * 0.72, w * 0.08, gH * 0.08);
    c.fillStyle = '#7a1a1a'; c.fillRect(w * 0.06, h - gH * 0.97, w * 0.88, gH * 0.24);
    c.fillStyle = '#ffe9b0'; c.font = '800 ' + Math.round(gH * 0.18) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DOT\'S', w / 2, h - gH * 0.85);
    // window holes (cut out so the stage light shows through)
    c.globalCompositeOperation = 'destination-out';
    this.ycWindows(b).forEach(function (wn) { c.fillRect(wn.x, wn.y, wn.w, wn.h); });
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = '#e8d2b0'; c.lineWidth = 2;
    this.ycWindows(b).forEach(function (wn) { c.strokeRect(wn.x, wn.y, wn.w, wn.h); if (!wn.main) { c.beginPath(); c.moveTo(wn.x + wn.w / 2, wn.y); c.lineTo(wn.x + wn.w / 2, wn.y + wn.h); c.stroke(); } else { c.beginPath(); c.moveTo(wn.x + wn.w / 3, wn.y); c.lineTo(wn.x + wn.w / 3, wn.y + wn.h); c.moveTo(wn.x + 2 * wn.w / 3, wn.y); c.lineTo(wn.x + 2 * wn.w / 3, wn.y + wn.h); c.stroke(); } });
  };
  P.ycWindows = function (b) {
    var w = b.w, h = b.h, gH = h * 0.3;
    var y0 = h * 0.3, wh = (h - gH) - y0 - h * 0.08;
    return [{ x: w * 0.05, y: y0 + wh * 0.15, w: w * 0.14, h: wh * 0.7 }, { x: w * 0.23, y: y0, w: w * 0.6, h: wh, main: true }, { x: w * 0.86, y: y0 + wh * 0.1, w: w * 0.1, h: wh * 0.6 }];
  };
  P.drawYouthCentre = function (c, now, dark, level) {
    var b = this.ycBox(), x0 = this.bx + b.x, y0 = this.by + b.y, wins = this.ycWindows(b), bt = root.RDRSfx ? root.RDRSfx.beat() : { phase: (now / 341) % 1, n: Math.floor(now / 341) };
    var still = this.rung >= 3, energy = 0.35 + 0.65 * Math.min(1, level * 2.2);
    var ph = still ? 0.25 : bt.phase, bounce = still ? 0 : Math.pow(Math.sin(ph * Math.PI), 2);
    // stage light behind the windows: warm, flickering on the beat
    var cols = ['#ff8a2a', '#ff4a6a', '#ffcf4a', '#ff6a2a'], col = cols[still ? 0 : bt.n % 4];
    var flick = still ? 0.85 : 0.65 + 0.35 * (1 - ph) * energy + (Math.random() < 0.06 ? -0.25 : 0);
    wins.forEach(function (wn, k) {
      var gx = x0 + wn.x, gy = y0 + wn.y;
      var gr = c.createLinearGradient(gx, gy, gx, gy + wn.h); gr.addColorStop(0, '#2a0e18'); gr.addColorStop(1, col);
      c.fillStyle = gr; c.fillRect(gx, gy, wn.w, wn.h);
      c.globalAlpha = Math.max(0, Math.min(1, flick)) * 0.5; c.fillStyle = '#fff2c0'; c.fillRect(gx, gy + wn.h * 0.55, wn.w, wn.h * 0.45); c.globalAlpha = 1;
      if (!wn.main && !still && (bt.n + k) % 2 === 0) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(gx, gy, wn.w, wn.h); }
    });
    // silhouettes in the big window: two guys at the back (guitar + bass), the drummer bouncing on his kit at the front
    var m = wins[1], mx = x0 + m.x, my = y0 + m.y, mw = m.w, mh = m.h;
    c.save(); c.beginPath(); c.rect(mx, my, mw, mh); c.clip();
    c.fillStyle = 'rgba(20,6,14,0.82)';
    var self = this;
    [[0.2, 1], [0.8, -1]].forEach(function (g, k) {     // back row, smaller (further away), headbanging off-beat
      var gx = mx + mw * g[0], base = my + mh * 0.78, s = mh * 0.5, bob = still ? 0 : Math.pow(Math.sin(((ph + 0.5 * k) % 1) * Math.PI), 2) * s * 0.06;
      self.person(c, gx, base, s, bob, g[1] * (still ? 0 : (Math.sin(bt.n * 1.7 + k) * 0.15)), k === 0 ? 'guitar' : 'bass');
    });
    c.fillStyle = 'rgba(8,2,6,0.95)';
    var dx = mx + mw * 0.5, dbase = my + mh * 1.02, ds = mh * 0.62, up = bounce * ds * 0.09 * energy;
    // kit: bass drum, toms, cymbals
    c.beginPath(); c.arc(dx, dbase - ds * 0.2, ds * 0.22, 0, Math.PI * 2); c.fill();
    c.fillRect(dx - ds * 0.42, dbase - ds * 0.36, ds * 0.16, ds * 0.08); c.fillRect(dx + ds * 0.26, dbase - ds * 0.34, ds * 0.16, ds * 0.08);
    c.save(); c.translate(dx - ds * 0.48, dbase - ds * 0.62); c.rotate(still ? -0.15 : -0.15 + (bt.n % 2 ? 0.12 : 0) * energy); c.fillRect(-ds * 0.18, -2, ds * 0.36, 3); c.restore();
    c.save(); c.translate(dx + ds * 0.5, dbase - ds * 0.66); c.rotate(0.18); c.fillRect(-ds * 0.18, -2, ds * 0.36, 3); c.restore();
    // drummer (Justin): head with a short mohawk, shoulders, sticks flying
    var hy = dbase - ds * 0.78 - up;
    c.beginPath(); c.arc(dx, hy, ds * 0.11, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(dx - ds * 0.03, hy - ds * 0.1); c.lineTo(dx, hy - ds * 0.19); c.lineTo(dx + ds * 0.03, hy - ds * 0.1); c.fill();   // mohawk
    rr(c, dx - ds * 0.17, hy + ds * 0.1, ds * 0.34, ds * 0.3, ds * 0.06); c.fill();
    c.strokeStyle = 'rgba(8,2,6,0.95)'; c.lineWidth = Math.max(2, ds * 0.05); c.lineCap = 'round';
    var a1 = still ? 0.6 : (bt.n % 2 ? -0.2 : 0.9) * energy + 0.2, a2 = still ? 0.6 : (bt.n % 2 ? 0.9 : -0.2) * energy + 0.2;
    [[-1, a1], [1, a2]].forEach(function (arm) {
      var sx = dx + arm[0] * ds * 0.15, sy = hy + ds * 0.16, ex = sx + arm[0] * ds * 0.16, ey = sy + ds * 0.08 - arm[1] * ds * 0.18;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
      c.lineWidth = Math.max(1.5, ds * 0.025); c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + arm[0] * ds * 0.14, ey - arm[1] * ds * 0.12 - ds * 0.04); c.stroke(); c.lineWidth = Math.max(2, ds * 0.05);
    });
    c.restore();
    // facade (cached), then the sign
    this.ycFacade();
    c.drawImage(this.ycCv, x0, y0, b.w, b.h);
    var signY = y0 + b.h * 0.2, glow = dark > 0.3 || level > 0.05;
    c.fillStyle = 'rgba(25,10,20,0.85)'; rr(c, x0 + b.w * 0.18, signY - b.h * 0.055, b.w * 0.64, b.h * 0.1, 4); c.fill();
    c.fillStyle = glow ? '#ffde7a' : '#e8c86a'; c.font = '800 ' + Math.max(7, Math.round(b.h * 0.05)) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('UPPER LEVEL', x0 + b.w / 2, signY - b.h * 0.016);
    c.font = '700 ' + Math.max(6, Math.round(b.h * 0.03)) + 'px Fredoka, sans-serif'; c.fillStyle = glow ? '#7affc8' : '#9fd8c0'; c.fillText('YOUTH CENTRE \u00b7 ALL AGES', x0 + b.w / 2, signY + b.h * 0.025);
    // the street it faces (Gaetz Ave), with a little label
    var sy2 = y0 + b.h + 2;
    c.fillStyle = 'rgba(60,60,66,0.85)'; c.fillRect(x0 - 4, sy2, (this.bx + this.S - this.cs) - x0 + 4, Math.max(6, b.h * 0.07));
    c.fillStyle = '#eee'; c.font = '700 ' + Math.max(6, Math.round(b.h * 0.035)) + 'px Fredoka, sans-serif'; c.fillText('GAETZ AVE', x0 + b.w * 0.55, sy2 + Math.max(3, b.h * 0.035));
    // music notes drifting out when the band is loud
    if (!still && level > 0.08) {
      var t = now / 1000; c.fillStyle = 'rgba(255,230,140,' + Math.min(1, level * 1.6) + ')'; c.font = '700 ' + Math.round(b.h * 0.08) + 'px sans-serif';
      for (var n = 0; n < 3; n++) { var f = (t * 0.5 + n / 3) % 1; c.globalAlpha = (1 - f) * Math.min(1, level * 2); c.fillText(n % 2 ? '\u266A' : '\u266B', x0 + b.w * (0.3 + 0.2 * n) + Math.sin(t * 2 + n) * 6, y0 + b.h * 0.25 - f * b.h * 0.35); }
      c.globalAlpha = 1;
    }
  };
  P.person = function (c, x, base, s, bob, lean, inst) {
    c.save(); c.translate(x, base); c.rotate(lean || 0);
    var hy = -s * 0.85 + bob;
    c.beginPath(); c.arc(0, hy, s * 0.11, 0, Math.PI * 2); c.fill();
    rr(c, -s * 0.13, hy + s * 0.1, s * 0.26, s * 0.42, s * 0.05); c.fill();
    c.fillRect(-s * 0.1, hy + s * 0.5, s * 0.08, s * 0.4); c.fillRect(s * 0.02, hy + s * 0.5, s * 0.08, s * 0.4);
    c.save(); c.translate(0, hy + s * 0.38); c.rotate(-0.45);   // guitar / bass body + neck
    c.beginPath(); c.ellipse(-s * 0.05, 0, s * 0.13, s * 0.09, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(s * 0.05, -s * 0.02, inst === 'bass' ? s * 0.46 : s * 0.36, s * 0.035);
    c.restore(); c.restore();
  };

  // ------------------------------------------------------------------ townsfolk + cars
  P.initLiving = function () {
    var g = this.g, rnd = Math.random;
    this.walkers = []; this.cars = [];
    var kinds = ['jogger', 'stroller', 'hivis', 'dog', 'shopper', 'kid', 'barhop', 'scrubs', 'rig', 'cat'];
    for (var i = 0; i < 18; i++) this.walkers.push({ u: rnd(), v: (rnd() < 0.5 ? 1 : -1) * (0.004 + rnd() * 0.006), kind: kinds[i % kinds.length], frame: 0, col: ['#e85a5a', '#5a9ae8', '#e8c35a', '#7ad87a', '#c87ae8', '#f08a3a'][i % 6], night: i % 10 >= 6 });
    for (var k = 0; k < 6; k++) this.cars.push({ u: k / 6 + rnd() * 0.05, v: 0.012 + rnd() * 0.008, col: ['#d8262f', '#2a6ad8', '#f2f2f2', '#2b2b2b', '#e8b02a', '#3aa85a'][k] });
  };
  P.ringPos = function (u, inset) {      // point on a rectangle ring inside the tiles
    var x0 = this.bx + this.cs + inset, y0 = this.by + this.cs + inset, L = this.S - 2 * this.cs - 2 * inset;
    u = ((u % 1) + 1) % 1; var d = u * 4 * L;
    if (d < L) return { x: x0 + d, y: y0, dir: 0 }; d -= L;
    if (d < L) return { x: x0 + L, y: y0 + d, dir: 1 }; d -= L;
    if (d < L) return { x: x0 + L - d, y: y0 + L, dir: 2 }; d -= L;
    return { x: x0, y: y0 + L - d, dir: 3 };
  };
  P.stepLiving = function (dt) {     // walkers animate at ~10 fps on their own timer
    this.walkT += dt; if (this.walkT < 100) return; var steps = this.walkT / 100; this.walkT = 0;
    this.walkers.forEach(function (w) { w.u += w.v * steps * 0.12; w.frame = (w.frame + 1) % 4; });
    this.cars.forEach(function (cr) { cr.u += cr.v * steps * 0.12; });
  };
  P.drawLiving = function (c, dark, paused) {
    if (this.rung >= 5) return;
    var night = dark > 0.5, want = night ? LV.walkersNight : LV.walkersDay; if (this.rung >= 1) want = Math.ceil(want / 2);
    var tok = Math.max(6, this.w * 0.28), sz = tok * 0.55, self = this, ins = this.ringInset('walk');
    if (this.rung < 2) this.cars.slice(0, LV.cars).forEach(function (cr) {
      var p = self.ringPos(cr.u, self.ringInset('road')), horiz = p.dir % 2 === 0, L = sz * 1.5, Wd = sz * 0.8;
      var off = sz * 0.45 * (p.dir < 2 ? 1 : -1);
      var x = p.x + (horiz ? 0 : off), y = p.y + (horiz ? off : 0);
      c.fillStyle = cr.col; c.fillRect(x - (horiz ? L : Wd) / 2, y - (horiz ? Wd : L) / 2, horiz ? L : Wd, horiz ? Wd : L);
      c.fillStyle = 'rgba(160,210,255,0.9)'; c.fillRect(x - (horiz ? L * 0.15 : Wd * 0.35), y - (horiz ? Wd * 0.35 : L * 0.15), horiz ? L * 0.3 : Wd * 0.7, horiz ? Wd * 0.7 : L * 0.3);
      if (night) { c.fillStyle = 'rgba(255,240,170,0.9)'; var hx = [L / 2, 0, -L / 2, 0][p.dir], hy = [0, L / 2, 0, -L / 2][p.dir]; c.beginPath(); c.arc(x + hx, y + hy, sz * 0.25, 0, 7); c.fill(); }
    });
    var n = 0;
    for (var i = 0; i < this.walkers.length && n < want; i++) {
      var w = this.walkers[i]; if (w.night !== night && i % 3 !== 0) continue; n++;
      var kind = night ? ['barhop', 'scrubs', 'rig', 'cat', 'barhop', 'jogger'][i % 6] : w.kind;
      var p = this.ringPos(w.u, ins), leg = paused ? 0 : (w.frame % 2 ? 1 : -1);
      var col = kind === 'hivis' || kind === 'rig' ? '#f5e62a' : kind === 'scrubs' ? '#4ac8c0' : w.col;
      if (kind === 'cat') { c.fillStyle = '#222'; c.fillRect(p.x - sz * 0.4, p.y - sz * 0.15, sz * 0.8, sz * 0.3); c.beginPath(); c.arc(p.x + sz * 0.4 * (w.v > 0 ? 1 : -1), p.y - sz * 0.15, sz * 0.18, 0, 7); c.fill(); continue; }
      c.fillStyle = '#2b2b2b'; c.fillRect(p.x - sz * 0.18 + leg * sz * 0.08, p.y, sz * 0.14, sz * 0.4); c.fillRect(p.x + sz * 0.04 - leg * sz * 0.08, p.y, sz * 0.14, sz * 0.4);
      c.fillStyle = col; c.fillRect(p.x - sz * 0.22, p.y - sz * 0.45, sz * 0.44, sz * 0.5);
      c.fillStyle = '#e8b890'; c.beginPath(); c.arc(p.x, p.y - sz * 0.62, sz * 0.18, 0, 7); c.fill();
      if (kind === 'stroller') { c.fillStyle = '#5a5a8a'; c.fillRect(p.x + sz * 0.3, p.y - sz * 0.2, sz * 0.35, sz * 0.3); }
      if (kind === 'dog') { c.fillStyle = '#8a5a2a'; c.fillRect(p.x + sz * 0.35, p.y + sz * 0.1, sz * 0.4, sz * 0.2); }
    }
  };

  // ------------------------------------------------------------------ tokens
  P.tokenTarget = function (p, now) {
    var g = this.g, t = g.turn;
    if (t && t.pid === p.id && t.stage === 'moving' && t.moving) {
      var m = t.moving, el = now - m.start, k = Math.floor(el / m.step);
      if (k < m.path.length) {
        var from = k === 0 ? m.from : m.path[k - 1], to = m.path[k], f = (el - k * m.step) / m.step;
        var a = this.slot(p, from), b = this.slot(p, to);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * this.w * 0.35, step: k, sp: f < 0.5 ? from : to };
      }
    }
    var s = this.slot(p, p.pos); s.sp = p.pos; return s;
  };
  P.slot = function (p, sp) {
    var g = this.g, r = this.rect(sp), others = g.players.filter(function (q) { return !q.bankrupt && q.pos === sp && (sp !== 10 || q.snow === p.snow); });
    var idx = Math.max(0, others.indexOf(p)), n = Math.max(1, others.length);
    var cx = this.bx + r.x + r.w / 2, cy = this.by + r.y + r.h / 2;
    if (sp === 10) { var st = r.w * 0.27; if (p.snow) { cx = this.bx + r.x + st + (r.w - st) / 2; cy = this.by + r.y + (r.w - st) * 0.62; } else { cx = this.bx + r.x + st / 2; cy = this.by + r.y + r.h - st / 2; } }
    var cols = n <= 2 ? n : 2, rows = Math.ceil(n / cols), gap = this.w * 0.42;
    var horiz = r.side === 'b' || r.side === 't';
    var ox = (idx % cols - (cols - 1) / 2) * gap, oy = (Math.floor(idx / cols) - (rows - 1) / 2) * gap;
    if (sp === 10 && !p.snow) return { x: cx + (idx - (n - 1) / 2) * gap * 0.8 * (idx % 2 ? 1 : 1), y: cy };
    if (r.side === 'l' || r.side === 'r') { var tmp = ox; ox = oy; oy = tmp; }
    return { x: cx + ox, y: cy + oy * (horiz ? 0.9 : 1) };
  };
  P.drawToken = function (c, p, x, y, r, active, now) {
    var ch = charById(p.charId);
    if (p.state === 'gold') { c.fillStyle = 'rgba(255,210,60,0.35)'; c.beginPath(); c.arc(x, y, r * 1.55 + Math.sin(now / 250) * r * 0.08, 0, 7); c.fill(); }
    if (active) { c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(now / 180)) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * 1.35, 0, 7); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.8, r * 0.25, 0, 0, 7); c.fill();
    this.shapeAccent(c, ch.shape, x, y, r, ch);
    c.fillStyle = p.color; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.lineWidth = Math.max(2, r * 0.16); c.strokeStyle = p.state === 'gold' ? '#ffd23f' : p.state === 'good' ? '#d8e2ec' : '#ffffff'; c.stroke();
    if (p.state === 'good') { c.strokeStyle = '#8a9aaa'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r * 1.14, 0, 7); c.stroke(); }
    c.fillStyle = ch.ink; c.font = '800 ' + Math.round(r * (p.name.length > 1 ? 0.85 : 1.1)) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(initials(p.name), x, y + r * 0.05);
    if (p.state === 'gold') { c.fillStyle = '#ffd23f'; c.strokeStyle = '#7a5a00'; c.lineWidth = 1; c.beginPath(); var cy0 = y - r * 1.05; c.moveTo(x - r * 0.55, cy0); c.lineTo(x - r * 0.6, cy0 - r * 0.5); c.lineTo(x - r * 0.25, cy0 - r * 0.25); c.lineTo(x, cy0 - r * 0.6); c.lineTo(x + r * 0.25, cy0 - r * 0.25); c.lineTo(x + r * 0.6, cy0 - r * 0.5); c.lineTo(x + r * 0.55, cy0); c.closePath(); c.fill(); c.stroke(); }
    if (p.snow) { c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(x, y + r * 0.7, r * 1.1, r * 0.4, 0, 0, 7); c.fill(); }
  };
  function initials(n) { var w = String(n).trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : String(n).slice(0, 2)).toUpperCase(); }
  P.shapeAccent = function (c, shape, x, y, r, ch) {
    c.fillStyle = ch.ink; var t = y - r;
    switch (shape) {
      case 'mohawk': c.fillStyle = '#ffd84a'; for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * r * 0.16 - r * 0.09, t + r * 0.15); c.lineTo(x + i * r * 0.16, t - r * 0.45); c.lineTo(x + i * r * 0.16 + r * 0.09, t + r * 0.15); c.fill(); } break;
      case 'spikes': c.fillStyle = '#ff3030'; for (var j = -2; j <= 2; j++) { var a = j * 0.38; c.beginPath(); c.moveTo(x + Math.sin(a - 0.15) * r, y - Math.cos(a - 0.15) * r); c.lineTo(x + Math.sin(a) * r * 1.75, y - Math.cos(a) * r * 1.75); c.lineTo(x + Math.sin(a + 0.15) * r, y - Math.cos(a + 0.15) * r); c.fill(); } break;
      case 'mop': c.fillStyle = '#f7e08a'; c.beginPath(); c.ellipse(x, t + r * 0.15, r * 0.95, r * 0.5, 0, Math.PI, 0); c.fill(); break;
      case 'star': c.fillStyle = '#ff4040'; star(c, x + r * 0.8, t + r * 0.2, r * 0.42); break;
      case 'heart': c.fillStyle = '#ff6aa8'; c.beginPath(); c.arc(x - r * 0.18, t - r * 0.05, r * 0.2, 0, 7); c.arc(x + r * 0.18, t - r * 0.05, r * 0.2, 0, 7); c.moveTo(x - r * 0.38, t); c.lineTo(x, t + r * 0.4); c.lineTo(x + r * 0.38, t); c.fill(); break;
      case 'toque': c.fillStyle = '#c8302a'; c.beginPath(); c.ellipse(x, t + r * 0.2, r * 0.8, r * 0.55, 0, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, t - r * 0.38, r * 0.16, 0, 7); c.fill(); break;
      case 'horns': c.fillStyle = '#e8e8e8'; [-1, 1].forEach(function (s) { c.beginPath(); c.moveTo(x + s * r * 0.5, t + r * 0.25); c.quadraticCurveTo(x + s * r * 1.15, t, x + s * r * 0.95, t - r * 0.5); c.lineTo(x + s * r * 0.75, t + r * 0.2); c.fill(); }); break;
      case 'moon': c.fillStyle = '#e8d8ff'; c.beginPath(); c.arc(x + r * 0.75, t + r * 0.1, r * 0.35, 0, 7); c.fill(); c.fillStyle = '#6b3fa0'; c.beginPath(); c.arc(x + r * 0.88, t, r * 0.3, 0, 7); c.fill(); break;
      case 'diamond': c.fillStyle = '#9ad8ff'; c.beginPath(); c.moveTo(x, t - r * 0.5); c.lineTo(x + r * 0.3, t); c.lineTo(x, t + r * 0.3); c.lineTo(x - r * 0.3, t); c.fill(); break;
      case 'bowl': c.fillStyle = '#fff'; c.beginPath(); c.arc(x, t - r * 0.05, r * 0.4, 0, Math.PI); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - r * 0.1, t - r * 0.15); c.quadraticCurveTo(x, t - r * 0.5, x + r * 0.15, t - r * 0.55); c.stroke(); break;
      case 'cap': c.fillStyle = '#2b4a8a'; c.beginPath(); c.ellipse(x, t + r * 0.25, r * 0.75, r * 0.45, 0, Math.PI, 0); c.fill(); c.fillRect(x, t + r * 0.12, r * 0.95, r * 0.14); break;
    }
  };
  function star(c, x, y, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill(); }
  P.tokenR = function () { return Math.max(7, this.w * 0.26); };

  // ------------------------------------------------------------------ day / night
  P.darkness = function () {
    var cyc = LV.cycleMin * 60, night = cyc * LV.nightShare, day = cyc - night, bl = LV.blendSec;
    var t = ((Date.now() - this.cycleStart) / 1000 + (this.cycleOffset || 0)) % cyc, d;
    if (t < day) d = 0; else { var n = t - day; d = n < bl ? n / bl : n > night - bl ? (night - n) / bl : 1; }
    if (this.rung >= 4) d = Math.round(d * 3) / 3;
    return Math.max(0, Math.min(1, d));
  };
  P.tint = function (d) { return d < 0.4 ? lerpC('#ffffff', '#f2b583', d / 0.4) : lerpC('#f2b583', '#4a568f', (d - 0.4) / 0.6); };

  // ------------------------------------------------------------------ frame
  P.bubble = function (pid, text, color) { this.bubbles = this.bubbles.filter(function (b) { return b.pid !== pid; }); this.bubbles.push({ pid: pid, text: String(text).slice(0, 60), color: color || '#fff', until: Date.now() + 3800 }); };
  P.frame = function (now, dt, opts) {
    opts = opts || {};
    var c = this.ctx, g = this.g, d = this.dpr;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = '#14121b'; c.fillRect(0, 0, this.W, this.H);
    if (!this.S) return;
    this.drawStatic();
    c.drawImage(this.staticCv, this.bx, this.by, this.S, this.S);
    var dark = this.darkness();
    if (!opts.paused) this.stepLiving(dt);
    this.drawLiving(c, dark, opts.paused);
    this.drawYouthCentre(c, now, dark, opts.band || 0);
    // highlights: PAY UP window (owner colour pulse) / buy offer (white)
    var t = g.turn;
    if (g.phase === 'play' && t) {
      if (t.payup && !t.payup.done) { var o = g.byId(t.payup.owner); this.hl(c, t.payup.sp, o ? o.color : '#fff', 0.5 + 0.5 * Math.sin(now / 110), 5); }
      else if (t.buy != null) this.hl(c, t.buy, '#ffffff', 0.6 + 0.4 * Math.sin(now / 300), 3);
    }
    // night tint over the whole board (one multiply pass), then lights on top
    if (dark > 0.01) {
      c.globalCompositeOperation = 'multiply'; c.fillStyle = this.tint(dark); c.fillRect(this.bx, this.by, this.S, this.S); c.globalCompositeOperation = 'source-over';
      if (dark > 0.4) this.nightLights(c, dark, now);
    }
    // tokens (never crushed)
    var self = this, r = this.tokenR(), cur = g.turn ? g.turn.pid : -1;
    var list = g.players.filter(function (p) { return !p.bankrupt; });
    list.sort(function (a, b) { return (a.id === cur) - (b.id === cur); });
    list.forEach(function (p) {
      var tg = self.tokenTarget(p, now), v = self.vis[p.id];
      var moving = g.turn && g.turn.pid === p.id && g.turn.stage === 'moving';
      if (!v || moving) v = self.vis[p.id] = { x: tg.x, y: tg.y }; else { v.x += (tg.x - v.x) * 0.2; v.y += (tg.y - v.y) * 0.2; }
      v.sp = tg.sp;
      self.drawToken(c, p, v.x, v.y, r * (p.id === cur ? 1.15 : 1), p.id === cur && g.phase === 'play', now);
    });
    // speech bubbles
    var tnow = Date.now();
    this.bubbles = this.bubbles.filter(function (b) { return b.until > tnow; });
    this.bubbles.forEach(function (b) { var v = self.vis[b.pid]; if (v) self.drawBubble(c, v.x, v.y - r * 1.8, b.text, b.color); });
  };
  P.hl = function (c, sp, col, a, lw) {
    var rc = this.rect(sp); c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = lw; c.strokeRect(this.bx + rc.x + lw / 2, this.by + rc.y + lw / 2, rc.w - lw, rc.h - lw); c.restore();
  };
  P.nightLights = function (c, dark, now) {
    var a = (dark - 0.4) / 0.6, ins = this.ringInset('walk');
    c.globalCompositeOperation = 'lighter';
    if (!this.glowCv) {        // one pre-rendered soft glow sprite, reused for every street lamp (cheap on a Chromecast)
      var gcv = document.createElement('canvas'); gcv.width = gcv.height = 64; var gx = gcv.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.18, 'rgba(255,190,100,0.75)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64); this.glowCv = gcv;
    }
    var gs = this.w * 0.5; c.globalAlpha = 0.45 * a;
    for (var k = 0; k < 16; k++) { var p = this.ringPos(k / 16 + 0.03, ins); c.drawImage(this.glowCv, p.x - gs / 2, p.y - gs / 2, gs, gs); }
    c.globalAlpha = 1;
    if (this.rung < 3) {      // stars over the river valley
      c.fillStyle = 'rgba(255,255,255,' + (0.6 * a) + ')';
      for (var s = 0; s < 22; s++) { var sx = this.bx + this.cs + ((s * 97) % 100) / 100 * (this.S - 2 * this.cs) * 0.55, sy = this.by + this.cs + ((s * 61) % 100) / 100 * (this.S - 2 * this.cs) * 0.5 + 10; if (Math.sin(now / 400 + s) > -0.3) c.fillRect(sx, sy, 2, 2); }
    }
    var b = this.ycBox(), wins = this.ycWindows(b), x0 = this.bx + b.x, y0 = this.by + b.y;   // venue windows spill light onto the street
    c.fillStyle = 'rgba(255,150,60,' + (0.35 * a) + ')';
    wins.forEach(function (wn) { c.fillRect(x0 + wn.x - 3, y0 + wn.y - 3, wn.w + 6, wn.h + 6); });
    c.globalCompositeOperation = 'source-over';
  };
  P.drawBubble = function (c, x, y, text, col) {
    c.font = '700 ' + Math.max(11, Math.round(this.w * 0.2)) + 'px Fredoka, sans-serif';
    var tw = Math.min(c.measureText(text).width, this.S * 0.4), pad = 8, h = Math.max(18, this.w * 0.3);
    var bx = Math.max(this.bx, Math.min(this.bx + this.S - tw - 2 * pad, x - tw / 2 - pad));
    c.fillStyle = 'rgba(255,255,255,0.96)'; rr(c, bx, y - h, tw + 2 * pad, h, 8); c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y + 8); c.lineTo(x + 6, y); c.fillStyle = 'rgba(255,255,255,0.96)'; c.fill();
    c.fillStyle = '#1d1d1d'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, bx + pad, y - h / 2, tw);
  };
  // spaces between the nearest token and the Youth Centre frontage, for the band volume
  P.bandLevel = function () {
    var g = this.g, YC = C.youthCentre, best = 99, self = this, landed = false;
    if (g.phase !== 'play') return { vol: 0, near: 0 };
    g.players.forEach(function (p) {
      if (p.bankrupt) return; var v = self.vis[p.id], sp = v && v.sp != null ? v.sp : p.pos;
      YC.nearSpaces.forEach(function (n) { var dd = Math.min((sp - n + 40) % 40, (n - sp + 40) % 40); if (dd < best) best = dd; });
      if (YC.nearSpaces.indexOf(p.pos) !== -1 && g.turn && g.turn.pid === p.id && g.turn.stage !== 'moving' && g.turn.stage !== 'rolling') landed = true;
    });
    if (best >= YC.hearRange) return { vol: 0.03, near: 0 };
    var f = 1 - best / YC.hearRange, vol = YC.minVol + (YC.maxVol - YC.minVol) * f * f;
    if (landed) vol = 1;
    return { vol: Math.max(0.03, Math.min(1, vol)), near: f };
  };
  root.RDRRender = R;
  root.RDRRender.initials = initials;
})(typeof window !== 'undefined' ? window : globalThis);
