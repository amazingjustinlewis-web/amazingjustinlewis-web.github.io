/* IRON STRIDE - the cockpit overlay (2D canvas on top of the 3D view).
   frame canvas: the static wraparound cockpit (struts, console, glass screens), redrawn only on resize.
   hud canvas: everything that moves (heading tape, hull, weapons + reload animation, radar, crosshairs, holo hands). */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2;
  function Cockpit(frame, hud) {
    this.f = frame; this.h = hud; this.fx = frame.getContext('2d'); this.ctx = hud.getContext('2d');
    this.W = 1; this.H = 1; this.handsOn = true; this.hands = [this.newHand(-1), this.newHand(1)]; this.t = 0; this.visible = true;
  }
  var P = Cockpit.prototype;
  // ------------------------------------------------------------------ layout: the cockpit is drawn in a 1600x900 design space, scaled to fit
  P.layout = function (w, h, scale) {
    var s = Math.max(0.35, Math.min(1, scale || 1));
    this.cw = w; this.ch = h;
    this.W = this.f.width = this.h.width = Math.round(w * s); this.H = this.f.height = this.h.height = Math.round(h * s);
    this.k = Math.min(this.W / 1600, this.H / 900); this.ox = (this.W - 1600 * this.k) / 2; this.oy = this.H - 900 * this.k;
    this.drawFrame();
  };
  P.X = function (x) { return this.ox + x * this.k; };    // design x -> canvas px (centred)
  P.Y = function (y) { return this.oy + y * this.k; };
  // window area anchors (design units). Screens on the console:
  var L = { hull: [205, 742, 250, 120], weap: [1145, 742, 250, 120], radar: [800, 800, 82], map: [455, 770, 150, 95] };
  P.drawFrame = function () {
    var c = this.fx, W = this.W, H = this.H, self = this;
    c.clearRect(0, 0, W, H);
    if (!this.visible) return;
    function poly(pts, fill, line) {
      c.beginPath(); pts.forEach(function (p, i) { var x = typeof p[0] === 'string' ? (p[0] === 'L' ? 0 : W) : self.X(p[0]); var y = self.Y(p[1]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath();
      c.fillStyle = fill; c.fill(); if (line) { c.strokeStyle = line; c.lineWidth = Math.max(1, 2 * self.k); c.stroke(); }
    }
    var metal = c.createLinearGradient(0, 0, 0, H); metal.addColorStop(0, '#2a303b'); metal.addColorStop(0.5, '#1a1e26'); metal.addColorStop(1, '#0f1217');
    var top = this.Y(0);
    // canopy top band (full width) with a heading housing in the middle
    c.fillStyle = metal; c.fillRect(0, 0, W, Math.max(0, top));
    poly([['L', 0], ['R', 0], ['R', 70], [1220, 62], [1010, 84], [590, 84], [380, 62], ['L', 70]], metal, '#4a5568');
    poly([[640, 0], [960, 0], [940, 70], [660, 70]], '#14181f', '#5c6a80');
    // A-pillars (thick, angled) and two thin window mullions
    poly([['L', 60], [150, 62], [300, 690], ['L', 760]], metal, '#4a5568');
    poly([['R', 60], [1450, 62], [1300, 690], ['R', 760]], metal, '#4a5568');
    poly([[372, 64], [392, 64], [480, 700], [455, 700]], '#20252e', '#3d4757');
    poly([[1208, 64], [1228, 64], [1145, 700], [1120, 700]], '#20252e', '#3d4757');
    // console
    var con = c.createLinearGradient(0, this.Y(660), 0, H); con.addColorStop(0, '#2c333f'); con.addColorStop(0.25, '#1c2129'); con.addColorStop(1, '#0c0e12');
    poly([['L', 740], [300, 682], [640, 700], [700, 690], [900, 690], [960, 700], [1300, 682], ['R', 740], ['R', 900], ['L', 900]], con, '#596579');
    c.fillStyle = '#0c0e12'; c.fillRect(0, this.Y(899), W, H - this.Y(899));
    // console lip highlight
    c.strokeStyle = 'rgba(255,176,46,.35)'; c.lineWidth = Math.max(1, 2 * this.k);
    c.beginPath(); c.moveTo(this.X(300), this.Y(688)); c.lineTo(this.X(640), this.Y(706)); c.lineTo(this.X(960), this.Y(706)); c.lineTo(this.X(1300), this.Y(688)); c.stroke();
    // glass screens
    function glass(x, y, w, h) { var g = c.createLinearGradient(0, self.Y(y), 0, self.Y(y + h)); g.addColorStop(0, '#0b1a1f'); g.addColorStop(1, '#05090c'); c.fillStyle = g; rr(c, self.X(x), self.Y(y), w * self.k, h * self.k, 8 * self.k); c.fill(); c.strokeStyle = '#3e4a5c'; c.lineWidth = Math.max(1, 3 * self.k); c.stroke(); }
    glass(L.hull[0], L.hull[1], L.hull[2], L.hull[3]); glass(L.weap[0], L.weap[1], L.weap[2], L.weap[3]); glass(L.map[0], L.map[1], L.map[2], L.map[3]);
    c.beginPath(); c.arc(this.X(L.radar[0]), this.Y(L.radar[1]), (L.radar[2] + 10) * this.k, 0, TAU); c.fillStyle = '#262c36'; c.fill(); c.strokeStyle = '#596579'; c.stroke();
    c.beginPath(); c.arc(this.X(L.radar[0]), this.Y(L.radar[1]), L.radar[2] * this.k, 0, TAU); c.fillStyle = '#04110b'; c.fill();
    // brace lever + eject handle housings, rivets
    poly([[985, 770], [1050, 770], [1050, 860], [985, 860]], '#14181f', '#3e4a5c');
    poly([[560, 870], [600, 870], [600, 896], [560, 896]], '#3a1010', '#802020');
    c.fillStyle = '#4d5869';
    [[80, 300], [120, 520], [1520, 300], [1480, 520], [700, 30], [900, 30], [330, 720], [1270, 720]].forEach(function (p) { c.beginPath(); c.arc(self.X(p[0]), self.Y(p[1]), 4 * self.k, 0, TAU); c.fill(); });
    // labels
    c.fillStyle = '#6f7c92'; c.font = (14 * this.k) + 'px Fredoka, sans-serif'; c.textAlign = 'center';
    c.fillText('HULL', this.X(330), this.Y(736)); c.fillText('ARMS', this.X(1270), this.Y(736)); c.fillText('NAV', this.X(530), this.Y(764)); c.fillText('BRACE', this.X(1017), this.Y(878));
  };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }

  // ------------------------------------------------------------------ holographic hands
  P.newHand = function (side) { return { side: side, x: 0, y: 0, curl: 0.15, anim: null }; };
  var REST = { '-1': [560, 845], '1': [1040, 845] };
  var SPOTS = { weapon: [1270, 800], reload: [1350, 830], map: [530, 815], auto: [640, 860], brace: [1017, 815], eject: [580, 880], fire: null, bay: [330, 800] };
  // command -> which hand(s) move where, and how the fingers act
  P.cmd = function (name) {
    if (!this.handsOn) return;
    var self = this;
    function go(h, to, press, dur) { self.hands[h].anim = { t: 0, dur: dur || 0.55, to: to, press: press || 'tap' }; }
    if (name === 'weapon') go(1, SPOTS.weapon, 'twist');
    else if (name === 'reload') go(1, SPOTS.reload, 'slap', 0.7);
    else if (name === 'map') go(0, SPOTS.map, 'swipe', 0.8);
    else if (name === 'auto') go(0, SPOTS.auto, 'tap');
    else if (name === 'brace') { go(0, [990, 815], 'grab', 0.7); go(1, [1045, 815], 'grab', 0.7); }
    else if (name === 'eject') { go(0, [565, 880], 'grab', 0.6); go(1, [600, 880], 'grab', 0.6); }
    else if (name === 'bay') go(0, SPOTS.bay, 'tap');
    else if (name === 'fire') { var hh = this.hands[1]; if (!hh.anim) hh.squeeze = 1; }
  };
  P.drawHand = function (c, h, dt) {
    var rest = REST[h.side], x = rest[0], y = rest[1], curl = 0.2 + (h.squeeze || 0) * 0.5, rot = h.side * 0.12, lift = 0;
    h.squeeze = Math.max(0, (h.squeeze || 0) - dt * 6);
    if (h.anim) {
      var a = h.anim; a.t += dt; var u = a.t / a.dur;
      if (u >= 1) h.anim = null;
      else {
        var go = u < 0.45 ? u / 0.45 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4, e = go * go * (3 - 2 * go);
        x += (a.to[0] - x) * e; y += (a.to[1] - y) * e; lift = Math.sin(Math.min(1, go) * Math.PI) * 30;
        var atT = u > 0.38 && u < 0.66;
        if (a.press === 'grab' || a.press === 'twist') curl = atT ? 0.9 : 0.3;
        else if (a.press === 'slap') curl = atT ? 0.05 : 0.3;
        else curl = atT ? 0.5 : 0.25;
        if (a.press === 'twist' && atT) rot += Math.sin((u - 0.38) / 0.28 * Math.PI) * 0.6 * h.side;
        if (a.press === 'swipe' && atT) x += Math.sin((u - 0.38) / 0.28 * Math.PI) * 60;
      }
    }
    var k = this.k, X = this.X(x), Y = this.Y(y - lift), s = 1.05 * k;
    c.save(); c.translate(X, Y); c.rotate(rot); c.scale(s * h.side * -1, s);
    // palm + fingers as capsules; drawn twice: soft wide glow, then a bright core line
    var flick = 0.85 + 0.15 * Math.sin(this.t * 23 + h.side);
    for (var pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? 'rgba(170,250,255,' + (0.85 * flick) + ')' : 'rgba(60,220,255,' + (0.22 * flick) + ')';
      c.lineWidth = pass ? 2.2 : 11; c.lineCap = 'round'; c.lineJoin = 'round';
      c.fillStyle = 'rgba(60,200,255,' + (0.10 * flick) + ')';
      c.beginPath(); c.moveTo(-34, -10); c.lineTo(32, -12); c.lineTo(30, 38); c.lineTo(-24, 44); c.closePath(); if (!pass) c.fill(); c.stroke();
      for (var f = 0; f < 4; f++) {
        var fx = -27 + f * 19, len = [40, 46, 43, 34][f], cu = curl * (1 + f * 0.08);
        var mx = fx + Math.sin(cu * 1.3) * 3, my = -10 - len * 0.5 * Math.cos(cu * 1.2), ex = mx, ey = my - len * 0.5 * Math.cos(cu * 2.3);
        c.beginPath(); c.moveTo(fx, -11); c.lineTo(mx, my); c.lineTo(ex, ey); c.stroke();
      }
      c.beginPath(); c.moveTo(30, 22); c.lineTo(50 - curl * 14, 2 - curl * 4); c.lineTo(56 - curl * 26, -18 + curl * 8); c.stroke();     // thumb
      c.beginPath(); c.moveTo(-20, 44); c.lineTo(-18, 80); c.moveTo(24, 40); c.lineTo(22, 78); c.stroke();                             // wrist
    }
    c.restore();
  };

  // ------------------------------------------------------------------ per-frame HUD
  P.draw = function (S, dt) {
    var c = this.ctx, W = this.W, H = this.H, k = this.k, self = this; this.t += dt;
    c.clearRect(0, 0, W, H);
    if (S.hurt > 0.01) { var g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(255,30,10,' + (0.55 * S.hurt) + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    // crosshairs + locks (drawn under the frame graphics so the frame wins at the edges)
    (S.cross || []).forEach(function (x) { self.drawCross(c, x); });
    (S.cal || []).forEach(function (m) { self.drawCal(c, m); });
    if (!this.visible) { this.msg(c, S); return; }
    var font = function (px, w) { return (w || 600) + ' ' + Math.round(px * k) + 'px Fredoka, sans-serif'; };
    // heading tape
    var hx = this.X(800), hy = this.Y(36), span = 120;
    c.save(); c.beginPath(); c.rect(this.X(665), this.Y(4), 270 * k, 62 * k); c.clip();
    c.strokeStyle = '#ffb02e'; c.fillStyle = '#ffd27a'; c.lineWidth = Math.max(1, 2 * k); c.textAlign = 'center'; c.font = font(18);
    var hd = S.heading; for (var d = Math.floor((hd - span / 2) / 5) * 5; d <= hd + span / 2; d += 5) {
      var px = hx + (d - hd) / (span / 2) * 135 * k, m = ((d % 360) + 360) % 360;
      c.beginPath(); c.moveTo(px, this.Y(48)); c.lineTo(px, this.Y(m % 15 ? 54 : 42)); c.stroke();
      if (m % 45 === 0) c.fillText({ 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[m], px, this.Y(30));
    }
    c.restore();
    c.fillStyle = '#fff'; c.font = font(15); c.textAlign = 'center'; c.fillText(String(Math.round(((hd % 360) + 360) % 360)).padStart(3, '0') + '\u00b0', hx, this.Y(66));
    c.beginPath(); c.moveTo(hx, this.Y(57)); c.lineTo(hx - 6 * k, this.Y(47)); c.lineTo(hx + 6 * k, this.Y(47)); c.fillStyle = '#ffb02e'; c.fill();
    // hull
    var hb = L.hull, hp = Math.max(0, S.hull), col = hp > 0.5 ? '#5dff9a' : hp > 0.25 ? '#ffd23f' : '#ff4b3a';
    c.textAlign = 'left'; c.fillStyle = col; c.font = font(34, 700); c.fillText(Math.round(hp * 100) + '%', this.X(hb[0] + 16), this.Y(hb[1] + 46));
    c.font = font(14); c.fillStyle = '#8fb0a6'; c.fillText(S.status || 'SYSTEMS NOMINAL', this.X(hb[0] + 16), this.Y(hb[1] + 68));
    c.fillStyle = '#16231f'; c.fillRect(this.X(hb[0] + 16), this.Y(hb[1] + 84), 218 * k, 16 * k);
    c.fillStyle = col; c.fillRect(this.X(hb[0] + 16), this.Y(hb[1] + 84), 218 * k * hp, 16 * k);
    if (hp < 0.25 && (this.t * 3 % 1) < 0.5) { c.strokeStyle = '#ff4b3a'; c.lineWidth = 3 * k; rr(c, this.X(hb[0]), this.Y(hb[1]), hb[2] * k, hb[3] * k, 8 * k); c.stroke(); }
    c.font = font(13); c.fillStyle = '#7c8aa2'; c.textAlign = 'right'; c.fillText('SCORE ' + S.score, this.X(hb[0] + hb[2] - 12), this.Y(hb[1] + 22));
    // weapons + reload animation
    var wb = L.weap; c.textAlign = 'left';
    S.weapons.forEach(function (w, i) {
      var y = self.Y(wb[1] + 26 + i * 22), on = i === S.wsel;
      c.font = font(on ? 17 : 14, on ? 700 : 500); c.fillStyle = on ? w.color : '#56627a'; c.fillText((on ? '\u25b6 ' : '   ') + w.short, self.X(wb[0] + 12), y);
      c.textAlign = 'right'; c.font = font(13); c.fillText(w.reload >= 0 ? 'LOADING' : w.mag + (w.resMax ? ' / ' + w.res : ''), self.X(wb[0] + wb[2] - 12), y); c.textAlign = 'left';
    });
    var cw = S.weapons[S.wsel];
    var bx = this.X(wb[0] + 12), by = this.Y(wb[1] + 96), bw = 226 * k;
    if (cw.reload >= 0) {         // a fresh magazine slides up into the breech, then the bolt racks
      var u = cw.reload, slide = Math.min(1, u / 0.7), rack = u > 0.75 ? Math.sin((u - 0.75) / 0.25 * Math.PI) : 0;
      c.fillStyle = '#16202a'; c.fillRect(bx, by - 8 * k, bw, 18 * k);
      c.fillStyle = cw.color; c.globalAlpha = 0.9; c.fillRect(bx + bw * 0.55, by + (1 - slide) * 24 * k - 6 * k, bw * 0.3, 12 * k); c.globalAlpha = 1;
      c.fillStyle = '#c9d4e6'; c.fillRect(bx + bw * (0.05 + rack * 0.15), by - 6 * k, bw * 0.25, 6 * k);
      c.strokeStyle = cw.color; c.lineWidth = 2 * k; c.strokeRect(bx, by - 8 * k, bw, 18 * k);
      c.fillStyle = cw.color; c.fillRect(bx, by + 13 * k, bw * u, 3 * k);
    } else {
      var n = cw.magMax, pip = Math.min(14 * k, bw / n - 2 * k);
      for (var i = 0; i < n; i++) { c.fillStyle = i < cw.mag ? cw.color : '#1d2733'; c.fillRect(bx + i * (bw / n), by - 6 * k, Math.max(1, pip), 14 * k); }
    }
    if (S.swap > 0) { c.fillStyle = 'rgba(255,255,255,' + (S.swap * 0.25) + ')'; rr(c, this.X(wb[0]), this.Y(wb[1]), wb[2] * k, wb[3] * k, 8 * k); c.fill(); }
    // nav screen: autopilot state + distance to go
    var mb = L.map; c.font = font(13, 700); c.fillStyle = S.autopilot ? '#5dff9a' : '#ffb02e'; c.textAlign = 'left';
    c.fillText(S.autopilot ? 'AUTOPILOT' : 'MANUAL', this.X(mb[0] + 10), this.Y(mb[1] + 26));
    c.font = font(13); c.fillStyle = '#9fb7c9';
    c.fillText(S.toGo != null ? 'WAYPOINT ' + Math.round(S.toGo) + ' m' : 'NO PATH', this.X(mb[0] + 10), this.Y(mb[1] + 48));
    c.fillText(S.speedTxt || '', this.X(mb[0] + 10), this.Y(mb[1] + 70));
    // radar
    var rx = this.X(L.radar[0]), ry = this.Y(L.radar[1]), R = L.radar[2] * k, rng = 120;
    c.save(); c.beginPath(); c.arc(rx, ry, R, 0, TAU); c.clip();
    c.strokeStyle = 'rgba(80,255,150,.25)'; c.lineWidth = 1;
    c.beginPath(); c.arc(rx, ry, R * 0.5, 0, TAU); c.moveTo(rx - R, ry); c.lineTo(rx + R, ry); c.moveTo(rx, ry - R); c.lineTo(rx, ry + R); c.stroke();
    var sw = this.t * 2.2; c.fillStyle = 'rgba(80,255,150,.12)'; c.beginPath(); c.moveTo(rx, ry); c.arc(rx, ry, R, sw - 0.6, sw); c.closePath(); c.fill();
    if (S.radarPath && S.radarPath.length > 1) { c.strokeStyle = 'rgba(255,210,122,.8)'; c.lineWidth = 1.5 * k; c.beginPath(); S.radarPath.forEach(function (p, i) { var px = rx + p[0] / rng * R, py = ry - p[1] / rng * R; if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.stroke(); }
    if (S.radarBay) { c.fillStyle = '#5dc8ff'; c.fillRect(rx + S.radarBay[0] / rng * R - 4 * k, ry - S.radarBay[1] / rng * R - 4 * k, 8 * k, 8 * k); }
    (S.blips || []).forEach(function (b) { var px = rx + b[0] / rng * R, py = ry - b[1] / rng * R; c.fillStyle = b[2] === 'tank' ? '#ff6a3d' : '#ffd23f'; c.beginPath(); c.arc(px, py, (b[2] === 'tank' ? 4 : 3) * k, 0, TAU); c.fill(); });
    c.restore();
    c.fillStyle = '#5dff9a'; c.beginPath(); c.moveTo(rx, ry - 7 * k); c.lineTo(rx - 5 * k, ry + 5 * k); c.lineTo(rx + 5 * k, ry + 5 * k); c.fill();
    if (S.legDir != null) { c.strokeStyle = 'rgba(93,255,154,.6)'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + Math.sin(S.legDir) * R * 0.35, ry - Math.cos(S.legDir) * R * 0.35); c.stroke(); }
    // brace lever position
    c.fillStyle = S.braced ? '#ffb02e' : '#55607a'; c.fillRect(this.X(1005), this.Y(S.braced ? 830 : 780), 24 * k, 14 * k);
    // holo hands
    if (this.handsOn) { this.drawHand(c, this.hands[0], dt); this.drawHand(c, this.hands[1], dt); }
    this.msg(c, S);
  };
  P.msg = function (c, S) {
    if (!S.msg) return;
    var k = this.k; c.font = '700 ' + Math.round(22 * k) + 'px Fredoka, sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,.55)'; var w = c.measureText(S.msg).width + 30 * k; c.fillRect(this.X(800) - w / 2, this.Y(640), w, 34 * k);
    c.fillStyle = S.msgColor || '#ffd27a'; c.fillText(S.msg, this.X(800), this.Y(664));
  };
  P.toPx = function (nx, ny) { return [(nx + 1) / 2 * this.W, (1 - ny) / 2 * this.H]; };
  P.drawCross = function (c, x) {
    var self2 = this;
    var p = this.toPx(x.x, x.y), k = Math.max(0.6, this.k), r = 18 * k;
    c.strokeStyle = x.color; c.lineWidth = 2.5 * k; c.globalAlpha = 0.8;
    c.beginPath(); c.arc(p[0], p[1], r, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(p[0] - r * 1.8, p[1]); c.lineTo(p[0] - r * 0.6, p[1]); c.moveTo(p[0] + r * 0.6, p[1]); c.lineTo(p[0] + r * 1.8, p[1]);
    c.moveTo(p[0], p[1] - r * 1.8); c.lineTo(p[0], p[1] - r * 0.6); c.moveTo(p[0], p[1] + r * 0.6); c.lineTo(p[0], p[1] + r * 1.8); c.stroke();
    c.fillStyle = x.color; c.fillRect(p[0] - 1.5 * k, p[1] - 1.5 * k, 3 * k, 3 * k);
    if (x.ix != null) {      // v0.2 intent reticle: bigger, brighter, bolder; its gap opens up when the aim is shaky
      var q2 = this.toPx(x.ix, x.iy), R2 = (30 + 16 * (1 - (x.tight == null ? 1 : x.tight))) * k;
      for (var pass = 0; pass < 2; pass++) {
        c.globalAlpha = pass ? 1 : 0.35; c.lineWidth = (pass ? 3.5 : 10) * k; c.strokeStyle = pass ? '#ffffff' : x.color;
        for (var qd = 0; qd < 4; qd++) { var a0 = qd * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.arc(q2[0], q2[1], R2, a0 - 0.5, a0 + 0.5); c.stroke(); }
        c.beginPath(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { c.moveTo(q2[0] + d[0] * R2 * 0.55, q2[1] + d[1] * R2 * 0.55); c.lineTo(q2[0] + d[0] * R2 * 1.3, q2[1] + d[1] * R2 * 1.3); }); c.stroke();
      }
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(q2[0], q2[1], 3.5 * k, 0, TAU); c.fill(); c.globalAlpha = 0.95;
      p = q2;                 // the charge ring follows the intent reticle (that's where the shot goes)
    }
    if (x.charge > 0) { c.lineWidth = 5 * k; c.strokeStyle = x.charge >= 1 ? '#ffffff' : '#7af0ff'; c.beginPath(); c.arc(p[0], p[1], r * 1.45, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, x.charge)); c.stroke(); }
    (x.locks || []).forEach(function (l) {   // v0.3 rocket locks: amber brackets close in while acquiring, flashing red once locked
      var q = self2.toPx(l.x, l.y), s2 = (l.on ? 36 : 36 + 44 * (1 - l.p)) * k, fl = l.on ? (Math.floor(self2.t * 8) % 2 ? 1 : 0.6) : 0.85;
      c.globalAlpha = fl; c.strokeStyle = l.on ? '#ff2a2a' : '#ffb02e'; c.lineWidth = (l.on ? 4 : 2.5) * k; var e2 = s2 * 0.5; c.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (d) { c.moveTo(q[0] + d[0] * s2, q[1] + d[1] * s2 - d[1] * e2); c.lineTo(q[0] + d[0] * s2, q[1] + d[1] * s2); c.lineTo(q[0] + d[0] * s2 - d[0] * e2, q[1] + d[1] * s2); });
      c.stroke(); if (l.on) { c.font = '700 ' + Math.round(14 * k) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff2a2a'; c.fillText('LOCK', q[0], q[1] + s2 + 16 * k); }
      c.globalAlpha = 1;
    });
    if (x.lock && !(x.locks && x.locks.length)) {        // lock bracket: tight + solid when steady, wide + soft when shaky
      var q = this.toPx(x.lock.x, x.lock.y), s = (x.lock.r || 24) * k, a = x.lock.tight;
      c.globalAlpha = 0.45 + 0.5 * a; c.lineWidth = (1.5 + 2 * a) * k; c.strokeStyle = a > 0.6 ? '#ff5a3a' : x.color;
      var e = s * 0.45; c.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (d) { c.moveTo(q[0] + d[0] * s, q[1] + d[1] * s - d[1] * e); c.lineTo(q[0] + d[0] * s, q[1] + d[1] * s); c.lineTo(q[0] + d[0] * s - d[0] * e, q[1] + d[1] * s); });
      c.stroke();
    }
    c.globalAlpha = 1;
  };
  P.drawCal = function (c, m) {
    var p = this.toPx(m.x, m.y), k = Math.max(0.6, this.k), pulse = 1 + 0.15 * Math.sin(this.t * 6);
    c.strokeStyle = m.color; c.fillStyle = m.color; c.lineWidth = 4 * k;
    c.beginPath(); c.arc(p[0], p[1], 34 * k * pulse, 0, TAU); c.stroke(); c.beginPath(); c.arc(p[0], p[1], 10 * k, 0, TAU); c.fill();
    c.font = '700 ' + Math.round(22 * k) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
    c.fillText(m.label, p[0], p[1] + 66 * k);
  };
  root.MechCockpit = Cockpit;
})(window);
