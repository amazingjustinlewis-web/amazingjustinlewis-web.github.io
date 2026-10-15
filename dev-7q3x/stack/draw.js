/* STACK ATTACK - drawing shared by the screen and the pads. World is 1000 wide x 1400 tall (y down). */
(function (root) {
  var WW = 1000, WH = 1400;
  function fit(W, H) { var s = Math.min(W / WW, H / WH * 1.02), ox = (W - WW * s) / 2, oy = H - WH * s; return { s: s, ox: ox, oy: oy }; }
  function draw(ctx, W, H, S, t) {
    var F = fit(W, H), s = F.s; var sky = ctx.createLinearGradient(0, 0, 0, H);
    var dz = S.dz || '', storm = S.phase === 'disaster';
    sky.addColorStop(0, storm ? (dz === 'tornado' ? '#4a4a5a' : dz === 'monster' ? '#5a2a3a' : '#6a5030') : '#7ec8f0'); sky.addColorStop(1, storm ? '#2a2a33' : '#d8f0ff'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(F.ox, F.oy); ctx.scale(s, s);
    if (S.shake) ctx.translate(Math.sin(t * 50) * S.shake * 6, 0);
    ctx.fillStyle = '#ffffff18'; for (var y = 1150; y > 100; y -= 100) { ctx.fillRect(0, y, WW, 2); ctx.font = '22px Fredoka,sans-serif'; ctx.fillStyle = '#0003'; ctx.fillText(((1150 - y) / 100).toFixed(0) + 'm', 8, y - 4); ctx.fillStyle = '#ffffff18'; }
    if (S.best) { var by = 1150 - S.best * 100; ctx.strokeStyle = '#ffe7a0'; ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(WW, by); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffe7a0'; ctx.font = '26px Fredoka,sans-serif'; ctx.fillText('best ' + S.best.toFixed(1) + 'm', WW - 150, by - 8); }
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(0, 1260, WW, 200); ctx.fillStyle = '#5a9a3a'; ctx.fillRect(0, 1250, WW, 18);
    // shelves for new pieces
    ctx.fillStyle = '#8a6a4a'; [[0, 480], [0, 820], [WW - 190, 650]].forEach(function (q) { ctx.fillRect(q[0], q[1], 190, 14); });
    if (S.g) { var g = S.g; ctx.fillStyle = '#9a9aa8'; ctx.fillRect(g[0] - 225, g[1] - 20, 450, 40); ctx.fillStyle = '#7a7a88'; ctx.fillRect(g[0] - 200, g[1] + 20, 400, 1260 - g[1] - 20); }
    (S.b || []).forEach(function (b) {
      ctx.save(); ctx.translate(b[1], b[2]); ctx.rotate(b[3]); ctx.fillStyle = b[6]; ctx.strokeStyle = b[7] ? '#fff' : '#0006'; ctx.lineWidth = b[7] ? 6 : 3;
      if (b[0] === 'tri') { ctx.beginPath(); ctx.moveTo(-b[4] / 2, b[5] / 3); ctx.lineTo(b[4] / 2, b[5] / 3); ctx.lineTo(0, -2 * b[5] / 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.roundRect(-b[4] / 2, -b[5] / 2, b[4], b[5], 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff3'; ctx.fillRect(-b[4] / 2 + 6, -b[5] / 2 + 5, b[4] - 12, Math.min(8, b[5] / 4)); }
      ctx.restore();
    });
    if (S.tw != null) { for (var i = 0; i < 18; i++) { var yy = 1250 - i * 60, w = 30 + i * 14, xx = S.tw + Math.sin(t * 6 + i * .6) * (10 + i * 2); ctx.strokeStyle = 'rgba(220,220,230,' + (.5 - i * .02) + ')'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(xx, yy, w, 14, 0, 0, 7); ctx.stroke(); } }
    if (S.mz) { var m = S.mz; ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(m[0] + 230, 1050, 200, 230, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(m[0] + 120, m[1], 130, 95, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m[0] + 80, m[1] - 30, 26, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(m[0] + 72, m[1] - 28, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; for (var k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(m[0] + 10 + k * 28, m[1] + 40); ctx.lineTo(m[0] + 24 + k * 28, m[1] + 64); ctx.lineTo(m[0] + 38 + k * 28, m[1] + 40); ctx.fill(); }
      ctx.fillStyle = '#2e7d32'; for (var k2 = 0; k2 < 5; k2++) { ctx.beginPath(); ctx.moveTo(m[0] + 180 + k2 * 40, m[1] - 70 + k2 * 40); ctx.lineTo(m[0] + 230 + k2 * 40, m[1] - 120 + k2 * 40); ctx.lineTo(m[0] + 220 + k2 * 40, m[1] - 50 + k2 * 40); ctx.fill(); } }
    ctx.restore();
  }
  function toWorld(W, H, x, y) { var F = fit(W, H); return [(x - F.ox) / F.s, (y - F.oy) / F.s]; }
  root.StackDraw = { draw: draw, toWorld: toWorld, WW: WW, WH: WH };
})(window);
